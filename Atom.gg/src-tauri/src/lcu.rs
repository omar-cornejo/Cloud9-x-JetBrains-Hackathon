use serde::{Deserialize, Serialize};
use serde_json::Value;
use rand::Rng;

use crate::lcu_utils::{get_lcu_client, find_local_player_pick_action, find_local_player_ban_action, find_lockfile};

#[tauri::command]
pub fn is_lcu_available() -> bool {
    find_lockfile().is_some()
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

// Hardcoded list of popular champions for POC
const CHAMPION_IDS: &[i32] = &[
    1,   // Annie
    51,  // Caitlyn
    53,  // Blitzcrank
    64,  // Lee Sin
    89,  // Leona
    92,  // Riven
    103, // Ahri
    157, // Yasuo
    202, // Jhin
    221, // Zeri
    238, // Zed
    350, // Yuumi
    555, // Pyke
    777, // Yone
    876, // Lillia
];

#[tauri::command]
pub async fn get_current_summoner() -> Result<Summoner, String> {
    let (client, lcu_info) = get_lcu_client()?;

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

#[tauri::command]
pub async fn get_random_champion() -> Result<i32, String> {
    let mut rng = rand::thread_rng();
    let index = rng.gen_range(0..CHAMPION_IDS.len());
    Ok(CHAMPION_IDS[index])
}

#[tauri::command]
pub async fn hover_champion(champion_id: i32) -> Result<String, String> {
    let (client, lcu_info) = get_lcu_client()?;

    let (action_id, _) = find_local_player_pick_action(&client, &lcu_info).await?;

    let patch_url = format!(
        "https://127.0.0.1:{}/lol-champ-select/v1/session/actions/{}",
        lcu_info.port, action_id
    );

    let body = serde_json::json!({
        "championId": champion_id
    });

    let response = client
        .patch(&patch_url)
        .header("Authorization", &lcu_info.auth_header)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok(format!("Hovered champion ID: {}", champion_id))
    } else {
        Err(format!("Failed to hover champion: {}", response.status()))
    }
}

#[tauri::command]
pub async fn lock_champion() -> Result<String, String> {
    let (client, lcu_info) = get_lcu_client()?;

    let (action_id, champion_id) = find_local_player_pick_action(&client, &lcu_info).await?;

    let champion_id = champion_id.ok_or("No champion selected to lock")?;

    // Use PATCH instead of POST and include the completed flag in the body
    let patch_url = format!(
        "https://127.0.0.1:{}/lol-champ-select/v1/session/actions/{}",
        lcu_info.port, action_id
    );

    let body = serde_json::json!({
        "completed": true,
        "championId": champion_id
    });

    let response = client
        .patch(&patch_url)
        .header("Authorization", &lcu_info.auth_header)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok(format!("Locked champion ID: {}", champion_id))
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Failed to lock champion: {} - {}", status, error_text))
    }
}

#[tauri::command]
pub async fn hover_ban(champion_id: i32) -> Result<String, String> {
    let (client, lcu_info) = get_lcu_client()?;

    let (action_id, _) = find_local_player_ban_action(&client, &lcu_info).await?;

    let patch_url = format!(
        "https://127.0.0.1:{}/lol-champ-select/v1/session/actions/{}",
        lcu_info.port, action_id
    );

    let body = serde_json::json!({
        "championId": champion_id
    });

    let response = client
        .patch(&patch_url)
        .header("Authorization", &lcu_info.auth_header)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok(format!("Hovered ban for champion ID: {}", champion_id))
    } else {
        Err(format!("Failed to hover ban: {}", response.status()))
    }
}

#[tauri::command]
pub async fn lock_ban() -> Result<String, String> {
    let (client, lcu_info) = get_lcu_client()?;

    let (action_id, champion_id) = find_local_player_ban_action(&client, &lcu_info).await?;

    let champion_id = champion_id.ok_or("No champion selected to ban")?;

    let patch_url = format!(
        "https://127.0.0.1:{}/lol-champ-select/v1/session/actions/{}",
        lcu_info.port, action_id
    );

    let body = serde_json::json!({
        "completed": true,
        "championId": champion_id
    });

    let response = client
        .patch(&patch_url)
        .header("Authorization", &lcu_info.auth_header)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok(format!("Locked ban for champion ID: {}", champion_id))
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Failed to lock ban: {} - {}", status, error_text))
    }
}

#[tauri::command]
pub async fn get_champ_select_session() -> Result<Value, String> {
    let (client, lcu_info) = get_lcu_client()?;
    crate::lcu_utils::get_champ_select_session(&client, &lcu_info).await
}