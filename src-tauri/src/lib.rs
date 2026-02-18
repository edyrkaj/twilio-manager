use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Credentials {
    pub account_sid: String,
    pub auth_token: String,
    pub from_number: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TwilioMessage {
    pub sid: String,
    pub body: String,
    pub from: String,
    pub to: String,
    pub date_created: String,
    pub date_sent: Option<String>,
    pub direction: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
struct TwilioMessagesResponse {
    messages: Vec<TwilioMessage>,
}

fn get_config_path() -> Result<std::path::PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Cannot find home directory".to_string())?;
    let dir = std::path::PathBuf::from(home).join(".twilio-manager");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("credentials.json"))
}

#[tauri::command]
async fn save_credentials(credentials: Credentials) -> Result<(), String> {
    let config_path = get_config_path()?;
    let json = serde_json::to_string_pretty(&credentials).map_err(|e| e.to_string())?;
    fs::write(&config_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn load_credentials() -> Result<Option<Credentials>, String> {
    let config_path = get_config_path()?;
    if !config_path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let creds: Credentials = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(Some(creds))
}

#[tauri::command]
async fn get_messages(credentials: Credentials) -> Result<Vec<TwilioMessage>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json?PageSize=100",
        credentials.account_sid
    );

    let response = client
        .get(&url)
        .basic_auth(&credentials.account_sid, Some(&credentials.auth_token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Twilio API error {}: {}", status, body));
    }

    let data: TwilioMessagesResponse = response.json().await.map_err(|e| e.to_string())?;
    Ok(data.messages)
}

#[tauri::command]
async fn send_message(
    credentials: Credentials,
    to: String,
    body: String,
) -> Result<TwilioMessage, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
        credentials.account_sid
    );

    let params = [
        ("To", to.as_str()),
        ("From", credentials.from_number.as_str()),
        ("Body", body.as_str()),
    ];

    let response = client
        .post(&url)
        .basic_auth(&credentials.account_sid, Some(&credentials.auth_token))
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body_text = response.text().await.unwrap_or_default();
        return Err(format!("Twilio API error {}: {}", status, body_text));
    }

    let msg: TwilioMessage = response.json().await.map_err(|e| e.to_string())?;
    Ok(msg)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_credentials,
            load_credentials,
            get_messages,
            send_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
