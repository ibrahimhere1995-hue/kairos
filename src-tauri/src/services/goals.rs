//! Goals → milestones → tasks (PRD R14, P3-T03). Progress is computed from linked tasks.

use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::models::goal::{Goal, GoalInput, GoalProgress, Milestone, MilestoneProgress};
use crate::repo::{areas, goals as repo};
use crate::services::item_rules::normalize_date;
use crate::util::{new_id, now_utc};

const TITLE_MAX: usize = 200;

fn clean_title(title: &str) -> AppResult<String> {
    let title = title.trim();
    if title.is_empty() {
        return Err(AppError::invalid("title", "required"));
    }
    if title.chars().count() > TITLE_MAX {
        return Err(AppError::invalid("title", "tooLong"));
    }
    Ok(title.to_owned())
}

fn apply(conn: &Connection, goal: &mut Goal, input: &GoalInput) -> AppResult<()> {
    goal.title = clean_title(&input.title)?;
    goal.description = input
        .description
        .as_deref()
        .map(str::trim)
        .filter(|d| !d.is_empty())
        .map(str::to_owned);
    goal.area_id = input.area_id.clone().filter(|a| !a.is_empty());
    if let Some(area) = &goal.area_id
        && !areas::is_active(conn, area)?
    {
        return Err(AppError::invalid("areaId", "unknownArea"));
    }
    goal.target_date = match input.target_date.as_deref().filter(|d| !d.is_empty()) {
        Some(d) => Some(normalize_date("targetDate", d)?),
        None => None,
    };
    Ok(())
}

fn active(conn: &Connection, id: &str) -> AppResult<Goal> {
    match repo::get_goal(conn, id)? {
        Some((goal, false)) => Ok(goal),
        _ => Err(AppError::NotFound),
    }
}

pub fn list(conn: &Connection) -> AppResult<Vec<GoalProgress>> {
    let mut out = Vec::new();
    for goal in repo::list_goals(conn)? {
        let mut milestones = Vec::new();
        for milestone in repo::list_milestones(conn, &goal.id)? {
            let (done, total) = repo::milestone_counts(conn, &milestone.id)?;
            milestones.push(MilestoneProgress {
                milestone,
                done,
                total,
            });
        }
        let done = milestones.iter().map(|m| m.done).sum();
        let total = milestones.iter().map(|m| m.total).sum();
        out.push(GoalProgress {
            goal,
            milestones,
            done,
            total,
        });
    }
    Ok(out)
}

pub fn create(conn: &Connection, input: &GoalInput) -> AppResult<Goal> {
    let mut goal = Goal {
        id: new_id(),
        title: String::new(),
        description: None,
        area_id: None,
        target_date: None,
        achieved_at: None,
    };
    apply(conn, &mut goal, input)?;
    repo::insert_goal(conn, &goal, &now_utc())?;
    Ok(goal)
}

pub fn update(conn: &Connection, id: &str, input: &GoalInput) -> AppResult<Goal> {
    let mut goal = active(conn, id)?;
    apply(conn, &mut goal, input)?;
    repo::update_goal(conn, &goal, &now_utc())?;
    Ok(goal)
}

/// "Achieved" (or not any more).
pub fn set_achieved(conn: &Connection, id: &str, achieved: bool) -> AppResult<Goal> {
    let mut goal = active(conn, id)?;
    goal.achieved_at = achieved.then(now_utc);
    repo::update_goal(conn, &goal, &now_utc())?;
    Ok(goal)
}

/// Soft delete with Undo. Linked tasks keep their link; the goal just isn't shown.
pub fn set_deleted(conn: &Connection, id: &str, deleted: bool) -> AppResult<()> {
    repo::get_goal(conn, id)?.ok_or(AppError::NotFound)?;
    let now = now_utc();
    repo::set_goal_deleted(conn, id, deleted.then_some(now.as_str()), &now)?;
    Ok(())
}

pub fn add_milestone(conn: &Connection, goal_id: &str, title: &str) -> AppResult<Milestone> {
    active(conn, goal_id)?;
    let order = repo::list_milestones(conn, goal_id)?
        .iter()
        .map(|m| m.sort_order + 1)
        .max()
        .unwrap_or(0);
    let milestone = Milestone {
        id: new_id(),
        goal_id: goal_id.to_owned(),
        title: clean_title(title)?,
        target_date: None,
        sort_order: order,
    };
    repo::insert_milestone(conn, &milestone, &now_utc())?;
    Ok(milestone)
}

pub fn rename_milestone(conn: &Connection, id: &str, title: &str) -> AppResult<()> {
    if repo::rename_milestone(conn, id, &clean_title(title)?, &now_utc())? == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn set_milestone_deleted(conn: &Connection, id: &str, deleted: bool) -> AppResult<()> {
    let now = now_utc();
    if repo::set_milestone_deleted(conn, id, deleted.then_some(now.as_str()), &now)? == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;
    use crate::models::inputs::ItemInput;
    use crate::models::item::ItemKind;
    use crate::services::items;

    fn goal_input(title: &str) -> GoalInput {
        GoalInput {
            title: title.into(),
            description: None,
            area_id: None,
            target_date: Some("2030-06-01".into()),
        }
    }

    fn task(c: &mut Connection, title: &str, milestone: Option<&str>) -> String {
        items::create(
            c,
            &ItemInput {
                kind: ItemKind::Task,
                title: title.into(),
                notes: None,
                area_id: None,
                priority: 0,
                start_at: None,
                end_at: None,
                due_date: None,
                location: None,
                source: None,
                reminders: Some(vec![]),
                rrule: None,
                milestone_id: milestone.map(Into::into),
            },
        )
        .unwrap()
        .id
    }

    #[test]
    fn progress_counts_linked_tasks() {
        let mut c = migrated_conn();
        let g = create(&c, &goal_input("Run a 10k")).unwrap();
        let m1 = add_milestone(&c, &g.id, "Run 5k").unwrap();
        let m2 = add_milestone(&c, &g.id, "Run 8k").unwrap();
        let a = task(&mut c, "Week 1", Some(&m1.id));
        task(&mut c, "Week 2", Some(&m1.id));
        task(&mut c, "Week 3", Some(&m2.id));
        task(&mut c, "Unrelated", None);
        items::complete(&mut c, &a).unwrap();

        let p = &list(&c).unwrap()[0];
        assert_eq!((p.done, p.total), (1, 3));
        assert_eq!(
            p.milestones
                .iter()
                .map(|m| (m.done, m.total))
                .collect::<Vec<_>>(),
            [(1, 2), (0, 1)]
        );
        assert_eq!(p.milestones[1].milestone.sort_order, 1);
    }

    #[test]
    fn unknown_or_deleted_milestones_are_refused_on_tasks() {
        let mut c = migrated_conn();
        let g = create(&c, &goal_input("Learn piano")).unwrap();
        let m = add_milestone(&c, &g.id, "Scales").unwrap();
        set_deleted(&c, &g.id, true).unwrap();
        let err = items::create(
            &mut c,
            &ItemInput {
                kind: ItemKind::Task,
                title: "Practice".into(),
                notes: None,
                area_id: None,
                priority: 0,
                start_at: None,
                end_at: None,
                due_date: None,
                location: None,
                source: None,
                reminders: None,
                rrule: None,
                milestone_id: Some(m.id.clone()),
            },
        );
        assert!(err.is_err());
        set_deleted(&c, &g.id, false).unwrap();
        assert_eq!(list(&c).unwrap().len(), 1, "Undo brings it back");
    }

    #[test]
    fn validation_achieve_and_rename() {
        let c = migrated_conn();
        assert!(create(&c, &goal_input(" ")).is_err());
        assert!(
            create(
                &c,
                &GoalInput {
                    target_date: Some("soon".into()),
                    ..goal_input("X")
                }
            )
            .is_err()
        );
        let g = create(&c, &goal_input("Write a book")).unwrap();
        assert!(set_achieved(&c, &g.id, true).unwrap().achieved_at.is_some());
        let m = add_milestone(&c, &g.id, "Outline").unwrap();
        rename_milestone(&c, &m.id, "Full outline").unwrap();
        assert_eq!(
            list(&c).unwrap()[0].milestones[0].milestone.title,
            "Full outline"
        );
        set_milestone_deleted(&c, &m.id, true).unwrap();
        assert!(list(&c).unwrap()[0].milestones.is_empty());
    }
}
