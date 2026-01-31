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

QUERY = """
query GetTeams($first: Int, $after: String) {
  teams(first: $first, after: $after) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        name
        colorPrimary
        colorSecondary
        logoUrl
        externalLinks {
          dataProvider {
            name
          }
          externalEntity {
            id
          }
        }
      }
    }
  }
}
"""

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            name TEXT,
            color_primary TEXT,
            color_secondary TEXT,
            logo_url TEXT,
            external_entity_id TEXT
        )
    ''')
    conn.commit()
    return conn

def save_batch_to_db(conn, teams_list):
    cursor = conn.cursor()

    for team in teams_list:
        ext_id = None
        if team.get('externalLinks') and len(team['externalLinks']) > 0:
            ext_id = team['externalLinks'][0]['externalEntity']['id']

        cursor.execute('''
            INSERT OR REPLACE INTO teams (
                id, name, color_primary, color_secondary, logo_url, external_entity_id
            ) VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            team.get('id'),
            team.get('name'),
            team.get('colorPrimary'),
            team.get('colorSecondary'),
            team.get('logoUrl'),
            ext_id
        ))
    
    conn.commit()

def fetch_and_save_teams():
    conn = init_db()

    has_next_page = True
    cursor_page = None
    page_size = 50
    
    total_processed = 0
    total_saved = 0

    print("Iniciando descarga e inserción en BD (SOLO LOL)...")

    while has_next_page:
        variables = {
            "first": page_size,
            "after": cursor_page
        }

        try:
            response = requests.post(
                API_URL, 
                json={'query': QUERY, 'variables': variables}, 
                headers=HEADERS,
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"Error HTTP {response.status_code}: {response.text}")
                break

            data = response.json()

            if 'errors' in data:
                print(f"Error en GraphQL: {data['errors']}")
                break

            teams_data = data['data']['teams']
            new_edges = teams_data['edges']
            page_info = teams_data['pageInfo']
            
            batch_to_save = []

            for edge in new_edges:
                node = edge['node']
                links = node.get('externalLinks', [])

                lol_links = [
                    link for link in links
                    if link.get('dataProvider', {}).get('name') == 'LOL'
                ]

                if lol_links:
                    node['externalLinks'] = lol_links
                    batch_to_save.append(node)
                    total_saved += 1

                total_processed += 1

            if batch_to_save:
                save_batch_to_db(conn, batch_to_save)

            cursor_page = page_info['endCursor']
            has_next_page = page_info['hasNextPage']

            print(f"Procesados: {total_processed} | Guardados en BD: {total_saved}...")

            time.sleep(3)

        except Exception as e:
            print(f"Excepción crítica: {e}")
            break
    
    conn.close()
    return total_saved

if __name__ == "__main__":
    cantidad = fetch_and_save_teams()
    print(f"\nProceso finalizado.")
    print(f"Base de datos '{DB_NAME}' actualizada con {cantidad} equipos.")
