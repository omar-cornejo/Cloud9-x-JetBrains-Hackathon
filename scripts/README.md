### Scripts Overview

This folder contains a set of Python scripts used to fetch, process, and manage League of Legends esports data from the GRID API and store it in a SQLite database.

#### Core Sync Scripts
1.  **`1_sync_teams.py`**: Fetches team information (specifically for League of Legends) from the GRID GraphQL API and saves/updates it in the `esports_data.db` database.
2.  **`2_fetch_players.py`**: Iterates through the teams in the database and fetches the roster (players) for each team from the GRID API.
3.  **`3_update_rosters_and_views.py`**: Updates the database schema with region and role information. It applies a predefined roster mapping to ensure players have correct roles and creates SQL views (`view_lec`, `view_lck`, etc.) for easier data access.
4.  **`4_clean_players_no_id.py`**: A utility script to remove player records that lack a valid ID and optimize the database using `VACUUM`.
5.  **`5_process_game_stats.py`**: Processes downloaded game JSON files to extract detailed match history (kills, deaths, assists, gold, etc.) and creates a master view (`view_player_champions`) for player performance statistics.
6.  **`6_download_logos.py`**: Downloads team logo images from the URLs stored in the database and saves them locally in the `team_logos/` folder.

#### Data Acquisition Scripts
*   **`getTournaments.py`**: Fetches a complete list of tournaments from the GRID API and saves them to `todos_los_torneos.json`.
*   **`getSeriesForTournament.py`**: Reads `todos_los_torneos.json` and fetches all series (matches) associated with each tournament, organizing them into a folder structure under `Tournaments/`.
*   **`getInfoFromSerie.py`**: Downloads detailed end-state data (game-by-game stats) for each series identified in the tournament folders.

#### Utility Scripts
*   **`createBDteams.py`**: A helper script designed to populate the database with team, player, and champion statistics by parsing local `series_details.json` files.

---

### Setup and Requirements

1.  **Environment Variables**: Create a `.env` file in the root directory with your GRID API key:
    ```env
    GRID_API_KEY=your_api_key_here
    ```
2.  **Dependencies**: Install the required Python packages:
    ```bash
    pip install requests python-dotenv
    ```
3.  **Database**: Most scripts interact with `esports_data.db`. The database will be created automatically upon running the sync scripts.
