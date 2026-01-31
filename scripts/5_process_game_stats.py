import os
import json
import sqlite3

ROOT_DIR = "Tournaments"
DB_NAME = "esports_data.db"

def setup_stats_database():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS match_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT,
        series_id TEXT,
        player_id TEXT,
        team_id_at_game TEXT,
        champion_name TEXT,
        win INTEGER,
        kills INTEGER,
        deaths INTEGER,
        assists INTEGER,
        gold INTEGER,
        damage_dealt INTEGER,
        FOREIGN KEY(player_id) REFERENCES players(id)
    )
    ''')
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_player_champ ON match_history(player_id, champion_name)")
    
    conn.commit()
    print("Tabla 'match_history' preparada.")
    return conn

def get_known_player_ids(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM players")
    return set(row[0] for row in cursor.fetchall())

def process_files():
    conn = setup_stats_database()
    cursor = conn.cursor()
    
    known_players = get_known_player_ids(conn)
    
    files_processed = 0
    games_inserted = 0

    print("Iniciando procesamiento de partidas...")

    for root, dirs, files in os.walk(ROOT_DIR):
        for file in files:
            if file.endswith(".json") and file != "series.json" and file != "series_details.json":
                
                full_path = os.path.join(root, file)
                series_id = os.path.splitext(file)[0]
                
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                except:
                    continue

                series_state = data.get('seriesState')
                if not series_state: continue

                games = series_state.get('games', [])
                
                for game in games:
                    game_id = game.get('id') 
                    
                    teams_data = game.get('teams', [])
                    
                    for team in teams_data:
                        team_id = team.get('id')
                        won = 1 if team.get('won') else 0
                        
                        players = team.get('players', [])
                        
                        for player in players:
                            p_id = str(player.get('id'))
                            
                            if p_id not in known_players:
                                continue

                            character = player.get('character', {})
                            champ_name = character.get('name', 'Unknown')
                            
                            kills = player.get('kills', 0)
                            deaths = player.get('deaths', 0)
                            assists = player.get('killAssistsGiven', 0)
                            net_worth = player.get('netWorth', 0) or player.get('money', 0)
                            
                            cursor.execute('''
                                INSERT INTO match_history 
                                (game_id, series_id, player_id, team_id_at_game, champion_name, win, kills, deaths, assists, gold)
                                SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                                WHERE NOT EXISTS (
                                    SELECT 1 FROM match_history 
                                    WHERE game_id = ? AND player_id = ?
                                )
                            ''', (game_id, series_id, p_id, team_id, champ_name, won, kills, deaths, assists, net_worth, game_id, p_id))
                            
                            if cursor.rowcount > 0:
                                games_inserted += 1

                files_processed += 1
                if files_processed % 10 == 0:
                    print(f"Procesados {files_processed} archivos... ({games_inserted} registros nuevos)")
                    conn.commit()

    conn.commit()
    print(f"\nProceso terminado. {games_inserted} registros de partidas insertados.")
    return conn

def create_stats_view(conn):
    cursor = conn.cursor()
    print("Creando Vista Maestra de Estadísticas...")

    query = """
    CREATE VIEW IF NOT EXISTS view_player_champions AS
    SELECT 
        p.nickname AS Player,
        t.name AS Current_Team,
        t.region AS Region,
        mh.champion_name AS Champion,
        COUNT(*) AS Games_Played,
        SUM(mh.win) AS Wins,
        (COUNT(*) - SUM(mh.win)) AS Losses,
        ROUND(CAST(SUM(mh.win) AS FLOAT) / COUNT(*) * 100, 1) || '%' AS Winrate,
        ROUND(CAST(SUM(mh.kills) + SUM(mh.assists) AS FLOAT) / CASE WHEN SUM(mh.deaths) = 0 THEN 1 ELSE SUM(mh.deaths) END, 2) AS KDA,
        ROUND(AVG(mh.kills), 1) AS Avg_Kills,
        ROUND(AVG(mh.deaths), 1) AS Avg_Deaths,
        ROUND(AVG(mh.assists), 1) AS Avg_Assists,
        ROUND(AVG(mh.gold), 0) AS Avg_Gold
    FROM match_history mh
    JOIN players p ON mh.player_id = p.id
    LEFT JOIN teams t ON p.team_id = t.id
    GROUP BY p.id, mh.champion_name
    ORDER BY p.nickname, Games_Played DESC;
    """
    
    cursor.execute("DROP VIEW IF EXISTS view_player_champions")
    cursor.execute(query)
    conn.commit()
    print("Vista 'view_player_champions' creada correctamente.")

def show_example(conn):
    cursor = conn.cursor()
    print("\n--- EJEMPLO: Top 5 Campeones más jugados (General) ---")
    try:
        cursor.execute("""
            SELECT Player, Champion, Games_Played, Winrate, KDA 
            FROM view_player_champions 
            ORDER BY Games_Played DESC 
            LIMIT 10
        """)
        
        print(f"{'Player':<15} | {'Champion':<12} | {'Games':<5} | {'Win %':<8} | {'KDA':<5}")
        print("-" * 55)
        for row in cursor.fetchall():
            print(f"{row[0]:<15} | {row[1]:<12} | {str(row[2]):<5} | {str(row[3]):<8} | {str(row[4]):<5}")
            
    except Exception as e:
        print(e)

if __name__ == "__main__":
    conn = process_files()
    create_stats_view(conn)
    show_example(conn)
    conn.close()
