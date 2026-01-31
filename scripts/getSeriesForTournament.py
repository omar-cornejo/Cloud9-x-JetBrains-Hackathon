import requests
import time
import os
import json
import re
from dotenv import load_dotenv

load_dotenv()

URL_API = "https://api-op.grid.gg/central-data/graphql" 
HEADERS = {
    "Content-Type": "application/json",
    "x-api-key": os.getenv("GRID_API_KEY") 
}

REGIONES = {
    "LCK": "lck", "LCS": "lcs", "LPL": "lpl", 
    "LEC": "lec", "LTA North": "lta_north", "LTA South": "lta_south"
}

QUERY_SERIES = """
query GetTournamentSeries($tournamentId: ID!, $after: String) {
  allSeries(
    first: 50
    after: $after
    filter: {
      tournamentIds: { in: [$tournamentId] }
      types: ESPORTS
    }
    orderBy: StartTimeScheduled
    orderDirection: DESC
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        ...seriesFields
      }
    }
  }
}

fragment seriesFields on Series {
  id
  title { nameShortened }
  tournament { nameShortened }
  startTimeScheduled
  format { name nameShortened }
  teams {
    baseInfo { name }
    scoreAdvantage
  }
}
"""

def clean_folder_name(text):
    return re.sub(r'[\\/*?:"<>|]', "", text).strip()

def fetch_all_series_pagination(tournament_id):
    all_series = []
    has_next_page = True
    after_cursor = None

    while has_next_page:
        variables = {"tournamentId": tournament_id, "after": after_cursor}
        
        try:
            response = requests.post(URL_API, json={'query': QUERY_SERIES, 'variables': variables}, headers=HEADERS)
            response.raise_for_status()
            data = response.json()

            if 'errors' in data:
                print(f"Error GraphQL: {data['errors'][0]['message']}")
                break

            all_series_root = data.get('data', {}).get('allSeries')
            
            if not all_series_root or not all_series_root.get('edges'):
                break

            edges = all_series_root['edges']
            for edge in edges:
                if edge.get('node'):
                    all_series.append(edge['node'])

            page_info = all_series_root.get('pageInfo', {})
            has_next_page = page_info.get('hasNextPage', False)
            after_cursor = page_info.get('endCursor', None)
            
            if has_next_page and after_cursor:
                time.sleep(0.3)
            else:
                has_next_page = False

        except Exception as e:
            print(f"Error procesando ID {tournament_id}: {e}")
            break
            
    return all_series

def main():
    if not os.path.exists("todos_los_torneos.json"):
        print("Error: Necesito el archivo 'todos_los_torneos.json'.")
        return

    with open("todos_los_torneos.json", "r", encoding="utf-8") as f:
        torneos = json.load(f)

    print(f"Iniciando proceso para {len(torneos)} torneos...")

    for t in torneos:
        t_id = t['id']
        t_name = t['name']
        
        region_folder = next((folder for key, folder in REGIONES.items() if key in t_name), None)
        if not region_folder:
            continue

        clean_name = clean_folder_name(t_name)
        path_evento = os.path.join("Tournaments", region_folder, clean_name)
        
        os.makedirs(path_evento, exist_ok=True)
        file_path = os.path.join(path_evento, "series.json")

        if os.path.exists(file_path):
            if os.path.getsize(file_path) > 10:
                print(f"Saltado: {clean_name}")
                continue

        print(f"Descargando series: {clean_name} (ID: {t_id})")
        lista_series = fetch_all_series_pagination(t_id)

        if lista_series:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(lista_series, f, indent=4, ensure_ascii=False)
            print(f"Guardado: {len(lista_series)} series.")
        else:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump([], f)
            print("Sin series.")

        time.sleep(3) 

    print("Proceso finalizado.")

if __name__ == "__main__":
    main()