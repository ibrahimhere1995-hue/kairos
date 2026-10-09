use rusqlite::{Connection, OptionalExtension, params};

use crate::models::goal::{Goal, Milestone};

fn goal_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Goal> {
    Ok(Goal {
        id: r.get(0)?,
        title: r.get(1)?,
        description: r.get(2)?,
        area_id: r.get(3)?,
        target_date: r.get(4)?,
        achieved_at: r.get(5)?,
    })
}

fn milestone_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Milestone> {
    Ok(Milestone {
        id: r.get(0)?,
        goal_id: r.get(1)?,
        title: r.get(2)?,
        target_date: r.get(3)?,
        sort_order: r.get(4)?,
    })
}

const GOAL_COLS: &str = "id, title, description, area_id, target_date, achieved_at";
const MILESTONE_COLS: &str = "id, goal_id, title, target_date, sort_order";

pub fn list_goals(conn: &Connection) -> rusqlite::Result<Vec<Goal>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {GOAL_COLS} FROM goals WHERE deleted_at IS NULL
         ORDER BY achieved_at IS NOT NULL, target_date IS NULL, target_date, created_at"
    ))?;
    stmt.query_map([], goal_row)?.collect()
}

/// Including deleted ones (for restore); the bool says whether it's deleted.
pub fn get_goal(conn: &Connection, id: &str) -> rusqlite::Result<Option<(Goal, bool)>> {
    conn.query_row(
        &format!("SELECT {GOAL_COLS}, deleted_at IS NOT NULL FROM goals WHERE id = ?1"),
        [id],
        |r| Ok((goal_row(r)?, r.get(6)?)),
    )
    .optional()
}

pub fn insert_goal(conn: &Connection, g: &Goal, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO goals (id, title, description, area_id, target_date, achieved_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![g.id, g.title, g.description, g.area_id, g.target_date, g.achieved_at, now],
    )?;
    Ok(())
}

pub fn update_goal(conn: &Connection, g: &Goal, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE goals SET title = ?2, description = ?3, area_id = ?4, target_date = ?5,
           achieved_at = ?6, updated_at = ?7 WHERE id = ?1",
        params![
            g.id,
            g.title,
            g.description,
            g.area_id,
            g.target_date,
            g.achieved_at,
            now
        ],
    )?;
    Ok(())
}

pub fn set_goal_deleted(
    conn: &Connection,
    id: &str,
    deleted_at: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE goals SET deleted_at = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, deleted_at, now],
    )?;
    Ok(())
}

pub fn list_milestones(conn: &Connection, goal_id: &str) -> rusqlite::Result<Vec<Milestone>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {MILESTONE_COLS} FROM milestones WHERE goal_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order, created_at"
    ))?;
    stmt.query_map([goal_id], milestone_row)?.collect()
}

/// A milestone that isn't deleted and whose goal isn't deleted.
pub fn milestone_active(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM milestones m JOIN goals g ON g.id = m.goal_id
           WHERE m.id = ?1 AND m.deleted_at IS NULL AND g.deleted_at IS NULL)",
        [id],
        |r| r.get(0),
    )
}

pub fn insert_milestone(conn: &Connection, m: &Milestone, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO milestones (id, goal_id, title, target_date, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![m.id, m.goal_id, m.title, m.target_date, m.sort_order, now],
    )?;
    Ok(())
}

pub fn rename_milestone(
    conn: &Connection,
    id: &str,
    title: &str,
    now: &str,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE milestones SET title = ?2, updated_at = ?3 WHERE id = ?1 AND deleted_at IS NULL",
        params![id, title, now],
    )
}

pub fn set_milestone_deleted(
    conn: &Connection,
    id: &str,
    deleted_at: Option<&str>,
    now: &str,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE milestones SET deleted_at = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, deleted_at, now],
    )
}

/// `(done, total)` tasks linked to a milestone: not trashed, not repeating series rows.
pub fn milestone_counts(conn: &Connection, milestone_id: &str) -> rusqlite::Result<(u32, u32)> {
    conn.query_row(
        "SELECT COUNT(*) FILTER (WHERE completed_at IS NOT NULL), COUNT(*) FROM items
         WHERE milestone_id = ?1 AND kind = 'task' AND deleted_at IS NULL AND rrule IS NULL
           AND skipped_at IS NULL",
        [milestone_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
}
