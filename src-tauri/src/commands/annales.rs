use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AnnaleSession {
    pub id: String,
    pub title: String,
    pub year: i32,
    pub specialty_id: Option<String>,
    pub pdf_document_id: Option<String>,
    pub total_questions: i32,
    pub score: Option<f64>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub notes: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AnnaleQuestion {
    pub id: String,
    pub annale_session_id: String,
    pub question_number: i32,
    pub item_id: Option<i64>,
    pub question_text: Option<String>,
    pub correct_answer: Option<String>,
    pub points: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AnnaleAnswer {
    pub id: String,
    pub annale_question_id: String,
    pub user_answer: Option<String>,
    pub is_correct: Option<i32>,
    pub partial_score: Option<f64>,
    pub notes: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnaleSessionDetail {
    pub session: AnnaleSession,
    pub questions: Vec<QuestionWithAnswer>,
    pub specialty_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestionWithAnswer {
    pub question: AnnaleQuestion,
    pub answer: Option<AnnaleAnswer>,
    pub item_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnaleStats {
    pub total_annales: i64,
    pub completed_annales: i64,
    pub avg_score: f64,
    pub best_score: f64,
    pub worst_score: f64,
    pub by_year: Vec<YearScore>,
    pub by_specialty: Vec<SpecialtyScore>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct YearScore {
    pub year: i32,
    pub count: i64,
    pub avg_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SpecialtyScore {
    pub specialty_id: String,
    pub specialty_name: String,
    pub count: i64,
    pub avg_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AnnaleError {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub error_type: String,
    pub severity: String,
    pub item_id: Option<i32>,
    pub annale_session_id: Option<String>,
    pub created_at: Option<String>,
    pub resolved_at: Option<String>,
}

// ── Session CRUD ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_annale_session(
    title: String,
    year: i32,
    specialty_id: Option<String>,
    pdf_document_id: Option<String>,
    total_questions: i32,
    notes: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<AnnaleSession, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO annale_sessions (id, title, year, specialty_id, pdf_document_id, total_questions, notes, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    )
    .bind(&id)
    .bind(&title)
    .bind(year)
    .bind(&specialty_id)
    .bind(&pdf_document_id)
    .bind(total_questions)
    .bind(&notes)
    .execute(db.inner())
    .await
    .map_err(|e| format!("create_annale_session error: {e}"))?;

    // Auto-create empty questions
    for i in 1..=total_questions {
        let qid = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO annale_questions (id, annale_session_id, question_number, points)
             VALUES (?, ?, ?, 1.0)",
        )
        .bind(&qid)
        .bind(&id)
        .bind(i)
        .execute(db.inner())
        .await
        .map_err(|e| format!("create_annale_session question {i}: {e}"))?;
    }

    Ok(AnnaleSession {
        id,
        title,
        year,
        specialty_id,
        pdf_document_id,
        total_questions,
        score: None,
        started_at: None,
        completed_at: None,
        notes,
        created_at: None,
    })
}

#[tauri::command]
pub async fn list_annale_sessions(
    year: Option<i32>,
    specialty_id: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<AnnaleSession>, String> {
    let mut q = "SELECT id, title, year, specialty_id, pdf_document_id, total_questions, score, started_at, completed_at, notes, created_at FROM annale_sessions WHERE 1=1".to_string();

    if year.is_some() {
        q.push_str(" AND year = ?");
    }
    if specialty_id.is_some() {
        q.push_str(" AND specialty_id = ?");
    }
    q.push_str(" ORDER BY created_at DESC");

    let mut query = sqlx::query_as::<_, AnnaleSession>(&q);
    if let Some(y) = year {
        query = query.bind(y);
    }
    if let Some(s) = &specialty_id {
        query = query.bind(s);
    }

    query
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("list_annale_sessions error: {e}"))
}

#[tauri::command]
pub async fn get_annale_session_detail(
    id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<AnnaleSessionDetail, String> {
    let pool = db.inner();

    let session = sqlx::query_as::<_, AnnaleSession>(
        "SELECT id, title, year, specialty_id, pdf_document_id, total_questions, score, started_at, completed_at, notes, created_at
         FROM annale_sessions WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("get_annale_session_detail: {e}"))?
    .ok_or("Session d'annale introuvable")?;

    let specialty_name: Option<String> = if let Some(ref sid) = session.specialty_id {
        sqlx::query_as::<_, (String,)>("SELECT name FROM specialties WHERE id = ?")
            .bind(sid)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("specialty name: {e}"))?
            .map(|(n,)| n)
    } else {
        None
    };

    let questions = sqlx::query_as::<_, AnnaleQuestion>(
        "SELECT id, annale_session_id, question_number, item_id, question_text, correct_answer, points
         FROM annale_questions WHERE annale_session_id = ?
         ORDER BY question_number ASC",
    )
    .bind(&id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("questions: {e}"))?;

    let mut questions_with_answers = Vec::new();
    for q in questions {
        let answer = sqlx::query_as::<_, AnnaleAnswer>(
            "SELECT id, annale_question_id, user_answer, is_correct, partial_score, notes, created_at
             FROM annale_answers WHERE annale_question_id = ?
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(&q.id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("answer: {e}"))?;

        let item_title = if let Some(iid) = q.item_id {
            sqlx::query_as::<_, (String,)>("SELECT title FROM items WHERE id = ?")
                .bind(iid)
                .fetch_optional(pool)
                .await
                .map_err(|e| format!("item title: {e}"))?
                .map(|(t,)| t)
        } else {
            None
        };

        questions_with_answers.push(QuestionWithAnswer {
            question: q,
            answer,
            item_title,
        });
    }

    Ok(AnnaleSessionDetail {
        session,
        questions: questions_with_answers,
        specialty_name,
    })
}

#[tauri::command]
pub async fn update_annale_session(
    id: String,
    title: Option<String>,
    notes: Option<String>,
    completed: Option<bool>,
    db: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    if let Some(t) = &title {
        sqlx::query("UPDATE annale_sessions SET title = ? WHERE id = ?")
            .bind(t).bind(&id)
            .execute(db.inner()).await
            .map_err(|e| format!("update title: {e}"))?;
    }
    if let Some(n) = &notes {
        sqlx::query("UPDATE annale_sessions SET notes = ? WHERE id = ?")
            .bind(n).bind(&id)
            .execute(db.inner()).await
            .map_err(|e| format!("update notes: {e}"))?;
    }
    if let Some(true) = completed {
        sqlx::query("UPDATE annale_sessions SET completed_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(&id)
            .execute(db.inner()).await
            .map_err(|e| format!("update completed: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_annale_session(
    id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<bool, String> {
    // Also clear annale_session_id from linked errors
    sqlx::query("UPDATE errors SET annale_session_id = NULL WHERE annale_session_id = ?")
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("unlink errors: {e}"))?;

    let r = sqlx::query("DELETE FROM annale_sessions WHERE id = ?")
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("delete_annale_session: {e}"))?;
    Ok(r.rows_affected() > 0)
}

// ── Question / Answer Commands ───────────────────────────────────────────────

#[tauri::command]
pub async fn update_annale_question(
    id: String,
    item_id: Option<i64>,
    question_text: Option<String>,
    correct_answer: Option<String>,
    points: Option<f64>,
    db: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE annale_questions SET item_id = COALESCE(?, item_id), question_text = COALESCE(?, question_text),
         correct_answer = COALESCE(?, correct_answer), points = COALESCE(?, points) WHERE id = ?",
    )
    .bind(item_id)
    .bind(&question_text)
    .bind(&correct_answer)
    .bind(points)
    .bind(&id)
    .execute(db.inner())
    .await
    .map_err(|e| format!("update_annale_question: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn submit_annale_answer(
    question_id: String,
    user_answer: Option<String>,
    is_correct: bool,
    partial_score: Option<f64>,
    notes: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<AnnaleAnswer, String> {
    let pool = db.inner();
    let id = Uuid::new_v4().to_string();

    // Delete previous answer for this question (single answer per question)
    sqlx::query("DELETE FROM annale_answers WHERE annale_question_id = ?")
        .bind(&question_id)
        .execute(pool)
        .await
        .map_err(|e| format!("clear old answer: {e}"))?;

    sqlx::query(
        "INSERT INTO annale_answers (id, annale_question_id, user_answer, is_correct, partial_score, notes)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&question_id)
    .bind(&user_answer)
    .bind(is_correct as i32)
    .bind(partial_score)
    .bind(&notes)
    .execute(pool)
    .await
    .map_err(|e| format!("submit_annale_answer: {e}"))?;

    Ok(AnnaleAnswer {
        id,
        annale_question_id: question_id,
        user_answer,
        is_correct: Some(is_correct as i32),
        partial_score,
        notes,
        created_at: None,
    })
}

/// Calculate and save the score for an annale session.
#[tauri::command]
pub async fn calculate_annale_score(
    session_id: String,
    db: tauri::State<'_, DbPool>,
) -> Result<f64, String> {
    let pool = db.inner();

    // Get all questions and their answers
    let rows: Vec<(f64, Option<i32>, Option<f64>)> = sqlx::query_as(
        "SELECT q.points, a.is_correct, a.partial_score
         FROM annale_questions q
         LEFT JOIN annale_answers a ON a.annale_question_id = q.id
         WHERE q.annale_session_id = ?",
    )
    .bind(&session_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("calculate_annale_score: {e}"))?;

    let total_points: f64 = rows.iter().map(|(p, _, _)| p).sum();
    if total_points == 0.0 {
        return Ok(0.0);
    }

    let earned: f64 = rows
        .iter()
        .map(|(points, is_correct, partial)| {
            if let Some(ps) = partial {
                *ps
            } else if let Some(1) = is_correct {
                *points
            } else {
                0.0
            }
        })
        .sum();

    let score = (earned / total_points) * 100.0;
    let score = (score * 100.0).round() / 100.0; // 2 decimal places

    sqlx::query("UPDATE annale_sessions SET score = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(score)
        .bind(&session_id)
        .execute(pool)
        .await
        .map_err(|e| format!("save score: {e}"))?;

    Ok(score)
}

// ── Stats ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_annale_stats(
    db: tauri::State<'_, DbPool>,
) -> Result<AnnaleStats, String> {
    let pool = db.inner();

    let (total,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM annale_sessions")
        .fetch_one(pool).await.map_err(|e| format!("total: {e}"))?;

    let (completed,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM annale_sessions WHERE completed_at IS NOT NULL")
        .fetch_one(pool).await.map_err(|e| format!("completed: {e}"))?;

    let scores: (Option<f64>, Option<f64>, Option<f64>) = sqlx::query_as(
        "SELECT AVG(score), MAX(score), MIN(score) FROM annale_sessions WHERE score IS NOT NULL",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("scores: {e}"))?;

    let by_year: Vec<YearScore> = sqlx::query_as(
        "SELECT year, COUNT(*) as count, COALESCE(AVG(score), 0) as avg_score
         FROM annale_sessions WHERE score IS NOT NULL
         GROUP BY year ORDER BY year DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("by_year: {e}"))?;

    let by_specialty: Vec<SpecialtyScore> = sqlx::query_as(
        "SELECT a.specialty_id, COALESCE(s.name, 'Non classé') as specialty_name,
                COUNT(*) as count, COALESCE(AVG(a.score), 0) as avg_score
         FROM annale_sessions a
         LEFT JOIN specialties s ON s.id = a.specialty_id
         WHERE a.score IS NOT NULL
         GROUP BY a.specialty_id ORDER BY avg_score DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("by_specialty: {e}"))?;

    Ok(AnnaleStats {
        total_annales: total,
        completed_annales: completed,
        avg_score: scores.0.unwrap_or(0.0),
        best_score: scores.1.unwrap_or(0.0),
        worst_score: scores.2.unwrap_or(0.0),
        by_year,
        by_specialty,
    })
}

// ── Annale Errors ────────────────────────────────────────────────────────────

/// Create an error linked to an annale session.
#[tauri::command]
pub async fn create_annale_error(
    annale_session_id: String,
    title: String,
    description: Option<String>,
    error_type: String,
    severity: String,
    item_id: Option<i32>,
    db: tauri::State<'_, DbPool>,
) -> Result<AnnaleError, String> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO errors (id, title, description, error_type, severity, item_id, annale_session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&title)
    .bind(&description)
    .bind(&error_type)
    .bind(&severity)
    .bind(item_id)
    .bind(&annale_session_id)
    .execute(db.inner())
    .await
    .map_err(|e| format!("create_annale_error: {e}"))?;

    Ok(AnnaleError {
        id,
        title,
        description,
        error_type,
        severity,
        item_id,
        annale_session_id: Some(annale_session_id),
        created_at: None,
        resolved_at: None,
    })
}

/// Get errors linked to a specific annale session.
#[tauri::command]
pub async fn get_annale_errors(
    annale_session_id: String,
    specialty_id: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<AnnaleError>, String> {
    let mut q = "SELECT e.id, e.title, e.description, e.error_type, e.severity, e.item_id, e.annale_session_id, e.created_at, e.resolved_at
         FROM errors e WHERE e.annale_session_id = ?".to_string();

    if specialty_id.is_some() {
        q.push_str(" AND e.item_id IN (SELECT id FROM items WHERE specialty_id = ?)");
    }
    q.push_str(" ORDER BY e.created_at DESC");

    let mut query = sqlx::query_as::<_, AnnaleError>(&q);
    query = query.bind(&annale_session_id);
    if let Some(s) = &specialty_id {
        query = query.bind(s);
    }

    query
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("get_annale_errors: {e}"))
}
