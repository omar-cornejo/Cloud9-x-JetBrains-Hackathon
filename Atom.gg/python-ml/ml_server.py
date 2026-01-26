import json
import os
import sys
from typing import Any, Dict, Optional

from draft_oracle import TournamentDraft


def _eprint(*args: Any, **kwargs: Any) -> None:
    print(*args, file=sys.stderr, **kwargs)


class MlServer:
    def __init__(self):
        # CWD is expected to be python-ml
        quiet = True

        model_file = os.environ.get("ATOMGG_MODEL_FILE", "draft_oracle_brain_v12_final.json")
        feature_file = os.environ.get("ATOMGG_FEATURE_FILE", "draft_oracle_feature_store.parquet")
        pro_sig_file = os.environ.get("ATOMGG_PRO_SIG_FILE", "draft_oracle_pro_signatures.parquet")
        tournament_meta_file = os.environ.get("ATOMGG_TOURNAMENT_META_FILE", "draft_oracle_tournament_meta.parquet")
        synergy_file = os.environ.get("ATOMGG_SYNERGY_FILE", "draft_oracle_synergy_matrix.parquet")
        db_file = os.environ.get("ATOMGG_DB_FILE", os.path.join("..", "src-tauri", "src", "esports_data.db"))

        self.app = TournamentDraft(
            model_file=model_file,
            feature_file=feature_file,
            pro_sig_file=pro_sig_file,
            tournament_meta_file=tournament_meta_file,
            synergy_file=synergy_file,
            db_file=db_file,
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
                return {
                    "request_id": request_id,
                    "ok": True,
                    "type": "init_result",
                    "payload": {
                        "mode": self.app.series_config["mode"],
                        "game": self.app.series_config["current_game"],
                        "total_games": self.app.series_config["total_games"],
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
                return {"request_id": request_id, "ok": True, "type": "ban_result", "payload": {"champion": champ}}

            if msg_type == "pick":
                side = str(msg.get("side", "")).upper()
                champ = str(msg.get("champion", ""))
                self.app.add_pick(side, champ)
                return {"request_id": request_id, "ok": True, "type": "pick_result", "payload": {"side": side, "champion": champ}}

            if msg_type == "next_game":
                self.app.end_game()
                return {
                    "request_id": request_id,
                    "ok": True,
                    "type": "next_game_result",
                    "payload": {
                        "game": self.app.series_config["current_game"],
                        "total_games": self.app.series_config["total_games"],
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
