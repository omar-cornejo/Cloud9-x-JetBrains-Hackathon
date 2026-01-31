import requests
import time
import os
import json
from dotenv import load_dotenv

load_dotenv()

URL_API = "https://api-op.grid.gg/central-data/graphql" 
HEADERS = {
    "Content-Type": "application/json",
    "x-api-key": os.getenv("GRID_API_KEY") 
}

query = """
query GetTournaments($after: String) {
  tournaments(after: $after, first: 50) { 
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        name
        nameShortened
      }
    }
  }
}
"""

def fetch_all_tournaments():
    all_results = []
    has_next_page = True
    current_cursor = None
    page_count = 1

    print("Iniciando descarga...")

    while has_next_page:
        variables = {"after": current_cursor}
        
        try:
            response = requests.post(
                URL_API, 
                json={'query': query, 'variables': variables}, 
                headers=HEADERS
            )
            
            if response.status_code != 200:
                print(f"Error HTTP {response.status_code}")
                break

            data = response.json()
            
            if 'errors' in data:
                print("Error de GraphQL:", data['errors'])
                break

            tournaments_data = data['data']['tournaments']
            edges = tournaments_data['edges']
            page_info = tournaments_data['pageInfo']

            for edge in edges:
                all_results.append(edge['node'])

            print(f"Página {page_count} procesada. {len(edges)} torneos encontrados.")

            has_next_page = page_info['hasNextPage']
            current_cursor = page_info['endCursor']
            page_count += 1
            time.sleep(0.5)

        except Exception as e:
            print(f"Ocurrió una excepción: {e}")
            break

    return all_results

if __name__ == "__main__":
    todos_los_torneos = fetch_all_tournaments()
    
    if todos_los_torneos:
        nombre_archivo = "todos_los_torneos.json"
        
        with open(nombre_archivo, "w", encoding="utf-8") as f:
            json.dump(todos_los_torneos, f, indent=4, ensure_ascii=False)
        
        print(f"Descarga completa. Total: {len(todos_los_torneos)}")
        print(f"Archivo guardado como: {os.path.abspath(nombre_archivo)}")