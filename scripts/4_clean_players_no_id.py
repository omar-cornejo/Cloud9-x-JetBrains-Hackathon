import sqlite3

DB_NAME = "esports_data.db"

def clean_players_without_id():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    print("Iniciando limpieza de jugadores sin ID...")

    cursor.execute("SELECT COUNT(*) FROM players WHERE id IS NULL OR id = ''")
    count = cursor.fetchone()[0]

    if count > 0:
        print(f"Se encontraron {count} jugadores sin ID real.")

        cursor.execute("DELETE FROM players WHERE id IS NULL OR id = ''")
        conn.commit()

        print(f"Eliminados {cursor.rowcount} registros correctamente.")
    else:
        print("No se encontraron jugadores sin ID.")

    print("Optimizando base de datos...")
    cursor.execute("VACUUM")
    
    conn.close()

if __name__ == "__main__":
    clean_players_without_id()