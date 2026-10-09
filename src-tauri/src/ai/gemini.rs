//! Google Gemini over HTTPS (TECH_STACK: the user's own free-tier key).

use std::time::Duration;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

use crate::ai::{AiProvider, Part};
use crate::error::{AppError, AppResult};
use crate::util::base64;

const BASE: &str = "https://generativelanguage.googleapis.com/v1beta";
const MODEL: &str = "gemini-2.5-flash";
/// ARCHITECTURE §6.5: never wait longer than this.
const TIMEOUT: Duration = Duration::from_secs(20);

pub struct Gemini {
    client: Client,
    key: String,
}

impl Gemini {
    pub fn new(key: String) -> AppResult<Self> {
        let client = Client::builder()
            .timeout(TIMEOUT)
            .build()
            .map_err(|_| AppError::Ai("failed"))?;
        Ok(Self { client, key })
    }

    /// A tiny request that only succeeds with a working key.
    pub async fn check_key(&self) -> AppResult<()> {
        let response = self
            .client
            .get(format!("{BASE}/models?pageSize=1"))
            .header("x-goog-api-key", &self.key)
            .send()
            .await
            .map_err(network_error)?;
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        check_status(status, &body)
    }
}

fn network_error(error: reqwest::Error) -> AppError {
    if error.is_timeout() {
        AppError::Ai("timeout")
    } else {
        AppError::Ai("offline")
    }
}

/// Plain reasons the user can act on; details never leave Rust.
fn check_status(status: StatusCode, body: &str) -> AppResult<()> {
    if status.is_success() {
        return Ok(());
    }
    Err(AppError::Ai(match status.as_u16() {
        400 if body.contains("API_KEY_INVALID") => "badKey",
        401 | 403 => "badKey",
        429 => "busy",
        _ => "failed",
    }))
}

/// The model's answer: the text of the first candidate, parsed as JSON.
fn answer(body: &Value) -> AppResult<Value> {
    let text = body
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(Value::as_str)
        .ok_or(AppError::Ai("unreadable"))?;
    serde_json::from_str(text).map_err(|_| AppError::Ai("unreadable"))
}

impl AiProvider for Gemini {
    async fn generate_json(&self, parts: &[Part], schema: &Value) -> AppResult<Value> {
        let parts: Vec<Value> = parts
            .iter()
            .map(|part| match part {
                Part::Text(text) => json!({ "text": text }),
                Part::Image { mime, bytes } => {
                    json!({ "inline_data": { "mime_type": mime, "data": base64(bytes) } })
                }
            })
            .collect();
        let request = json!({
            "contents": [{ "parts": parts }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": schema,
                "temperature": 0,
            },
        });
        let response = self
            .client
            .post(format!("{BASE}/models/{MODEL}:generateContent"))
            .header("x-goog-api-key", &self.key)
            .json(&request)
            .send()
            .await
            .map_err(network_error)?;
        let status = response.status();
        let body = response.text().await.map_err(network_error)?;
        check_status(status, &body)?;
        let value: Value = serde_json::from_str(&body).map_err(|_| AppError::Ai("unreadable"))?;
        answer(&value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explains_failures_plainly() {
        let reason = |status: u16, body: &str| match check_status(
            StatusCode::from_u16(status).unwrap(),
            body,
        ) {
            Err(AppError::Ai(reason)) => reason,
            _ => "ok",
        };
        assert_eq!(reason(200, ""), "ok");
        assert_eq!(reason(400, "{\"reason\":\"API_KEY_INVALID\"}"), "badKey");
        assert_eq!(reason(400, "bad schema"), "failed");
        assert_eq!(reason(403, ""), "badKey");
        assert_eq!(reason(429, ""), "busy");
        assert_eq!(reason(503, ""), "failed");
    }

    #[test]
    fn reads_the_first_answer() {
        let body = json!({ "candidates": [{ "content": { "parts": [{ "text": "{\"title\":\"Call mum\"}" }] } }] });
        assert_eq!(answer(&body).unwrap(), json!({ "title": "Call mum" }));
        assert!(matches!(
            answer(&json!({})),
            Err(AppError::Ai("unreadable"))
        ));
        let not_json = json!({ "candidates": [{ "content": { "parts": [{ "text": "sorry" }] } }] });
        assert!(answer(&not_json).is_err());
    }
}
