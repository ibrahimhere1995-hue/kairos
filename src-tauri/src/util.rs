use chrono::{SecondsFormat, Utc};

/// New time-sortable, sync-friendly ID (UUID v7).
pub fn new_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

/// Current time as UTC ISO-8601 with milliseconds, e.g. `2026-10-07T09:30:00.000Z`.
pub fn now_utc() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_unique_v7_uuids() {
        let a = new_id();
        let b = new_id();
        assert_ne!(a, b);
        assert_eq!(uuid::Uuid::parse_str(&a).unwrap().get_version_num(), 7);
    }

    #[test]
    fn timestamps_are_utc_iso_8601() {
        let now = now_utc();
        assert!(now.ends_with('Z'), "{now}");
        assert!(chrono::DateTime::parse_from_rfc3339(&now).is_ok());
    }
}
