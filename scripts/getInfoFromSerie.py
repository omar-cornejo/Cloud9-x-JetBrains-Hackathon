import requests
import time
import os
import json
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GRID_API_KEY")

URL_BASE_DOWNLOAD = "https://api.grid.gg/file-download/end-state/grid/series/"

HEADERS = {
    "x-api-key": API_KEY
}

ROOT_DIR = "Tournaments" 

def download_series_file(series_id, output_path):
    url = f"{URL_BASE_DOWNLOAD}{series_id}"
    
    try:
        response = requests.get(url, headers=HEADERS)
        
        if response.status_code == 429:
            print("Esperando 5 segundos...")
            time.sleep(5)
            return download_series_file(series_id, output_path)
            
        if response.status_code == 404:
            print(f"Serie {series_id} no encontrada (404).")
            return False

        if response.status_code != 200:
            print(f"Error HTTP {response.status_code} para Serie {series_id}")
            return False

        try:
            data = response.json()
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            return True
        except json.JSONDecodeError:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(response.text)
            return True

    except Exception as e:
        print(f"Excepción Serie {series_id}: {e}")
        return False

def process_tournaments_recursive():
    if not os.path.exists(ROOT_DIR):
        print(f"No encuentro la carpeta '{ROOT_DIR}'.")
        return

    for root, dirs, files in os.walk(ROOT_DIR):
        if "series.json" in files:
            series_path = os.path.join(root, "series.json")
            
            games_folder = os.path.join(root, "games")
            if not os.path.exists(games_folder):
                os.makedirs(games_folder)

            print(f"Torneo en: {root}")
            
            try:
                with open(series_path, 'r', encoding='utf-8') as f:
                    series_list = json.load(f)
            except json.JSONDecodeError:
                print("Error leyendo series.json.")
                continue

            if not series_list:
                print("series.json vacío.")
                continue

            total = len(series_list)
            downloaded_count = 0
            
            for idx, series in enumerate(series_list):
                s_id = series.get('id')
                if not s_id: continue

                final_file_path = os.path.join(games_folder, f"{s_id}.json")

                if os.path.exists(final_file_path) and os.path.getsize(final_file_path) > 100:
                    continue
                
                print(f"({idx+1}/{total}) Descargando Serie ID: {s_id}...")
                
                success = download_series_file(s_id, final_file_path)
                
                if success:
                    downloaded_count += 1
                    time.sleep(3) 

            print(f"Completado. Nuevas descargas: {downloaded_count}")

if __name__ == "__main__":
    print("Iniciando Descarga Masiva...")
    process_tournaments_recursive()
    print("Proceso global completado.")