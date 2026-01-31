import requests
import json
import time
import os
import sqlite3
from dotenv import load_dotenv

load_dotenv()

API_URL = "https://api-op.grid.gg/central-data/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "x-api-key": os.getenv("GRID_API_KEY")
}
DB_NAME = "esports_data.db"

QUERY_ROSTER = """
query Roster($teamId: ID, $after: String) {
  players(
    filter: {
      teamIdFilter: {
        id: $teamId
      }
    }
    first: 50
    after: $after
  ) {
    edges {
      node {
        id
        nickname
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
"""

def init_player_table():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            nickname TEXT,
            team_id TEXT, 
            FOREIGN KEY(team_id) REFERENCES teams(id)
        )
    ''')
    conn.commit()
    return conn

def get_team_ids(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM teams")
    return cursor.fetchall()

def fetch_players_for_team(team_id):
    players = []
    has_next_page = True
    cursor = None
    
    while has_next_page:
        variables = {
            "teamId": team_id,
            "after": cursor
        }

        try:
            response = requests.post(
                API_URL,
                json={'query': QUERY_ROSTER, 'variables': variables},
                headers=HEADERS,
                timeout=5
            )

            if response.status_code != 200:
                print(f"Error HTTP {response.status_code}")
                return []

            data = response.json()
            
            if 'errors' in data:
                break

            player_data = data['data']['players']
            edges = player_data['edges']
            page_info = player_data['pageInfo']

            for edge in edges:
                node = edge['node']
                players.append({
                    "id": node['id'],
                    "nickname": node['nickname']
                })

            cursor = page_info['endCursor']
            has_next_page = page_info['hasNextPage']

        except Exception as e:
            print(f"Excepción: {e}")
            break
            
    return players

def save_players(conn, players_list, team_id):
    cursor = conn.cursor()
    for player in players_list:
        cursor.execute('''
            INSERT OR REPLACE INTO players (id, nickname, team_id)
            VALUES (?, ?, ?)
        ''', (player['id'], player['nickname'], team_id))
    conn.commit()

def main():
    conn = init_player_table()

    teams = get_team_ids(conn)
    total_teams = len(teams)

    print(f"Iniciando búsqueda de jugadores para {total_teams} equipos...")

    total_players_saved = 0

    for index, (team_id, team_name) in enumerate(teams):
        print(f"[{index + 1}/{total_teams}] Buscando roster de: {team_name} (ID: {team_id})...", end="", flush=True)

        roster = fetch_players_for_team(team_id)
        
        if roster:
            save_players(conn, roster, team_id)
            print(f" {len(roster)} jugadores guardados.")
            total_players_saved += len(roster)
        else:
            print(" Sin jugadores.")

        time.sleep(2)

    conn.close()
    print(f"\nProceso finalizado.")
    print(f"Total de jugadores insertados en la BD: {total_players_saved}")

if __name__ == "__main__":
    main()
