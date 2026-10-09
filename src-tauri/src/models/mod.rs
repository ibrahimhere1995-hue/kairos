//! Data shapes shared with the frontend. TypeScript types are generated from these
//! into `src/types/` by ts-rs when `cargo test` runs (field names are camelCase).

pub mod area;
pub mod attachment;
pub mod backup;
pub mod checklist;
pub mod dashboard;
pub mod habit;
pub mod inputs;
pub mod item;
pub mod reminder;
pub mod settings;
