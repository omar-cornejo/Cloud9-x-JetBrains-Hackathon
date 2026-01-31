import sqlite3
import os
import requests
import re

DB_NAME = "esports_data.db"
DOWNLOAD_FOLDER = "team_logos"

def sanitize_filename(name):
    return re.sub(r'[<>:"/\\|?*]', '', name).strip().replace(' ', '_')

def download_logos():
    if not os.path.exists(DOWNLOAD_FOLDER):
        os.makedirs(DOWNLOAD_FOLDER)
        print(f"Carpeta '{DOWNLOAD_FOLDER}' creada.")

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    print("Buscando equipos activos en la base de datos...")

    try:
        cursor.execute("SELECT name, logo_url, region FROM teams WHERE region IS NOT NULL")
        teams = cursor.fetchall()
    except sqlite3.OperationalError as e:
        print(f"Error: {e}")
        return

    print(f"Se encontraron {len(teams)} equipos activos.")
    
    downloaded_count = 0
    missing_url_count = 0
    error_count = 0

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    print("Iniciando descargas...")

    for name, url, region in teams:
        if not url:
            print(f"{name} ({region}): No tiene URL de logo en la BD.")
            missing_url_count += 1
            continue

        safe_name = sanitize_filename(name)
        file_path = os.path.join(DOWNLOAD_FOLDER, f"{safe_name}.png")

        if os.path.exists(file_path):
            continue

        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                with open(file_path, 'wb') as f:
                    f.write(response.content)
                print(f"{name}: Descargado.")
                downloaded_count += 1
            else:
                print(f"{name}: Error HTTP {response.status_code}")
                error_count += 1
        except Exception as e:
            print(f"{name}: Falló la descarga ({e})")
            error_count += 1

    conn.close()
    print("RESUMEN:")
    print(f"Descargados: {downloaded_count}")
    print(f"Sin URL: {missing_url_count}")
    print(f"Errores: {error_count}")
    print(f"Las imágenes están en la carpeta: /{DOWNLOAD_FOLDER}")

if __name__ == "__main__":
    download_logos()