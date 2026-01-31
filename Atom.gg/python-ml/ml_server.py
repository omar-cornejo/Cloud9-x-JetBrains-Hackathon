import json
import os
import sys
from typing import Any, Dict, Optional

from draft_oracle import TournamentDraft


def _eprint(*args: Any, **kwargs: Any) -> None:
    print(*args, file=sys.stderr, **kwargs)

def get_resource_path(relative_path: str) -> str:
    """Get absolute path to resource, works for dev and PyInstaller."""
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        #if PyInstaller bundle
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))

    return os.path.join(base_path, relative_path)

class MlServer:
    def __init__(self):
        # CWD is expected to be python-ml
        quiet = True

        self.required_files = {
            "model": os.environ.get("ATOMGG_MODEL_FILE") or get_resource_path("draft_oracle_brain_v12_final.json"),
            "features": os.environ.get("ATOMGG_FEATURE_FILE") or get_resource_path("draft_oracle_feature_store.parquet"),
            "pro_signatures": os.environ.get("ATOMGG_PRO_SIG_FILE") or get_resource_path("draft_oracle_pro_signatures.parquet"),
            "tournament_meta": os.environ.get("ATOMGG_TOURNAMENT_META_FILE") or get_resource_path("draft_oracle_tournament_meta.parquet"),
            "synergy": os.environ.get("ATOMGG_SYNERGY_FILE") or get_resource_path("draft_oracle_synergy_matrix.parquet"),
        }

        db_file = os.environ.get("ATOMGG_DB_FILE")
        if not db_file:
            db_file = get_resource_path("esports_data.db")
            if not os.path.exists(db_file):
                # Try the 'src' subdirectory (Tauri resource mapping)
                db_file_in_src = get_resource_path(os.path.join("src", "esports_data.db"))
                if os.path.exists(db_file_in_src):
                    db_file = db_file_in_src
                else:
                    # Fallback for dev if not found in bundle/python-ml dir
                    db_file = os.path.join("..", "src-tauri", "src", "esports_data.db")

        self.required_files["database"] = db_file

        self.app = TournamentDraft(
            model_file=self.required_files["model"],
            feature_file=self.required_files["features"],
            pro_sig_file=self.required_files["pro_signatures"],
            tournament_meta_file=self.required_files["tournament_meta"],
            synergy_file=self.required_files["synergy"],
            db_file=self.required_files["database"],
            quiet=quiet,
        )

        self.initialized = False

    def handle(self, msg: Dict[str, Any]) -> Dict[str, Any]:
        msg_type = msg.get("type")
        request_id = msg.get("request_id")

        try:
            if msg_type == "ping":
                return {"request_id": request_id, "ok": True, "type": "pong", "payload": {"status": "ok"}}

            if msg_type == "init":
                config = msg.get("config") or {}
                mode = str(config.get("mode", "NORMAL"))
                total_games = int(config.get("numGames", 1))

                self.app.configure_series(mode, total_games)

                # Team names are provided by the frontend; roster is loaded from DB
                blue_team = config.get("blueTeam")
                red_team = config.get("redTeam")

                if blue_team:
                    self.app.teams["BLUE"]["name"] = str(blue_team)
                if red_team:
                    self.app.teams["RED"]["name"] = str(red_team)

                # Auto-roster load (keeps existing SQL logic)
                if blue_team:
                    self.app.set_roster_auto("BLUE", str(blue_team))
                if red_team:
                    self.app.set_roster_auto("RED", str(red_team))

                self.initialized = True
                wr = self.app.predict_live_winrate()
                return {
                    "request_id": request_id,
                    "ok": True,
                    "type": "init_result",
                    "payload": {
                        "mode": self.app.series_config["mode"],
                        "game": self.app.series_config["current_game"],
                        "total_games": self.app.series_config["total_games"],
                        "blue_winrate": wr["blue"],
                        "red_winrate": wr["red"],
                        "teams": {
                            "BLUE": self.app.teams["BLUE"],
                            "RED": self.app.teams["RED"],
                        },
                    },
                }

            if not self.initialized and msg_type not in ("configure_series", "set_team", "roster"):
                return {"request_id": request_id, "ok": False, "type": "error", "error": "ML not initialized"}

            if msg_type == "configure_series":
                mode = str(msg.get("mode", "NORMAL"))
                total_games = int(msg.get("total_games", 1))
                self.app.configure_series(mode, total_games)
                self.initialized = True
                return {
                    "request_id": request_id,
                    "ok": True,
                    "type": "configure_series_result",
                    "payload": {
                        "mode": self.app.series_config["mode"],
                        "game": self.app.series_config["current_game"],
                        "total_games": self.app.series_config["total_games"],
                    },
                }

            if msg_type == "set_team":
                side = str(msg.get("side", "")).upper()
                name = str(msg.get("name", ""))
                if side not in ("BLUE", "RED"):
                    return {"request_id": request_id, "ok": False, "type": "error", "error": "Invalid side"}
                self.app.teams[side]["name"] = name
                return {"request_id": request_id, "ok": True, "type": "set_team_result", "payload": {"side": side, "name": name}}

            if msg_type == "roster":
                side = str(msg.get("side", "")).upper()
                team = str(msg.get("team", ""))
                self.app.set_roster_auto(side, team)
                return {"request_id": request_id, "ok": True, "type": "roster_result", "payload": {"side": side, "team": team, "players": self.app.teams[side]["players"]}}

            if msg_type == "ban":
                champ = str(msg.get("champion", ""))
                self.app.add_ban(champ)
                wr = self.app.predict_live_winrate()
                return {
                    "request_id": request_id,
                    "ok": True,
                    "type": "ban_result",
                    "payload": {"champion": champ, "blue_winrate": wr["blue"], "red_winrate": wr["red"]},
                }

            if msg_type == "pick":
                side = str(msg.get("side", "")).upper()
                champ = str(msg.get("champion", ""))
                self.app.add_pick(side, champ)
                wr = self.app.predict_live_winrate()
                return {
                    "request_id": request_id,
                    "ok": True,
                    "type": "pick_result",
                    "payload": {"side": side, "champion": champ, "blue_winrate": wr["blue"], "red_winrate": wr["red"]},
                }

            if msg_type == "sync_state":
                blue_picks = msg.get("blue_picks") or []
                red_picks = msg.get("red_picks") or []
                bans = msg.get("bans") or []
                self.app.reset_game_board()

                for c in bans:
                    self.app.add_ban(str(c))
                for c in blue_picks:
                    self.app.add_pick("BLUE", str(c))
                for c in red_picks:
                    self.app.add_pick("RED", str(c))

                wr = self.app.predict_live_winrate()
                return {
                    "request_id": request_id,
                    "ok": True,
                    "type": "sync_state_result",
                    "payload": {
                        "blue_picks": self.app.blue_picks,
                        "red_picks": self.app.red_picks,
                        "bans": self.app.bans,
                        "blue_winrate": wr["blue"],
                        "red_winrate": wr["red"],
                    },
                }

            if msg_type == "next_game":
                self.app.end_game()
                wr = self.app.predict_live_winrate()
                return {
                    "request_id": request_id,
                    "ok": True,
                    "type": "next_game_result",
                    "payload": {
                        "game": self.app.series_config["current_game"],
                        "total_games": self.app.series_config["total_games"],
                        "blue_winrate": wr["blue"],
                        "red_winrate": wr["red"],
                    },
                }

            if msg_type == "suggest":
                target_side = str(msg.get("target_side", "BLUE")).upper()
                is_ban_mode = bool(msg.get("is_ban_mode", False))
                roles = msg.get("roles")
                if roles is not None:
                    roles = [str(r).upper() for r in roles]

                payload = self.app.get_suggestions(target_side, is_ban_mode, roles=roles)
                return {"request_id": request_id, "ok": True, "type": "suggest_result", "payload": payload}

            return {"request_id": request_id, "ok": False, "type": "error", "error": f"Unknown type: {msg_type}"}

        except Exception as e:
            _eprint("ML server error:", repr(e))
            return {"request_id": request_id, "ok": False, "type": "error", "error": str(e)}


def main():
    server = MlServer()

    # Read JSONL from stdin, write JSONL to stdout.
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception as e:
            _eprint("Invalid JSON:", line)
            out = {"request_id": None, "ok": False, "type": "error", "error": f"Invalid JSON: {e}"}
            sys.stdout.write(json.dumps(out) + "\n")
            sys.stdout.flush()
            continue

        resp = server.handle(msg)
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
