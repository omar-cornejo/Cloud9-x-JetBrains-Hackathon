import os
import json
import sqlite3

ROOT_DIR = "Tournaments"
DB_NAME = "esports_data.db"

def setup_database():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL,
        team_id INTEGER,
        UNIQUE(nickname, team_id),
        FOREIGN KEY(team_id) REFERENCES teams(id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS champion_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER,
        champion_name TEXT NOT NULL,
        games_played INTEGER DEFAULT 0,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        assists INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        UNIQUE(player_id, champion_name),
        FOREIGN KEY(player_id) REFERENCES players(id)
    )
    ''')

    conn.commit()
    return conn

def save_game_stats(conn, team_name, player_nick, champion, k, d, a, won_game):
    cursor = conn.cursor()

    try:
        cursor.execute('INSERT OR IGNORE INTO teams (name) VALUES (?)', (team_name,))
        cursor.execute('SELECT id FROM teams WHERE name = ?', (team_name,))
        res = cursor.fetchone()
        if not res: return
        team_id = res[0]

        cursor.execute('INSERT OR IGNORE INTO players (nickname, team_id) VALUES (?, ?)', (player_nick, team_id))
        cursor.execute('SELECT id FROM players WHERE nickname = ? AND team_id = ?', (player_nick, team_id))
        res_p = cursor.fetchone()
        if not res_p: return
        player_id = res_p[0]

        query = '''
            INSERT INTO champion_stats (player_id, champion_name, games_played, kills, deaths, assists, wins)
            VALUES (?, ?, 1, ?, ?, ?, ?)
            ON CONFLICT(player_id, champion_name) DO UPDATE SET
                games_played = games_played + 1,
                kills = kills + excluded.kills,
                deaths = deaths + excluded.deaths,
                assists = assists + excluded.assists,
                wins = wins + excluded.wins
        '''
        cursor.execute(query, (player_id, champion, k, d, a, won_game))
        
    except Exception as e:
        print(f"Error SQL: {e}")

def process_details_file(file_path, conn):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            series_list = json.load(f)
    except Exception as e:
        print(f"Error leyendo {file_path}: {e}")
        return

    count_games = 0
    
    for series in series_list:
        if not series: continue
        
        games = series.get('games', [])
        
        for game in games:
            teams = game.get('teams', [])
            
            for team in teams:
                team_name = team.get('name', 'Unknown Team')
                
                team_won = 0 

                players = team.get('players', [])
                
                for player in players:
                    nick = player.get('name', 'Unknown')
                    
                    char_data = player.get('character')
                    champion = char_data.get('name') if char_data else "Unknown"
                    
                    k = player.get('kills', 0)
                    d = player.get('deaths', 0)
                    a = player.get('killAssistsGiven', 0) 

                    save_game_stats(conn, team_name, nick, champion, k, d, a, team_won)
            
            count_games += 1
            
    print(f"Procesadas {count_games} partidas en este archivo.")

def main():
    print("Iniciando volcado de JSON a Base de Datos...")
    
    conn = setup_database()
    
    if not os.path.exists(ROOT_DIR):
        print(f"No encuentro la carpeta '{ROOT_DIR}'")
        return

    files_found = 0
    
    for root, dirs, files in os.walk(ROOT_DIR):
        if "series_details.json" in files:
            full_path = os.path.join(root, "series_details.json")
            print(f"Leyendo: {full_path}")
            
            process_details_file(full_path, conn)
            conn.commit() 
            files_found += 1

    conn.close()
    print(f"Proceso terminado. Se procesaron {files_found} archivos JSON.")
    print(f"Los datos están en '{DB_NAME}'.")

if __name__ == "__main__":
    main()