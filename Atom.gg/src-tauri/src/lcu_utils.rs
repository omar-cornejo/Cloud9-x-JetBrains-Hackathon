use std::path::PathBuf;
use std::fs;
use sysinfo::{ProcessExt, System, SystemExt};
use base64::{Engine as _, engine::general_purpose};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LcuInfo {
    pub port: String,
    pub password: String,
    pub auth_header: String,
}

pub fn find_lockfile() -> Option<PathBuf> {
    //default path, if not check process?
    let default_path = PathBuf::from(r"C:\Riot Games\League of Legends\lockfile");
    if default_path.exists() {
        return Some(default_path);
    }

    let mut sys = System::new_all();
    sys.refresh_processes();

    for process in sys.processes().values() {
        if process.name() == "LeagueClient.exe" {
            if let Some(parent) = process.exe().parent() {
                let lockfile_path = parent.join("lockfile");
                if lockfile_path.exists() {
                    return Some(lockfile_path);
                }
            }
        }
    }

    None
}

pub fn parse_lockfile(path: PathBuf) -> Option<LcuInfo> {
    let contents = fs::read_to_string(path).ok()?;
    let parts: Vec<&str> = contents.split(':').collect();

    if parts.len() >= 5 {
        let port = parts[2].to_string();
        let password = parts[3].to_string();
        let auth = format!("riot:{}", password);
        let auth_header = format!("Basic {}", general_purpose::STANDARD.encode(auth));

        Some(LcuInfo {
            port,
            password,
            auth_header,
        })
    } else {
        None
    }
}

pub fn get_lcu_client() -> Result<(reqwest::Client, LcuInfo), String> {
    let lockfile_path = find_lockfile()
        .ok_or("League of Legends lockfile not found. Is the client running?")?;
    let lcu_info = parse_lockfile(lockfile_path)
        .ok_or("Failed to parse lockfile")?;

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok((client, lcu_info))
}

pub async fn get_champ_select_session(
    client: &reqwest::Client,
    lcu_info: &LcuInfo,
) -> Result<serde_json::Value, String> {
    let session_url = format!(
        "https://127.0.0.1:{}/lol-champ-select/v1/session",
        lcu_info.port
    );

    let session_response = client
        .get(&session_url)
        .header("Authorization", &lcu_info.auth_header)
        .send()
        .await
        .map_err(|e| format!("Failed to get session: {}", e))?;

    if !session_response.status().is_success() {
        return Err("Not in champion select".to_string());
    }

    session_response
        .json()
        .await
        .map_err(|e| e.to_string())
}

pub async fn find_local_player_action(
    client: &reqwest::Client,
    lcu_info: &LcuInfo,
    action_type: &str,
) -> Result<(i64, Option<i64>), String> {
    let session = get_champ_select_session(client, lcu_info).await?;

    let local_cell_id = session["localPlayerCellId"]
        .as_i64()
        .ok_or("Failed to get local player cell ID")?;

    let actions = session["actions"]
        .as_array()
        .ok_or("No actions found")?;

    for action_group in actions {
        if let Some(group) = action_group.as_array() {
            for action in group {
                if action["actorCellId"].as_i64() == Some(local_cell_id)
                    && action["type"].as_str() == Some(action_type)
                {
                    let action_id = action["id"]
                        .as_i64()
                        .ok_or("Failed to get action ID")?;
                    let champion_id = action["championId"].as_i64();
                    return Ok((action_id, champion_id));
                }
            }
        }
    }

    Err(format!("Could not find your {} action", action_type))
}

pub async fn find_local_player_pick_action(
    client: &reqwest::Client,
    lcu_info: &LcuInfo,
) -> Result<(i64, Option<i64>), String> {
    find_local_player_action(client, lcu_info, "pick").await
}

pub async fn find_local_player_ban_action(
    client: &reqwest::Client,
    lcu_info: &LcuInfo,
) -> Result<(i64, Option<i64>), String> {
    find_local_player_action(client, lcu_info, "ban").await
}