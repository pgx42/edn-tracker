/// Anki SM-2 spaced-repetition scheduler.
///
/// Faithfully reproduces the v2/v3 algorithm from:
/// https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/states/
///
/// Pure logic — no database access.
use serde::{Deserialize, Serialize};

// ─── Default deck config ──────────────────────────────────────────────────────

const LEARN_STEPS_SECS: &[u32] = &[60, 600]; // 1 min, 10 min
const RELEARN_STEPS_SECS: &[u32] = &[600]; // 10 min
const GRADUATING_INTERVAL: u32 = 1; // days
const EASY_INTERVAL: u32 = 4; // days
const INITIAL_EASE: f32 = 2.5;
const EASY_MULT: f32 = 1.3;
const HARD_MULT: f32 = 1.2;
const LAPSE_MULT: f32 = 0.0; // default: always reset to min_lapse
const MAX_INTERVAL: u32 = 36_500; // ~100 years in days
const MIN_LAPSE_INTERVAL: u32 = 1; // day
const MIN_EASE: f32 = 1.3;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[repr(i64)]
pub enum CardType {
    New = 0,
    Learning = 1,
    Review = 2,
    Relearning = 3,
}

impl TryFrom<i64> for CardType {
    type Error = i64;
    fn try_from(v: i64) -> Result<Self, i64> {
        match v {
            0 => Ok(CardType::New),
            1 => Ok(CardType::Learning),
            2 => Ok(CardType::Review),
            3 => Ok(CardType::Relearning),
            x => Err(x),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ease {
    Again = 1,
    Hard = 2,
    Good = 3,
    Easy = 4,
}

impl TryFrom<u8> for Ease {
    type Error = String;
    fn try_from(v: u8) -> Result<Self, String> {
        match v {
            1 => Ok(Ease::Again),
            2 => Ok(Ease::Hard),
            3 => Ok(Ease::Good),
            4 => Ok(Ease::Easy),
            x => Err(format!("Invalid ease value: {x}")),
        }
    }
}

/// Per-deck scheduler configuration (matches Anki defaults).
#[derive(Debug, Clone)]
pub struct DeckConfig {
    pub learn_steps_secs: Vec<u32>,
    pub relearn_steps_secs: Vec<u32>,
    pub graduating_interval: u32,
    pub easy_interval: u32,
    pub initial_ease: f32,
    pub easy_mult: f32,
    pub hard_mult: f32,
    pub lapse_mult: f32,
    pub max_interval: u32,
    pub min_lapse_interval: u32,
}

impl Default for DeckConfig {
    fn default() -> Self {
        Self {
            learn_steps_secs: LEARN_STEPS_SECS.to_vec(),
            relearn_steps_secs: RELEARN_STEPS_SECS.to_vec(),
            graduating_interval: GRADUATING_INTERVAL,
            easy_interval: EASY_INTERVAL,
            initial_ease: INITIAL_EASE,
            easy_mult: EASY_MULT,
            hard_mult: HARD_MULT,
            lapse_mult: LAPSE_MULT,
            max_interval: MAX_INTERVAL,
            min_lapse_interval: MIN_LAPSE_INTERVAL,
        }
    }
}

/// Full scheduling state of a card stored locally.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardSchedule {
    pub card_type: CardType,
    /// Learning/Relearning: Unix timestamp (secs) when next due.
    /// Review: day number (Unix epoch / 86400) when due.
    pub due: i64,
    /// Current interval in days (meaningful for Review/Relearning; 0 for New/Learning).
    pub interval: u32,
    /// Ease factor (e.g. 2.5). DB stores as integer × 1000.
    pub ease_factor: f32,
    /// Steps remaining before graduation (counts down; 0 = graduated).
    pub remaining_steps: u8,
    pub lapses: u32,
    pub reps: u32,
    /// Unix epoch day of the last review (needed to compute elapsed days accurately).
    pub last_review_day: Option<i64>,
}

impl CardSchedule {
    pub fn new_card(initial_ease: f32) -> Self {
        Self {
            card_type: CardType::New,
            due: 0,
            interval: 0,
            ease_factor: initial_ease,
            remaining_steps: 0,
            lapses: 0,
            reps: 0,
            last_review_day: None,
        }
    }
}

// ─── Day helpers ──────────────────────────────────────────────────────────────

/// Convert a Unix timestamp (seconds) to a UTC day number.
pub fn unix_day(unix_secs: i64) -> i64 {
    unix_secs / 86_400
}

// ─── Fuzz ─────────────────────────────────────────────────────────────────────

/// Deterministic interval fuzz seeded by the card ID (matches Anki ±5%).
fn fuzz_days(interval: u32, seed: i64) -> u32 {
    if interval < 2 {
        return interval;
    }
    let range = ((interval as f64 * 0.05).ceil() as i64).max(1);
    let fuzz = (seed.unsigned_abs() % (2 * range as u64 + 1)) as i64 - range;
    (interval as i64 + fuzz).max(1) as u32
}

/// Fuzz for learning steps: ≤ 25% of step or 5 minutes, whichever is smaller.
fn fuzz_step_secs(step_secs: u32) -> i64 {
    let max = ((step_secs as f64 * 0.25) as u32).min(300);
    if max == 0 {
        return 0;
    }
    // Use process uptime nanoseconds as entropy (no rand dep needed)
    let ns = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    (ns % (max + 1)) as i64
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/// Apply an answer to a card and return the updated schedule.
///
/// - `now_secs`: current Unix timestamp in seconds.
/// - `card_id`: used as seed for deterministic fuzz.
pub fn answer_card(
    card: &CardSchedule,
    ease: Ease,
    config: &DeckConfig,
    now_secs: i64,
    card_id: i64,
) -> CardSchedule {
    let today = unix_day(now_secs);
    let mut next = card.clone();
    next.reps += 1;
    next.last_review_day = Some(today);

    match card.card_type {
        CardType::New => schedule_new(&mut next, ease, config, now_secs, today),
        CardType::Learning => schedule_learning_steps(&mut next, ease, config, now_secs, today, false),
        CardType::Relearning => schedule_learning_steps(&mut next, ease, config, now_secs, today, true),
        CardType::Review => schedule_review(&mut next, ease, config, now_secs, today, card_id),
    }

    next
}

/// Compute the 4 next intervals for preview without mutating state.
/// Returns `[again_secs, hard_secs, good_secs, easy_secs]` where:
///   - negative value = learning delay in seconds (abs)
///   - positive value = review interval in days
pub fn preview_intervals(
    card: &CardSchedule,
    config: &DeckConfig,
    now_secs: i64,
    card_id: i64,
) -> [i64; 4] {
    [Ease::Again, Ease::Hard, Ease::Good, Ease::Easy].map(|ease| {
        let next = answer_card(card, ease, config, now_secs, card_id);
        match next.card_type {
            CardType::Learning | CardType::Relearning => -(next.due - now_secs).max(1),
            CardType::Review | CardType::New => next.interval as i64,
        }
    })
}

// ─── New ──────────────────────────────────────────────────────────────────────

fn schedule_new(
    card: &mut CardSchedule,
    ease: Ease,
    config: &DeckConfig,
    now_secs: i64,
    today: i64,
) {
    card.ease_factor = config.initial_ease;
    match ease {
        Ease::Easy => {
            // Skip learning entirely
            graduate_to_review(card, config.easy_interval, today);
        }
        _ => {
            // Enter learning
            card.card_type = CardType::Learning;
            card.remaining_steps = config.learn_steps_secs.len() as u8;
            card.interval = 0;
            apply_learning_step(card, ease, &config.learn_steps_secs, now_secs);
        }
    }
}

// ─── Learning / Relearning ────────────────────────────────────────────────────

fn schedule_learning_steps(
    card: &mut CardSchedule,
    ease: Ease,
    config: &DeckConfig,
    now_secs: i64,
    today: i64,
    is_relearn: bool,
) {
    let steps = if is_relearn {
        &config.relearn_steps_secs
    } else {
        &config.learn_steps_secs
    };

    if steps.is_empty() {
        let interval = if is_relearn {
            card.interval.max(config.min_lapse_interval)
        } else {
            config.graduating_interval
        };
        graduate_to_review(card, interval, today);
        return;
    }

    match ease {
        Ease::Again => {
            // Restart from first step
            card.card_type = if is_relearn { CardType::Relearning } else { CardType::Learning };
            card.remaining_steps = steps.len() as u8;
            let delay = steps[0];
            card.due = now_secs + delay as i64 + fuzz_step_secs(delay);
        }
        Ease::Hard => {
            // Repeat current step
            apply_learning_step(card, ease, steps, now_secs);
        }
        Ease::Good => {
            if card.remaining_steps <= 1 {
                // Graduate
                let interval = if is_relearn {
                    card.interval.max(config.min_lapse_interval)
                } else {
                    config.graduating_interval
                };
                graduate_to_review(card, interval, today);
            } else {
                card.remaining_steps -= 1;
                apply_learning_step(card, ease, steps, now_secs);
            }
        }
        Ease::Easy => {
            let interval = if is_relearn {
                (card.interval + 1).max(config.min_lapse_interval)
            } else {
                config.easy_interval
            };
            graduate_to_review(card, interval, today);
        }
    }
}

/// Set the next due time for a learning step based on the current remaining_steps.
fn apply_learning_step(card: &mut CardSchedule, ease: Ease, steps: &[u32], now_secs: i64) {
    let total = steps.len();
    let remaining = card.remaining_steps as usize;

    let delay = match ease {
        Ease::Hard => {
            // Repeat the current step (index = total - remaining)
            let idx = total.saturating_sub(remaining);
            steps[idx.min(total - 1)]
        }
        _ => {
            // Advance: use the step at index = total - remaining
            // (remaining was already decremented for Good before calling this)
            let idx = total.saturating_sub(remaining);
            steps[idx.min(total - 1)]
        }
    };
    card.due = now_secs + delay as i64 + fuzz_step_secs(delay);
}

fn graduate_to_review(card: &mut CardSchedule, interval_days: u32, today: i64) {
    card.card_type = CardType::Review;
    card.interval = interval_days.max(1);
    card.remaining_steps = 0;
    card.due = today + card.interval as i64;
}

// ─── Review ───────────────────────────────────────────────────────────────────

fn schedule_review(
    card: &mut CardSchedule,
    ease: Ease,
    config: &DeckConfig,
    now_secs: i64,
    today: i64,
    card_id: i64,
) {
    let scheduled = card.interval as f32;

    // Elapsed days since the card was last reviewed
    let elapsed = match card.last_review_day {
        // last_review_day was just set to today before calling this function,
        // so we need the previous value. We use the due-based estimate instead.
        _ => {
            // Estimate elapsed as: today - (due - interval)
            let last_day = card.due - scheduled as i64; // day the card was last reviewed
            (today - last_day) as f32
        }
    };
    let days_late = elapsed - scheduled;

    match ease {
        Ease::Again => {
            // Lapse
            card.lapses += 1;
            card.ease_factor = (card.ease_factor - 0.20).max(MIN_EASE);

            let lapse_interval = ((scheduled * config.lapse_mult) as u32)
                .max(config.min_lapse_interval)
                .min(config.max_interval);

            if config.relearn_steps_secs.is_empty() {
                card.card_type = CardType::Review;
                card.interval = lapse_interval;
                card.due = today + lapse_interval as i64;
            } else {
                card.card_type = CardType::Relearning;
                card.interval = lapse_interval;
                card.remaining_steps = config.relearn_steps_secs.len() as u8;
                let delay = config.relearn_steps_secs[0];
                card.due = now_secs + delay as i64 + fuzz_step_secs(delay);
            }
        }

        Ease::Hard => {
            let new_interval = hard_interval(scheduled, days_late, elapsed, config);
            let new_interval = fuzz_days(new_interval, card_id)
                .min(config.max_interval)
                .max(1);
            card.ease_factor = (card.ease_factor - 0.15).max(MIN_EASE);
            card.interval = new_interval;
            card.due = today + new_interval as i64;
        }

        Ease::Good => {
            let hard = hard_interval(scheduled, days_late, elapsed, config);
            let new_interval = good_interval(scheduled, days_late, elapsed, card.ease_factor, hard);
            let new_interval = fuzz_days(new_interval, card_id)
                .min(config.max_interval)
                .max(1);
            // ease_factor unchanged
            card.interval = new_interval;
            card.due = today + new_interval as i64;
        }

        Ease::Easy => {
            let hard = hard_interval(scheduled, days_late, elapsed, config);
            let good = good_interval(scheduled, days_late, elapsed, card.ease_factor, hard);
            let new_interval = easy_interval(scheduled, days_late, elapsed, card.ease_factor, good, config);
            let new_interval = fuzz_days(new_interval, card_id)
                .min(config.max_interval)
                .max(1);
            card.ease_factor += 0.15; // no upper cap on easy
            card.interval = new_interval;
            card.due = today + new_interval as i64;
        }
    }
}

fn hard_interval(scheduled: f32, days_late: f32, elapsed: f32, cfg: &DeckConfig) -> u32 {
    if days_late >= 0.0 {
        // Normal or overdue
        (scheduled * cfg.hard_mult).max(1.0).round() as u32
    } else {
        // Early review
        let a = (elapsed * cfg.hard_mult / 2.0).max(1.0);
        let b = (scheduled * cfg.hard_mult).max(1.0);
        a.max(b).round() as u32
    }
}

fn good_interval(scheduled: f32, days_late: f32, elapsed: f32, ease: f32, hard: u32) -> u32 {
    let min = (hard + 1) as f32;
    let v = if days_late >= 0.0 {
        (scheduled + days_late / 2.0) * ease
    } else {
        (elapsed * ease).max(scheduled)
    };
    v.max(min).round() as u32
}

fn easy_interval(
    scheduled: f32,
    days_late: f32,
    elapsed: f32,
    ease: f32,
    good: u32,
    cfg: &DeckConfig,
) -> u32 {
    let min = (good + 1) as f32;
    let v = if days_late >= 0.0 {
        (scheduled + days_late) * ease * cfg.easy_mult
    } else {
        let reduced = cfg.easy_mult - (cfg.easy_mult - 1.0) / 2.0;
        (elapsed * ease).max(scheduled) * reduced
    };
    v.max(min).round() as u32
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_review(interval: u32, ease: f32, due_today: i64) -> CardSchedule {
        CardSchedule {
            card_type: CardType::Review,
            due: due_today,
            interval,
            ease_factor: ease,
            remaining_steps: 0,
            lapses: 0,
            reps: 5,
            last_review_day: None,
        }
    }

    #[test]
    fn new_card_good_enters_learning() {
        let cfg = DeckConfig::default();
        let card = CardSchedule::new_card(cfg.initial_ease);
        let now = 1_700_000_000_i64;
        let next = answer_card(&card, Ease::Good, &cfg, now, 42);
        assert_eq!(next.card_type, CardType::Learning);
        assert!(next.due > now);
    }

    #[test]
    fn new_card_easy_graduates_directly() {
        let cfg = DeckConfig::default();
        let card = CardSchedule::new_card(cfg.initial_ease);
        let now = 1_700_000_000_i64;
        let next = answer_card(&card, Ease::Easy, &cfg, now, 42);
        assert_eq!(next.card_type, CardType::Review);
        assert_eq!(next.interval, cfg.easy_interval);
    }

    #[test]
    fn review_good_increases_interval() {
        let cfg = DeckConfig::default();
        let today = unix_day(1_700_000_000);
        let card = make_review(10, 2.5, today);
        let now = today * 86_400;
        let next = answer_card(&card, Ease::Good, &cfg, now, 100);
        assert_eq!(next.card_type, CardType::Review);
        assert!(next.interval > 10);
    }

    #[test]
    fn review_again_enters_relearning() {
        let cfg = DeckConfig::default();
        let today = unix_day(1_700_000_000);
        let card = make_review(10, 2.5, today);
        let now = today * 86_400;
        let next = answer_card(&card, Ease::Again, &cfg, now, 100);
        assert_eq!(next.card_type, CardType::Relearning);
        assert_eq!(next.lapses, 1);
        assert!(next.ease_factor < 2.5);
    }

    #[test]
    fn ease_clamped_to_min() {
        let cfg = DeckConfig::default();
        let today = unix_day(1_700_000_000);
        let card = make_review(5, 1.35, today);
        let now = today * 86_400;
        let next = answer_card(&card, Ease::Again, &cfg, now, 1);
        assert!(next.ease_factor >= MIN_EASE);
    }
}
