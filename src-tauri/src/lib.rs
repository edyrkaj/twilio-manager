use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Credentials {
    pub account_sid: String,
    pub auth_token: String,
    pub from_number: String,
    #[serde(default)]
    pub whatsapp_from_number: String,
}

fn format_address(channel: &str, address: &str) -> String {
    let stripped = address
        .trim()
        .strip_prefix("whatsapp:")
        .unwrap_or(address.trim());
    if channel == "whatsapp" {
        format!("whatsapp:{}", stripped)
    } else {
        stripped.to_string()
    }
}

fn from_number_for_channel(
    credentials: &Credentials,
    channel: &str,
) -> Result<String, String> {
    if channel == "whatsapp" {
        let number = credentials.whatsapp_from_number.trim();
        if number.is_empty() {
            return Err("WhatsApp from number is not configured".to_string());
        }
        Ok(format_address("whatsapp", number))
    } else {
        Ok(format_address("sms", &credentials.from_number))
    }
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
    if config_path.exists() {
        let json = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        let creds: Credentials = serde_json::from_str(&json).map_err(|e| e.to_string())?;
        return Ok(Some(creds));
    }
    Ok(load_env_credentials())
}

// Load credentials from environment variables, trying .env files first.
// Checked locations (in order):
//   1. .env in the current working directory
//   2. ~/.twilio-manager/.env
// Variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER,
//            TWILIO_WHATSAPP_FROM_NUMBER (optional)
fn load_env_credentials() -> Option<Credentials> {
    // Try CWD/.env
    dotenvy::dotenv().ok();

    // Try ~/.twilio-manager/.env as a fallback
    if let Ok(home) = std::env::var("HOME") {
        let env_path = std::path::PathBuf::from(home)
            .join(".twilio-manager")
            .join(".env");
        if env_path.exists() {
            dotenvy::from_path(env_path).ok();
        }
    }

    let account_sid = std::env::var("TWILIO_ACCOUNT_SID").ok()?;
    let auth_token = std::env::var("TWILIO_AUTH_TOKEN").ok()?;
    let from_number = std::env::var("TWILIO_FROM_NUMBER").ok()?;

    Some(Credentials {
        account_sid,
        auth_token,
        from_number,
        whatsapp_from_number: std::env::var("TWILIO_WHATSAPP_FROM_NUMBER")
            .unwrap_or_default(),
    })
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
    channel: String,
) -> Result<TwilioMessage, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
        credentials.account_sid
    );

    let from = from_number_for_channel(&credentials, &channel)?;
    let to = format_address(&channel, &to);
    let params = [
        ("To", to.as_str()),
        ("From", from.as_str()),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_whatsapp_address_from_bare_number() {
        assert_eq!(
            format_address("whatsapp", "+15557318728"),
            "whatsapp:+15557318728"
        );
    }

    #[test]
    fn does_not_double_prefix_whatsapp_addresses() {
        assert_eq!(
            format_address("whatsapp", "whatsapp:+15557318728"),
            "whatsapp:+15557318728"
        );
    }

    #[test]
    fn strips_whatsapp_prefix_for_sms() {
        assert_eq!(format_address("sms", "whatsapp:+15551234567"), "+15551234567");
    }

    #[test]
    fn whatsapp_from_requires_configured_number() {
        let creds = Credentials {
            account_sid: "AC".into(),
            auth_token: "tok".into(),
            from_number: "+111".into(),
            whatsapp_from_number: "".into(),
        };
        assert!(from_number_for_channel(&creds, "whatsapp").is_err());
    }

    #[test]
    fn whatsapp_from_uses_whatsapp_number() {
        let creds = Credentials {
            account_sid: "AC".into(),
            auth_token: "tok".into(),
            from_number: "+111".into(),
            whatsapp_from_number: "+15557318728".into(),
        };
        assert_eq!(
            from_number_for_channel(&creds, "whatsapp").unwrap(),
            "whatsapp:+15557318728"
        );
    }

    #[test]
    fn credentials_json_without_whatsapp_number_defaults_empty() {
        let json = r#"{"account_sid":"AC","auth_token":"tok","from_number":"+111"}"#;
        let creds: Credentials = serde_json::from_str(json).unwrap();
        assert_eq!(creds.whatsapp_from_number, "");
    }
}
