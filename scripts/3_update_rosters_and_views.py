import sqlite3

DB_NAME = "esports_data.db"

ROSTERS_DATA = {
    "LEC": {
        "Fnatic": ["Empyros", "Razork", "Vladi", "Upset", "Lospa"],
        "G2 Esports": ["BrokenBlade", "SkewMond", "Caps", "Hans Sama", "Labrov"],
        "GIANTX": ["Lot", "ISMA", "Jackies", "Noah", "Jun"],
        "Karmine Corp": ["Canna", "Yike", "kyeahoo", "Caliste", "Busio"],
        "Movistar KOI": ["Myrwn", "Elyoya", "Jojopyun", "Supa", "Alvaro"],
        "Natus Vincere": ["Maynter", "Rhilech", "Poby", "SamD", "Parus"],
        "Shifters": ["Rooster", "Boukada", "nuc", "Paduck", "Trymbi"],
        "SK Gaming": ["Wunder", "Skeanz", "LIDER", "Jopa", "Mikyx"],
        "Team Heretics": ["Tracyn", "Sheo", "Serin", "Ice", "Stend"],
        "Team Vitality": ["Naak Nako", "Lyncas", "Humanoid", "Carzzy", "Fleshy"],
        "Los Ratones": ["Baus", "Velja", "Nemesis", "Crownie", "Rekkles"],
        "Karmine Corp Blue": ["Tao", "Yukino", "Kamiloo", "Hazel", "Prime"]
    },
    "LPL": {
        "Anyone's Legend": ["Flandre", "Tarzan", "Shanks", "Hope", "Kael"],
        "BILIBILI GAMING DREAMSMART": ["Bin", "Xun", "Knight", "Viper", "ON"],
        "Invictus Gaming": ["Soboro", "Wei", "Rookie", "Photic", "Jwei"],
        "Beijing JDG Intel Esports": ["Xiaoxu", "JunJia", "HongQ", "GALA", "Vampire"],
        "TopEsports": ["369", "naiyou", "Creme", "JiaQi", "fengyue"],
        "WeiboGaming Faw Audi": ["Zika", "Jiejie", "Xiaohu", "Elk", "Erha"],
        "SHANGHAI EDWARD GAMING HYCAN": ["Zdz", "Xiaohao", "Angel", "Leave", "Parukia"],
        "Ninjas in Pyjamas.CN": ["HOYA", "Guwon", "Care", "Assum", "Zhuo"],
        "Xi'an Team WE": ["Cube", "Monki", "Karis", "About", "yaoyao"],
        "THUNDERTALKGAMING": ["Keshi", "Junhao", "Heru", "Ryan3", "Feather"],
        "Hangzhou LGD Gaming": ["sasi", "Heng", "Tangyuan", "Shaoye", "Ycx"],
        "Suzhou LNG Ninebot Esports": ["sheer", "Croco", "BuLLDoG", "1xn", "MISSING"],
        "Oh My Market": ["Hery", "Juhan", "haichao", "Starry", "Moham"],
        "Ultra Prime": ["Liangchen", "Grizzly", "Saber", "Hena", "Xiaoxia"]
    },
    "LCK": {
        "BNK FEARX": ["Clear", "Raptor", "VicLa", "Diable", "Kellin"],
        "BRION": ["Casting", "GIDEON", "Roamer", "Teddy", "Namgung"],
        "DN SOOPers": ["DuDu", "Pyosik", "Clozer", "deokdam", "Life", "Peter"],
        "Dplus Kia": ["Siwoo", "Lucid", "ShowMaker", "Smash", "Career"],
        "DRX": ["Rich", "Willer", "Ucal", "Jiwoo", "Andil"],
        "Gen.G Esports": ["Kiin", "Canyon", "Chovy", "Ruler", "Duro"],
        "Hanwha Life Esports": ["Zeus", "Kanavi", "Zeka", "Gumayusi", "Delight"],
        "KT Rolster": ["PerfecT", "Cuzz", "Bdd", "Aiming", "Pollu", "Ghost"],
        "NS RedForce": ["Kingen", "Sponge", "Scout", "Taeyoon", "Lehends"],
        "T1": ["Doran", "Oner", "Faker", "Peyz", "Keria"]
    },
    "LCS": {
        "Cloud9 Kia": ["Thanatos", "Blaber", "APA", "Zven", "Vulcan"],
        "Dignitas": ["Photon", "eXyu", "Palafox", "Mobility", "Breezy"],
        "FlyQuest": ["Gakgos", "Gryffinn", "Quad", "Massu", "Cryogen"],
        "LYON": ["Dhokla", "Inspired", "Saint", "Berserker", "Isles"],
        "Sentinels": ["Impact", "HamBak", "DARKWINGS", "Rahel", "huhi"],
        "Shopify Rebellion": ["Fudge", "Contractz", "Zinie", "Bvoy", "Ceos"],
        "Team Liquid": ["Morgan", "Josedeodo", "Quid", "Yeon", "CoreJJ"],
        "Disguised": ["Castle", "KryRa", "Callme", "sajed", "Lyonz"]
    }
}

ROLES_ORDER = ["Top", "Jungle", "Mid", "ADC", "Utility"]

def update_schema_and_data():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    print("Actualizando esquema de Base de Datos...")

    try:
        cursor.execute("ALTER TABLE teams ADD COLUMN region TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE players ADD COLUMN role TEXT")
    except sqlite3.OperationalError:
        pass

    print("Procesando equipos y jugadores...")

    for region, teams in ROSTERS_DATA.items():
        for team_name, players in teams.items():

            cursor.execute("SELECT id FROM teams WHERE name = ? COLLATE NOCASE", (team_name,))
            row = cursor.fetchone()

            if row:
                team_id = row[0]
                cursor.execute("UPDATE teams SET region = ? WHERE id = ?", (region, team_id))
            else:
                cursor.execute("INSERT INTO teams (name, region) VALUES (?, ?)", (team_name, region))
                team_id = cursor.lastrowid
                print(f"Equipo creado (no existía): {team_name} ({region})")

            for index, player_entry in enumerate(players):

                if ":" in player_entry:
                    clean_nick = player_entry.split(":")[0].strip()
                else:
                    clean_nick = player_entry.strip()

                if index < 5:
                    role = ROLES_ORDER[index]
                else:
                    role = "Sub"

                cursor.execute("SELECT id FROM players WHERE nickname LIKE ?", (clean_nick,))
                p_row = cursor.fetchone()

                if p_row:
                    cursor.execute("UPDATE players SET team_id = ?, role = ? WHERE id = ?", (team_id, role, p_row[0]))
                else:
                    cursor.execute("INSERT INTO players (nickname, team_id, role) VALUES (?, ?, ?)", (clean_nick, team_id, role))

    conn.commit()
    print("Datos de Region, Roles y Equipos actualizados.")
    return conn

def create_views(conn):
    cursor = conn.cursor()
    regions = ["LEC", "LPL", "LCK", "LCS"]

    print("Creando Vistas SQL...")

    for region in regions:
        view_name = f"view_{region.lower()}"
        
        query = f"""
        CREATE VIEW IF NOT EXISTS {view_name} AS
        SELECT 
            t.name AS Team,
            MAX(CASE WHEN p.role = 'Top' THEN p.nickname END) AS Top,
            MAX(CASE WHEN p.role = 'Jungle' THEN p.nickname END) AS Jungle,
            MAX(CASE WHEN p.role = 'Mid' THEN p.nickname END) AS Mid,
            MAX(CASE WHEN p.role = 'ADC' THEN p.nickname END) AS ADC,
            MAX(CASE WHEN p.role = 'Utility' THEN p.nickname END) AS Utility,
            GROUP_CONCAT(CASE WHEN p.role NOT IN ('Top', 'Jungle', 'Mid', 'ADC', 'Utility') THEN p.nickname END, ', ') AS Subs
        FROM teams t
        LEFT JOIN players p ON t.id = p.team_id
        WHERE t.region = '{region}'
        GROUP BY t.id
        ORDER BY t.name;
        """
        
        cursor.execute(f"DROP VIEW IF EXISTS {view_name}")
        cursor.execute(query)
        print(f"Vista creada: {view_name}")

    conn.commit()

def show_example(conn):
    cursor = conn.cursor()
    print("\n--- EJEMPLO: VISTA 'view_lck' (Con Subs) ---")
    try:
        cursor.execute("SELECT * FROM view_lck LIMIT 5")
        col_names = [description[0] for description in cursor.description]
        
        header = " | ".join([f"{name:<12}" for name in col_names])
        print(header)
        print("-" * len(header))
        
        for row in cursor.fetchall():
            row_str = " | ".join([f"{str(item):<12}" if item else "-           " for item in row])
            print(row_str)
            
    except Exception as e:
        print(e)

if __name__ == "__main__":
    conn = update_schema_and_data()
    create_views(conn)
    show_example(conn)
    conn.close()
