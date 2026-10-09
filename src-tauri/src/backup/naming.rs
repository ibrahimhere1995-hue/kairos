//! Backup file names: `kairos-<label>-YYYYMMDD-HHMMSS.mmm.db` (UTC time).

use chrono::{DateTime, NaiveDateTime, Utc};

const PREFIX: &str = "kairos-";
const EXT: &str = ".db";
const STAMP_FORMAT: &str = "%Y%m%d-%H%M%S%.3f";
const STAMP_LEN: usize = 19; // 20261008-101530.123

pub const LABEL_AUTO: &str = "auto";
pub const LABEL_MANUAL: &str = "manual";
pub const LABEL_PRE_RESTORE: &str = "pre-restore";
pub const LABEL_PRE_MIGRATION: &str = "pre-migration";
pub const LABEL_PRE_PURGE: &str = "pre-purge";
/// Before importing a calendar file (P2-T12): many items arrive at once.
pub const LABEL_PRE_IMPORT: &str = "pre-import";

pub fn file_name(label: &str, at: DateTime<Utc>) -> String {
    format!("{PREFIX}{label}-{}{EXT}", at.format(STAMP_FORMAT))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedName {
    pub label: String,
    pub created_at: DateTime<Utc>,
}

/// Parses a backup file name. Anything else (other files, paths, `..`) is rejected,
/// which also makes it safe to use as the only input to a restore.
pub fn parse(name: &str) -> Option<ParsedName> {
    let rest = name.strip_prefix(PREFIX)?.strip_suffix(EXT)?;
    if rest.len() < STAMP_LEN + 2 || !rest.is_ascii() {
        return None;
    }
    let (label_part, stamp) = rest.split_at(rest.len() - STAMP_LEN);
    let label = label_part.strip_suffix('-')?;
    let valid_label = !label.is_empty()
        && !label.starts_with('-')
        && label.chars().all(|c| c.is_ascii_lowercase() || c == '-');
    if !valid_label {
        return None;
    }
    let created_at = NaiveDateTime::parse_from_str(stamp, STAMP_FORMAT)
        .ok()?
        .and_utc();
    Some(ParsedName {
        label: label.to_owned(),
        created_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn round_trips_names() {
        let at = Utc.with_ymd_and_hms(2026, 10, 8, 10, 15, 30).unwrap();
        let name = file_name(LABEL_PRE_RESTORE, at);
        assert_eq!(name, "kairos-pre-restore-20261008-101530.000.db");
        assert_eq!(
            parse(&name),
            Some(ParsedName {
                label: "pre-restore".into(),
                created_at: at
            })
        );
    }

    #[test]
    fn rejects_anything_that_is_not_a_backup_name() {
        for bad in [
            "kairos.db",
            "kairos-auto-.db",
            "kairos--20261008-101530.000.db",
            "../kairos-auto-20261008-101530.000.db",
            "kairos-auto-20261008-101530.000.db.exe",
            "kairos-AUTO-20261008-101530.000.db",
            "kairos-auto-2026100x-101530.000.db",
            "other-auto-20261008-101530.000.db",
        ] {
            assert!(parse(bad).is_none(), "{bad} must be rejected");
        }
    }
}
