use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ItemTracking {
    pub id: i64,
    pub code: String,
    pub title: String,
    pub specialty_id: String,
    pub rank: String,
    pub status: Option<String>,
    pub college_lu: i32,
    pub fiche_faite: i32,
    pub error_count: i64,
    pub anki_card_count: i64,
    pub annale_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_items: i64,
    pub items_started: i64,
    pub items_mastered: i64,
    pub items_not_started: i64,
    pub colleges_lus: i64,
    pub fiches_faites: i64,
    pub total_errors: i64,
    pub open_errors: i64,
    pub total_anki_cards: i64,
    pub total_annales: i64,
    pub avg_annale_score: f64,
    pub due_reviews_today: i64,
    pub overdue_reviews: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SpecialtyProgress {
    pub specialty_id: String,
    pub specialty_name: String,
    pub total_items: i64,
    pub mastered_items: i64,
    pub in_progress_items: i64,
    pub error_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HeatmapDay {
    pub date: String,
    pub count: i64,
}

// ── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_items_tracking(
    specialty_id: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<ItemTracking>, String> {
    let mut q = "SELECT i.id, i.code, i.title, i.specialty_id, i.rank, i.status,
            COALESCE(i.college_lu, 0) as college_lu,
            COALESCE(i.fiche_faite, 0) as fiche_faite,
            COALESCE(ec.cnt, 0) as error_count,
            COALESCE(ac.cnt, 0) as anki_card_count,
            COALESCE(aq.cnt, 0) as annale_count
         FROM items i
         LEFT JOIN (SELECT item_id, COUNT(*) as cnt FROM errors GROUP BY item_id) ec ON ec.item_id = i.id
         LEFT JOIN (SELECT item_id, COUNT(*) as cnt FROM annale_questions GROUP BY item_id) aq ON aq.item_id = i.id
         LEFT JOIN (SELECT COUNT(*) as cnt, tags FROM anki_notes GROUP BY tags) ac ON ac.tags LIKE '%' || i.code || '%'
         WHERE 1=1".to_string();

    if specialty_id.is_some() {
        q.push_str(" AND (i.specialty_id = ? OR i.id IN (SELECT item_id FROM item_specialties WHERE specialty_id = ?))");
    }
    q.push_str(" ORDER BY i.id");

    let mut query = sqlx::query_as::<_, ItemTracking>(&q);
    if let Some(s) = &specialty_id {
        query = query.bind(s);
        query = query.bind(s);
    }

    query
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("get_items_tracking error: {e}"))
}

#[tauri::command]
pub async fn update_item_tracking(
    item_id: i64,
    college_lu: Option<bool>,
    fiche_faite: Option<bool>,
    db: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    if let Some(v) = college_lu {
        sqlx::query("UPDATE items SET college_lu = ? WHERE id = ?")
            .bind(v as i32)
            .bind(item_id)
            .execute(db.inner())
            .await
            .map_err(|e| format!("update college_lu: {e}"))?;
    }
    if let Some(v) = fiche_faite {
        sqlx::query("UPDATE items SET fiche_faite = ? WHERE id = ?")
            .bind(v as i32)
            .bind(item_id)
            .execute(db.inner())
            .await
            .map_err(|e| format!("update fiche_faite: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_dashboard_stats(
    db: tauri::State<'_, DbPool>,
) -> Result<DashboardStats, String> {
    let pool = db.inner();

    let (total_items,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM items")
        .fetch_one(pool).await.map_err(|e| format!("total_items: {e}"))?;

    let (items_mastered,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM items WHERE status = 'mastered'")
        .fetch_one(pool).await.map_err(|e| format!("mastered: {e}"))?;

    let (items_started,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM items WHERE status = 'in_progress'")
        .fetch_one(pool).await.map_err(|e| format!("started: {e}"))?;

    let items_not_started = total_items - items_mastered - items_started;

    let (colleges_lus,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM items WHERE college_lu = 1")
        .fetch_one(pool).await.unwrap_or((0,));

    let (fiches_faites,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM items WHERE fiche_faite = 1")
        .fetch_one(pool).await.unwrap_or((0,));

    let (total_errors,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM errors")
        .fetch_one(pool).await.map_err(|e| format!("errors: {e}"))?;

    let (open_errors,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM errors WHERE resolved_at IS NULL")
        .fetch_one(pool).await.map_err(|e| format!("open_errors: {e}"))?;

    let (total_anki_cards,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM anki_notes")
        .fetch_one(pool).await.map_err(|e| format!("anki: {e}"))?;

    let (total_annales,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM annale_sessions")
        .fetch_one(pool).await.unwrap_or((0,));

    let (avg_annale_score,): (Option<f64>,) = sqlx::query_as(
        "SELECT AVG(score) FROM annale_sessions WHERE score IS NOT NULL",
    )
    .fetch_one(pool).await.unwrap_or((None,));

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let (due_reviews_today,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM item_review_schedule WHERE scheduled_date = ? AND completed = 0",
    )
    .bind(&today)
    .fetch_one(pool).await.unwrap_or((0,));

    let (overdue_reviews,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM item_review_schedule WHERE scheduled_date < ? AND completed = 0",
    )
    .bind(&today)
    .fetch_one(pool).await.unwrap_or((0,));

    Ok(DashboardStats {
        total_items,
        items_started,
        items_mastered,
        items_not_started,
        colleges_lus,
        fiches_faites,
        total_errors,
        open_errors,
        total_anki_cards,
        total_annales,
        avg_annale_score: avg_annale_score.unwrap_or(0.0),
        due_reviews_today,
        overdue_reviews,
    })
}

#[tauri::command]
pub async fn get_specialty_progress(
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<SpecialtyProgress>, String> {
    sqlx::query_as::<_, SpecialtyProgress>(
        "SELECT s.id as specialty_id, s.name as specialty_name,
                COUNT(DISTINCT i.id) as total_items,
                COUNT(DISTINCT CASE WHEN i.status = 'mastered' THEN i.id END) as mastered_items,
                COUNT(DISTINCT CASE WHEN i.status = 'in_progress' THEN i.id END) as in_progress_items,
                COUNT(DISTINCT e.id) as error_count
         FROM specialties s
         LEFT JOIN item_specialties iss ON iss.specialty_id = s.id
         LEFT JOIN items i ON i.id = iss.item_id
         LEFT JOIN errors e ON e.item_id = i.id AND e.resolved_at IS NULL
         GROUP BY s.id, s.name
         ORDER BY s.name",
    )
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("get_specialty_progress: {e}"))
}

#[tauri::command]
pub async fn get_heatmap_data(
    date_from: String,
    date_to: String,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<HeatmapDay>, String> {
    // Combine study sessions and item reviews into activity per day
    sqlx::query_as::<_, HeatmapDay>(
        "SELECT date, SUM(cnt) as count FROM (
            SELECT DATE(start_time) as date, COUNT(*) as cnt FROM study_sessions
            WHERE DATE(start_time) >= ? AND DATE(start_time) <= ?
            GROUP BY DATE(start_time)
            UNION ALL
            SELECT review_date as date, COUNT(*) as cnt FROM item_reviews
            WHERE review_date >= ? AND review_date <= ?
            GROUP BY review_date
         ) GROUP BY date ORDER BY date",
    )
    .bind(&date_from)
    .bind(&date_to)
    .bind(&date_from)
    .bind(&date_to)
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("get_heatmap_data: {e}"))
}
