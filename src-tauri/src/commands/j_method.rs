use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JMethodConfig {
    pub enabled: bool,
    pub intervals: Vec<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ItemReviewScheduleRow {
    pub id: String,
    pub item_id: i64,
    pub scheduled_date: String,
    pub j_step: i32,
    pub j_label: String,
    pub completed: i32,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ItemReviewRow {
    pub id: String,
    pub item_id: i64,
    pub review_date: String,
    pub j_step: i32,
    pub quality: Option<i32>,
    pub notes: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DueItemSummary {
    pub schedule_id: String,
    pub item_id: i64,
    pub code: String,
    pub title: String,
    pub specialty_id: String,
    pub rank: String,
    pub scheduled_date: String,
    pub j_step: i32,
    pub j_label: String,
    pub is_overdue: bool,
}

// ── Config Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_j_method_config(
    db: tauri::State<'_, DbPool>,
) -> Result<JMethodConfig, String> {
    let row: Option<(i32, String)> = sqlx::query_as(
        "SELECT enabled, intervals_json FROM j_method_config WHERE id = 1",
    )
    .fetch_optional(db.inner())
    .await
    .map_err(|e| format!("get_j_method_config error: {e}"))?;

    match row {
        Some((enabled, json)) => {
            let intervals: Vec<i32> =
                serde_json::from_str(&json).unwrap_or_else(|_| vec![1, 3, 7, 14, 30, 60]);
            Ok(JMethodConfig {
                enabled: enabled != 0,
                intervals,
            })
        }
        None => Ok(JMethodConfig {
            enabled: true,
            intervals: vec![1, 3, 7, 14, 30, 60],
        }),
    }
}

#[tauri::command]
pub async fn update_j_method_config(
    enabled: bool,
    intervals: Vec<i32>,
    db: tauri::State<'_, DbPool>,
) -> Result<JMethodConfig, String> {
    let json = serde_json::to_string(&intervals)
        .map_err(|e| format!("serialize error: {e}"))?;

    sqlx::query(
        "INSERT OR REPLACE INTO j_method_config (id, enabled, intervals_json, updated_at)
         VALUES (1, ?, ?, CURRENT_TIMESTAMP)",
    )
    .bind(enabled as i32)
    .bind(&json)
    .execute(db.inner())
    .await
    .map_err(|e| format!("update_j_method_config error: {e}"))?;

    Ok(JMethodConfig { enabled, intervals })
}

// ── Review Lifecycle Commands ────────────────────────────────────────────────

/// Start the J-method review cycle for an item.
/// Sets item status to "in_progress" and creates scheduled review entries.
#[tauri::command]
pub async fn start_item_review(
    item_id: i64,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<ItemReviewScheduleRow>, String> {
    let pool = db.inner();

    // Check item exists
    let exists: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM items WHERE id = ?")
            .bind(item_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("start_item_review check: {e}"))?;

    if exists.is_none() {
        return Err(format!("Item {} introuvable", item_id));
    }

    // Check if already has active schedule
    let active: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM item_review_schedule WHERE item_id = ? AND completed = 0",
    )
    .bind(item_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("start_item_review active check: {e}"))?;

    if let Some((count,)) = active {
        if count > 0 {
            return Err("Cet item a déjà un cycle de révision en cours".to_string());
        }
    }

    // Update item status
    sqlx::query("UPDATE items SET status = 'in_progress' WHERE id = ?")
        .bind(item_id)
        .execute(pool)
        .await
        .map_err(|e| format!("start_item_review status update: {e}"))?;

    // Get config
    let config = get_config_internal(pool).await?;

    // Create initial review entry (J0 = today)
    let review_id = Uuid::new_v4().to_string();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    sqlx::query(
        "INSERT INTO item_reviews (id, item_id, review_date, j_step, quality)
         VALUES (?, ?, ?, 0, NULL)",
    )
    .bind(&review_id)
    .bind(item_id)
    .bind(&today)
    .execute(pool)
    .await
    .map_err(|e| format!("start_item_review initial review: {e}"))?;

    // Create scheduled review entries for each J interval
    let mut schedules = Vec::new();
    let today_date = chrono::Local::now().date_naive();

    for (idx, &days) in config.intervals.iter().enumerate() {
        let scheduled = today_date + chrono::Duration::days(days as i64);
        let sched_id = Uuid::new_v4().to_string();
        let j_label = format!("J{}", days);

        sqlx::query(
            "INSERT INTO item_review_schedule (id, item_id, scheduled_date, j_step, j_label, completed)
             VALUES (?, ?, ?, ?, ?, 0)",
        )
        .bind(&sched_id)
        .bind(item_id)
        .bind(scheduled.format("%Y-%m-%d").to_string())
        .bind((idx + 1) as i32)
        .bind(&j_label)
        .execute(pool)
        .await
        .map_err(|e| format!("start_item_review schedule: {e}"))?;

        schedules.push(ItemReviewScheduleRow {
            id: sched_id,
            item_id,
            scheduled_date: scheduled.format("%Y-%m-%d").to_string(),
            j_step: (idx + 1) as i32,
            j_label,
            completed: 0,
            completed_at: None,
        });
    }

    Ok(schedules)
}

/// Complete a scheduled review.
#[tauri::command]
pub async fn complete_review(
    schedule_id: String,
    quality: i32,
    notes: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    let pool = db.inner();

    // Get the schedule entry
    let sched: Option<ItemReviewScheduleRow> = sqlx::query_as(
        "SELECT id, item_id, scheduled_date, j_step, j_label, completed, completed_at
         FROM item_review_schedule WHERE id = ?",
    )
    .bind(&schedule_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("complete_review fetch: {e}"))?;

    let sched = sched.ok_or("Révision planifiée introuvable")?;

    if sched.completed != 0 {
        return Err("Cette révision est déjà complétée".to_string());
    }

    // Mark schedule as completed
    sqlx::query(
        "UPDATE item_review_schedule SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(&schedule_id)
    .execute(pool)
    .await
    .map_err(|e| format!("complete_review update: {e}"))?;

    // Create review record
    let review_id = Uuid::new_v4().to_string();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    sqlx::query(
        "INSERT INTO item_reviews (id, item_id, review_date, j_step, quality, notes)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&review_id)
    .bind(sched.item_id)
    .bind(&today)
    .bind(sched.j_step)
    .bind(quality)
    .bind(&notes)
    .execute(pool)
    .await
    .map_err(|e| format!("complete_review insert review: {e}"))?;

    // Check if all reviews for this item are completed
    let (remaining,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM item_review_schedule WHERE item_id = ? AND completed = 0",
    )
    .bind(sched.item_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("complete_review count: {e}"))?;

    if remaining == 0 {
        // All reviews done — mark item as mastered
        sqlx::query("UPDATE items SET status = 'mastered' WHERE id = ?")
            .bind(sched.item_id)
            .execute(pool)
            .await
            .map_err(|e| format!("complete_review mastered: {e}"))?;
    }

    Ok(())
}

/// Get items due for review on a given date (default: today).
/// Includes overdue items.
#[tauri::command]
pub async fn get_due_items(
    date: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<DueItemSummary>, String> {
    let target_date = date.unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

    let rows: Vec<(String, i64, String, String, String, String, String, i32, String)> =
        sqlx::query_as(
            "SELECT s.id, s.item_id, i.code, i.title, i.specialty_id, i.rank,
                    s.scheduled_date, s.j_step, s.j_label
             FROM item_review_schedule s
             JOIN items i ON i.id = s.item_id
             WHERE s.completed = 0 AND s.scheduled_date <= ?
             ORDER BY s.scheduled_date ASC, i.rank ASC",
        )
        .bind(&target_date)
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("get_due_items error: {e}"))?;

    let results = rows
        .into_iter()
        .map(|(sid, item_id, code, title, spec, rank, sched_date, j_step, j_label)| {
            let is_overdue = sched_date < target_date;
            DueItemSummary {
                schedule_id: sid,
                item_id,
                code,
                title,
                specialty_id: spec,
                rank,
                scheduled_date: sched_date,
                j_step,
                j_label,
                is_overdue,
            }
        })
        .collect();

    Ok(results)
}

/// Get review history for a specific item.
#[tauri::command]
pub async fn get_item_review_history(
    item_id: i64,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<ItemReviewRow>, String> {
    sqlx::query_as::<_, ItemReviewRow>(
        "SELECT id, item_id, review_date, j_step, quality, notes, created_at
         FROM item_reviews WHERE item_id = ?
         ORDER BY review_date ASC",
    )
    .bind(item_id)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("get_item_review_history error: {e}"))
}

/// Get scheduled reviews in a date range (for calendar overlay).
#[tauri::command]
pub async fn get_review_calendar(
    date_from: String,
    date_to: String,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<ItemReviewScheduleRow>, String> {
    sqlx::query_as::<_, ItemReviewScheduleRow>(
        "SELECT id, item_id, scheduled_date, j_step, j_label, completed, completed_at
         FROM item_review_schedule
         WHERE scheduled_date >= ? AND scheduled_date <= ?
         ORDER BY scheduled_date ASC",
    )
    .bind(&date_from)
    .bind(&date_to)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("get_review_calendar error: {e}"))
}

/// Get the schedule for a specific item.
#[tauri::command]
pub async fn get_item_schedule(
    item_id: i64,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<ItemReviewScheduleRow>, String> {
    sqlx::query_as::<_, ItemReviewScheduleRow>(
        "SELECT id, item_id, scheduled_date, j_step, j_label, completed, completed_at
         FROM item_review_schedule WHERE item_id = ?
         ORDER BY j_step ASC",
    )
    .bind(item_id)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("get_item_schedule error: {e}"))
}

/// Reset the J-method cycle for an item (delete all schedules and reviews).
#[tauri::command]
pub async fn reset_item_review(
    item_id: i64,
    db: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    let pool = db.inner();

    sqlx::query("DELETE FROM item_review_schedule WHERE item_id = ?")
        .bind(item_id)
        .execute(pool)
        .await
        .map_err(|e| format!("reset_item_review schedule: {e}"))?;

    sqlx::query("DELETE FROM item_reviews WHERE item_id = ?")
        .bind(item_id)
        .execute(pool)
        .await
        .map_err(|e| format!("reset_item_review reviews: {e}"))?;

    sqlx::query("UPDATE items SET status = 'not_started' WHERE id = ?")
        .bind(item_id)
        .execute(pool)
        .await
        .map_err(|e| format!("reset_item_review status: {e}"))?;

    Ok(())
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async fn get_config_internal(pool: &sqlx::SqlitePool) -> Result<JMethodConfig, String> {
    let row: Option<(i32, String)> = sqlx::query_as(
        "SELECT enabled, intervals_json FROM j_method_config WHERE id = 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("get_config_internal error: {e}"))?;

    match row {
        Some((enabled, json)) => {
            let intervals: Vec<i32> =
                serde_json::from_str(&json).unwrap_or_else(|_| vec![1, 3, 7, 14, 30, 60]);
            Ok(JMethodConfig {
                enabled: enabled != 0,
                intervals,
            })
        }
        None => Ok(JMethodConfig {
            enabled: true,
            intervals: vec![1, 3, 7, 14, 30, 60],
        }),
    }
}
