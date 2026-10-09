//! Smart (AI) features (PRD §7.3, ARCHITECTURE §9). Optional: nothing here runs until the
//! user has agreed to the consent screen and added their own Gemini key. Only the data a
//! single request needs is sent; the key lives in the OS keychain only.

pub mod gemini;
pub mod image;
pub mod parse;
pub mod plan;
pub mod secrets;

use std::future::Future;

use serde_json::Value;

use crate::error::AppResult;

/// One piece of a request: words, or a picture (A1).
pub enum Part {
    Text(String),
    Image { mime: &'static str, bytes: Vec<u8> },
}

/// Something that answers a prompt with JSON matching `schema`. Gemini today; a local model
/// can be added later without touching the features.
pub trait AiProvider {
    fn generate_json(
        &self,
        parts: &[Part],
        schema: &Value,
    ) -> impl Future<Output = AppResult<Value>> + Send;
}
