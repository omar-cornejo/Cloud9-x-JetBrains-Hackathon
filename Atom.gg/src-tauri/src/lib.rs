// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

mod lcu;
mod lcu_utils;

const DDRAGON_VERSION: &str = "16.1.1";

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
    format!("https://ddragon.leagueoflegends.com/cdn/{}/img/champion/{}.png", DDRAGON_VERSION, id)
}

#[tauri::command]
fn get_champion_splash(id: String) -> String {
    format!("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/{}_0.jpg", id)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_all_champions, 
            get_champion_icon, 
            get_champion_splash,
            get_team_players,
            lcu::get_current_summoner,
            lcu::get_random_champion,
            lcu::hover_champion,
            lcu::lock_champion,
            lcu::hover_ban,
            lcu::lock_ban,
            lcu::is_lcu_available
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
