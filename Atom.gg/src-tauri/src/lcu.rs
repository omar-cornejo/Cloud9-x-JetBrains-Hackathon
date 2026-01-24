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

#[derive(Debug, Serialize, Deserialize)]
pub struct Summoner {
    #[serde(rename = "accountId")]
    pub account_id: u64,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "gameName")]
    pub game_name: String,
    pub puuid: String,
    #[serde(rename = "summonerId")]
    pub summoner_id: u64,
    #[serde(rename = "summonerLevel")]
    pub summoner_level: u32,
    #[serde(rename = "tagLine")]
    pub tag_line: String,
}

#[tauri::command]
pub async fn get_current_summoner() -> Result<Summoner, String> {
    let lockfile_path = find_lockfile().ok_or("League of Legends lockfile not found. Is the client running?")?;
    let lcu_info = parse_lockfile(lockfile_path).ok_or("Failed to parse lockfile")?;

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true) //NEEDED for all LCU endpoints!!!!
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://127.0.0.1:{}/lol-summoner/v1/current-summoner", lcu_info.port);

    let response = client.get(url)
        .header("Authorization", lcu_info.auth_header)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let summoner = response.json::<Summoner>().await.map_err(|e| e.to_string())?;
        Ok(summoner)
    } else {
        Err(format!("LCU error: {}", response.status()))
    }
}
