// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{atomic::{AtomicU64, Ordering}, Mutex};
use tauri::Manager;

const DDRAGON_VERSION: &str = "16.1.1";

struct MlProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl MlProcess {
    fn start(python_ml_dir: &Path, db_path: &Path) -> Result<Self, String> {
        let venv_python = python_ml_dir.join(".venv").join("Scripts").join("python.exe");
        let python = if venv_python.exists() {
            venv_python
        } else {
            PathBuf::from("python")
        };

        let mut cmd = Command::new(python);
        cmd.current_dir(python_ml_dir)
            .arg("-u")
            .arg("ml_server.py")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .env("ATOMGG_DB_FILE", db_path);

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn ML server: {e}"))?;
        let stdin = child.stdin.take().ok_or("Failed to open ML stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open ML stdout")?;

        Ok(Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        })
    }

    fn send(&mut self, value: serde_json::Value) -> Result<serde_json::Value, String> {
        let line = serde_json::to_string(&value).map_err(|e| e.to_string())?;
        self.stdin
            .write_all(line.as_bytes())
            .and_then(|_| self.stdin.write_all(b"\n"))
            .and_then(|_| self.stdin.flush())
            .map_err(|e| format!("Failed writing to ML stdin: {e}"))?;

        let mut resp = String::new();
        self.stdout
            .read_line(&mut resp)
            .map_err(|e| format!("Failed reading ML stdout: {e}"))?;

        let resp = resp.trim();
        if resp.is_empty() {
            return Err("Empty response from ML process".to_string());
        }

        serde_json::from_str(resp).map_err(|e| format!("Invalid ML JSON response: {e}"))
    }
}

struct MlState {
    process: Mutex<Option<MlProcess>>,
    next_id: AtomicU64,
}

impl MlState {
    fn new() -> Self {
        Self {
            process: Mutex::new(None),
            next_id: AtomicU64::new(1),
        }
    }
}

fn find_python_ml_dir() -> Result<PathBuf, String> {
    let mut dir = std::env::current_dir().map_err(|e| e.to_string())?;
    for _ in 0..8 {
        let candidate = dir.join("python-ml").join("ml_server.py");
        if candidate.exists() {
            return Ok(dir.join("python-ml"));
        }
        if let Some(parent) = dir.parent() {
            dir = parent.to_path_buf();
        } else {
            break;
        }
    }
    Err("Could not locate python-ml/ml_server.py from current working directory".to_string())
}

fn find_db_path(python_ml_dir: &Path) -> PathBuf {
    // default used by ml_server.py as well
    python_ml_dir
        .join("..")
        .join("src-tauri")
        .join("src")
        .join("esports_data.db")
}

fn ml_ensure_started(state: &tauri::State<MlState>) -> Result<(), String> {
    let mut guard = state.process.lock().map_err(|_| "ML state poisoned".to_string())?;
    if guard.is_some() {
        return Ok(());
    }

    let python_ml_dir = find_python_ml_dir()?;
    let db_path = find_db_path(&python_ml_dir);
    let proc = MlProcess::start(&python_ml_dir, &db_path)?;
    *guard = Some(proc);
    Ok(())
}

fn ml_send(state: &tauri::State<MlState>, msg_type: &str, payload: serde_json::Value) -> Result<serde_json::Value, String> {
    ml_ensure_started(state)?;

    let request_id = state.next_id.fetch_add(1, Ordering::Relaxed);

    let mut obj = match payload {
        serde_json::Value::Object(map) => map,
        _ => return Err("ml_send payload must be a JSON object".to_string()),
    };
    obj.insert("request_id".to_string(), json!(request_id));
    obj.insert("type".to_string(), json!(msg_type));
    let req = serde_json::Value::Object(obj);

    let mut guard = state.process.lock().map_err(|_| "ML state poisoned".to_string())?;
    let proc = guard.as_mut().ok_or("ML process missing")?;
    proc.send(req)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChampionShort {
    pub name: String,
    pub id: String,
    pub icon: String,
    pub splash: String,
}

#[derive(Deserialize)]
struct DDragonResponse {
    data: HashMap<String, ChampionData>,
}

#[derive(Deserialize)]
struct ChampionData {
    name: String,
    id: String,
}

#[tauri::command]
async fn get_all_champions() -> Result<Vec<ChampionShort>, String> {
    let url = format!("https://ddragon.leagueoflegends.com/cdn/{}/data/en_US/champion.json", DDRAGON_VERSION);

    let response = reqwest::get(url)
        .await
        .map_err(|e| e.to_string())?
        .json::<DDragonResponse>()
        .await
        .map_err(|e| e.to_string())?;

    let champions = response.data
        .into_values()
        .map(|champ| ChampionShort {
            name: champ.name.clone(),
            id: champ.id.clone(),
            icon: get_champion_icon(champ.id.clone()),
            splash: get_champion_splash(champ.id),
        })
        .collect();

    Ok(champions)
}

#[tauri::command]
fn get_champion_icon(id: String) -> String {
    format!("https://cdn.communitydragon.org/latest/champion/{}/square", id)
}

#[tauri::command]
fn get_champion_splash(id: String) -> String {
    format!("https://cdn.communitydragon.org/latest/champion/{}/splash-art", id)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TeamPlayers {
    pub team: String,
    pub top: String,
    pub jungle: String,
    pub mid: String,
    pub adc: String,
    pub utility: String,
}

#[tauri::command]
fn get_team_players(team_name: String) -> Result<TeamPlayers, String> {
    let db_path = "src/esports_data.db";
    let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;

    let views = ["view_lck", "view_lpl", "view_lcs", "view_lec"];

    for view in views {
        let query = format!("SELECT team, top, jungle, mid, adc, utility FROM {} WHERE team = ?1 COLLATE NOCASE", view);
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
        let mut rows = stmt.query([&team_name]).map_err(|e| e.to_string())?;

        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            return Ok(TeamPlayers {
                team: row.get(0).map_err(|e| e.to_string())?,
                top: row.get(1).map_err(|e| e.to_string())?,
                jungle: row.get(2).map_err(|e| e.to_string())?,
                mid: row.get(3).map_err(|e| e.to_string())?,
                adc: row.get(4).map_err(|e| e.to_string())?,
                utility: row.get(5).map_err(|e| e.to_string())?,
            });
        }
    }

    Err(format!("Team {} not found in any league", team_name))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MlInitConfig {
    team1: String,
    team2: String,
    is_team1_blue: bool,
    mode: String,
    num_games: u8,
}

#[tauri::command]
fn ml_init(state: tauri::State<MlState>, config: MlInitConfig) -> Result<serde_json::Value, String> {
    let blue_team = if config.is_team1_blue {
        config.team1.clone()
    } else {
        config.team2.clone()
    };
    let red_team = if config.is_team1_blue {
        config.team2.clone()
    } else {
        config.team1.clone()
    };

    ml_send(
        &state,
        "init",
        json!({
            "config": {
                "mode": config.mode,
                "numGames": config.num_games,
                "blueTeam": blue_team,
                "redTeam": red_team
            }
        }),
    )
}

#[tauri::command]
fn ml_set_sides(state: tauri::State<MlState>, blueTeam: String, redTeam: String) -> Result<serde_json::Value, String> {
    // Update team names without resetting series/history.
    let _ = ml_send(&state, "set_team", json!({"side": "BLUE", "name": blueTeam.clone()}))?;
    let _ = ml_send(&state, "set_team", json!({"side": "RED", "name": redTeam.clone()}))?;
    // Reload rosters (keeps existing SQL logic)
    let _ = ml_send(&state, "roster", json!({"side": "BLUE", "team": blueTeam}))?;
    let res = ml_send(&state, "roster", json!({"side": "RED", "team": redTeam}))?;
    Ok(res)
}

#[tauri::command]
fn ml_pick(state: tauri::State<MlState>, side: String, champion: String) -> Result<serde_json::Value, String> {
    let side = side.to_uppercase();
    let side = if side.starts_with('B') { "BLUE" } else { "RED" };
    ml_send(&state, "pick", json!({"side": side, "champion": champion}))
}

#[tauri::command]
fn ml_ban(state: tauri::State<MlState>, champion: String) -> Result<serde_json::Value, String> {
    ml_send(&state, "ban", json!({"champion": champion}))
}

#[tauri::command]
fn ml_next_game(state: tauri::State<MlState>) -> Result<serde_json::Value, String> {
    ml_send(&state, "next_game", json!({}))
}

#[tauri::command]
fn ml_suggest(
    state: tauri::State<MlState>,
    targetSide: String,
    isBanMode: bool,
    roles: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    let target_side = targetSide.to_uppercase();
    ml_send(
        &state,
        "suggest",
        json!({
            "target_side": target_side,
            "is_ban_mode": isBanMode,
            "roles": roles
        }),
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MlState::new())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Proactively start ML in the background so the drafter doesn't pay spawn cost.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let state = handle.state::<MlState>();
                if let Err(e) = ml_ensure_started(&state) {
                    eprintln!("Failed to start ML process at startup: {e}");
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_all_champions, 
            get_champion_icon, 
            get_champion_splash,
            get_team_players,
            ml_init,
            ml_set_sides,
            ml_pick,
            ml_ban,
            ml_next_game,
            ml_suggest
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_ddragon_response() {
        let json_data = r#"
        {
          "type": "champion",
          "format": "standAloneComplex",
          "version": "16.1.1",
          "data": {
            "Aatrox": {
              "version": "16.1.1",
              "id": "Aatrox",
              "key": "266",
              "name": "Aatrox",
              "title": "the Darkin Blade",
              "blurb": "Once honored defenders...",
              "info": {
                "attack": 8,
                "defense": 4,
                "magic": 3,
                "difficulty": 4
              },
              "image": {
                "full": "Aatrox.png",
                "sprite": "champion0.png",
                "group": "champion",
                "x": 0,
                "y": 0,
                "w": 48,
                "h": 48
              },
              "tags": [
                "Fighter"
              ],
              "partype": "Blood Well",
              "stats": {
                "hp": 650,
                "hpperlevel": 114,
                "mp": 0,
                "mpperlevel": 0,
                "movespeed": 345,
                "armor": 38,
                "armorperlevel": 4.8,
                "spellblock": 32,
                "spellblockperlevel": 2.05,
                "attackrange": 175,
                "hpregen": 3,
                "hpregenperlevel": 0.5,
                "mpregen": 0,
                "mpregenperlevel": 0,
                "crit": 0,
                "critperlevel": 0,
                "attackdamage": 60,
                "attackdamageperlevel": 5,
                "attackspeedperlevel": 2.5,
                "attackspeed": 0.651
              }
            }
          }
        }
        "#;

        let response: DDragonResponse = serde_json::from_str(json_data).unwrap();
        assert!(response.data.contains_key("Aatrox"));
        let aatrox_data = &response.data["Aatrox"];
        
        let aatrox = ChampionShort {
            name: aatrox_data.name.clone(),
            id: aatrox_data.id.clone(),
            icon: get_champion_icon(aatrox_data.id.clone()),
            splash: get_champion_splash(aatrox_data.id.clone()),
        };

        assert_eq!(aatrox.name, "Aatrox");
        assert_eq!(aatrox.id, "Aatrox");
        assert_eq!(aatrox.icon, "https://ddragon.leagueoflegends.com/cdn/16.1.1/img/champion/Aatrox.png");
        assert_eq!(aatrox.splash, "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_0.jpg");
    }
}
