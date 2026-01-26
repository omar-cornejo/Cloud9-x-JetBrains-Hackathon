import itertools
import json
import os
import sqlite3
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import polars as pl
import requests
import xgboost as xgb


# NOTE: This file is a refactor of the logic that previously lived in `Testing.ipynb`.
# The draft/pick/ban/suggestion logic is intentionally preserved; the main change is
# that the logic is now importable and can be driven programmatically (e.g. by Rust).


@dataclass
class Suggestion:
    role: str
    champion: str
    score: float
    tactical: str
    tags: str = ""
    threat: str = ""


class TournamentDraft:
    def __init__(
        self,
        model_file: str = "draft_oracle_brain_v12_final.json",
        feature_file: str = "draft_oracle_feature_store.parquet",
        pro_sig_file: str = "draft_oracle_pro_signatures.parquet",
        tournament_meta_file: str = "draft_oracle_tournament_meta.parquet",
        synergy_file: str = "draft_oracle_synergy_matrix.parquet",
        db_file: str = "esports_data.db",
        quiet: bool = False,
    ):
        self.quiet = quiet

        # --- CONFIG ---
        self.MODEL_FILE = model_file
        self.FEATURE_FILE = feature_file
        self.PRO_SIG_FILE = pro_sig_file
        self.TOURNAMENT_META_FILE = tournament_meta_file
        self.SYNERGY_FILE = synergy_file
        self.DB_FILE = db_file

        if not self.quiet:
            print("⚙️  Cargando Tournament Suite V9.5 (SQL Preserved + Meta)...")

        # 1. MODEL
        self.model = xgb.Booster()
        try:
            self.model.load_model(self.MODEL_FILE)
            if not self.quiet:
                print(f"   🧠 Cerebro cargado: {self.MODEL_FILE}")
        except Exception:
            if not self.quiet:
                print(f"   ❌ Error cargando {self.MODEL_FILE}. Verifica la ruta.")

        # 2. FEATURES
        self.df = pl.read_parquet(self.FEATURE_FILE)

        # 3. PROS
        if os.path.exists(self.PRO_SIG_FILE):
            if not self.quiet:
                print(f"   🏆 Base de Datos de Pros cargada: {self.PRO_SIG_FILE}")
            self.pro_stats = pl.read_parquet(self.PRO_SIG_FILE)
        else:
            if not self.quiet:
                print("   ⚠️ No se encontró 'draft_oracle_pro_signatures.parquet'. Modo SoloQ.")
            self.pro_stats = None

        # 4. TOURNAMENT META
        if os.path.exists(self.TOURNAMENT_META_FILE):
            if not self.quiet:
                print(f"   🔥 Meta de Torneos cargado: {self.TOURNAMENT_META_FILE}")
            self.meta_stats = pl.read_parquet(self.TOURNAMENT_META_FILE)
        else:
            if not self.quiet:
                print("   ⚠️ No se encontró Meta de Torneos. Se ignorará este factor.")
            self.meta_stats = None

        # 5. SYNERGY
        if os.path.exists(self.SYNERGY_FILE):
            if not self.quiet:
                print("   ❤️  Matriz de Sinergias: Cargada")
            self.synergy_raw = pl.read_parquet(self.SYNERGY_FILE)
            self.synergy_map: Dict[Tuple[int, int], float] = {}
            rows = self.synergy_raw.select(["champ_id", "champ_id_right", "syn_winrate"]).to_numpy()
            for r in rows:
                self.synergy_map[(r[0], r[1])] = r[2]
                self.synergy_map[(r[1], r[0])] = r[2]
        else:
            self.synergy_map = {}

        self._load_api()
        self._prepare_role_solver()
        self._prepare_model_cols()

        # SERIES STATE
        self.series_config = {"mode": "NORMAL", "total_games": 1, "current_game": 1}
        self.history: List[Dict[str, Any]] = []

        self.teams = {
            "BLUE": {"name": "Blue Team", "players": {}},
            "RED": {"name": "Red Team", "players": {}},
        }

        self.reset_game_board()

    # --- SUPPORT ---
    def _load_api(self):
        if not self.quiet:
            print("🌍 Conectando a Riot API...")
        try:
            v = requests.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=10).json()[0]
            r = requests.get(
                f"https://ddragon.leagueoflegends.com/cdn/{v}/data/en_US/champion.json",
                timeout=10,
            ).json()
            self.name_to_id = {k.lower(): int(vv["key"]) for k, vv in r["data"].items()}
            self.id_to_name = {int(vv["key"]): vv["id"] for k, vv in r["data"].items()}
            if not self.quiet:
                print(f"✨ API Actualizada a v{v}")
        except Exception:
            if not self.quiet:
                print("⚠️ Error API. Usando diccionario local.")
            self.name_to_id = {}
            self.id_to_name = {}

    def _prepare_role_solver(self):
        rs = self.df.group_by(["champ_id", "position"]).agg(pl.col("games_played").sum())
        ts = self.df.group_by("champ_id").agg(pl.col("games_played").sum().alias("total"))
        rp = rs.join(ts, on="champ_id").with_columns((pl.col("games_played") / pl.col("total")).alias("prob"))
        self.role_map: Dict[str, Dict[str, float]] = {}
        for row in rp.filter(pl.col("prob") > 0.02).to_dicts():
            c = self.id_to_name.get(row["champ_id"])
            if c:
                if c not in self.role_map:
                    self.role_map[c] = {}
                self.role_map[c][row["position"]] = row["prob"]

    def _prepare_model_cols(self):
        try:
            self.model_cols = self.model.feature_names
        except Exception:
            self.model_cols = []

    # --- DATA / ROSTERS (SQL) ---
    def set_roster_auto(self, side: str, team_name: str):
        if not self.quiet:
            print(f"🔎 Buscando alineación para '{team_name}' en la base de datos...")

        if not os.path.exists(self.DB_FILE):
            if not self.quiet:
                print(f"❌ No se encontró '{self.DB_FILE}'.")
            return

        try:
            side = side.upper()
            self.teams[side]["name"] = team_name
            self.teams[side]["players"] = {}

            db_role_map = {
                "Top": "top",
                "Jungle": "jungle",
                "Mid": "middle",
                "Middle": "middle",
                "ADC": "bottom",
                "Bot": "bottom",
                "Bottom": "bottom",
                "Support": "utility",
                "Utility": "utility",
            }

            # Primary schema (as in Testing.ipynb): players + teams tables
            query_players_teams = """
            SELECT p.nickname, p.role
            FROM players p
            JOIN teams t ON p.team_id = t.id
            WHERE UPPER(t.name) = UPPER(?)
            """

            # Fallback schema (used by the app DB): league views with one row per team
            view_candidates = ["view_lck", "view_lpl", "view_lcs", "view_lec"]

            with sqlite3.connect(self.DB_FILE) as conn:
                cursor = conn.cursor()

                results = None
                try:
                    cursor.execute(query_players_teams, (team_name,))
                    results = cursor.fetchall()
                except sqlite3.OperationalError:
                    results = None

                if results:
                    players_found = 0
                    for nickname, db_role in results:
                        app_role = db_role_map.get(db_role)
                        if app_role:
                            self.teams[side]["players"][app_role] = nickname
                            players_found += 1

                    if not self.quiet:
                        print(f"✅ Alineación de {team_name} cargada ({players_found} titulares encontrados).")
                        for r in ["top", "jungle", "middle", "bottom", "utility"]:
                            p = self.teams[side]["players"].get(r, "---")
                            print(f"   - {r.upper()}: {p}")
                    return

                # Fallback: try views (team, top, jungle, mid, adc, utility)
                for view in view_candidates:
                    try:
                        cursor.execute(
                            f"SELECT top, jungle, mid, adc, utility FROM {view} WHERE team = ?1 COLLATE NOCASE",
                            (team_name,),
                        )
                        row = cursor.fetchone()
                    except sqlite3.OperationalError:
                        continue

                    if row:
                        self.teams[side]["players"] = {
                            "top": row[0] or "",
                            "jungle": row[1] or "",
                            "middle": row[2] or "",
                            "bottom": row[3] or "",
                            "utility": row[4] or "",
                        }

                        if not self.quiet:
                            print("✅ Alineación cargada desde vistas de liga.")
                            for r in ["top", "jungle", "middle", "bottom", "utility"]:
                                p = self.teams[side]["players"].get(r, "---")
                                print(f"   - {r.upper()}: {p}")
                        return

            if not self.quiet:
                print(f"⚠️ No se encontró el equipo '{team_name}' en la DB. Intenta con el nombre exacto.")

        except Exception as e:
            if not self.quiet:
                print(f"❌ Error leyendo DB: {e}")

    # --- BIAS ---
    def get_pro_bias(self, player_name: Optional[str], champ_name: str) -> Tuple[float, str]:
        if self.pro_stats is None or not player_name or player_name.lower() in ["none", ""]:
            return 0.0, ""

        stats = self.pro_stats.filter(
            (pl.col("player_name").str.to_lowercase() == player_name.lower())
            & (pl.col("champion_name").str.to_lowercase() == champ_name.lower())
        )

        if stats.height == 0:
            return -0.02, "❓New"

        try:
            games = stats["games_played"][0]
            wr = stats["pro_winrate"][0] * 100
            score = stats["proficiency_score"][0]

            if score > 0.15:
                return 0.10, f"🌟GOD ({games}g {wr:.0f}%)"
            if games > 10:
                return 0.05, f"✅Main ({games}g)"
            if wr < 40 and games > 5:
                return -0.05, f"❌Bad ({wr:.0f}%)"
            return 0.01, f"ℹ️Ok ({games}g)"
        except Exception:
            return 0.0, "⚠️Err"

    def get_tournament_bias(self, champ_name: str) -> Tuple[float, str]:
        if self.meta_stats is None:
            return 0.0, ""

        row = self.meta_stats.filter(pl.col("champ_key") == champ_name.lower())
        if row.height == 0:
            return 0.0, ""

        presence = row["tourney_presence"][0]
        wr = row["tourney_winrate"][0] * 100

        if presence > 40:
            return 0.06, f"🔥Meta King ({presence} picks)"
        if presence > 15 and wr > 55:
            return 0.04, f"📈Hidden OP ({wr:.0f}% WR)"
        if presence > 10:
            return 0.02, f"✅Meta ({presence} picks)"

        return 0.0, ""

    def predict_final_matchup(self):
        # Kept as-is (placeholder heuristic)
        if len(self.blue_picks) < 5 or len(self.red_picks) < 5:
            if not self.quiet:
                print("⚠️ Faltan picks para predecir el resultado final.")
            return

        if not self.quiet:
            print("\n⚖️  CALCULANDO PREDICCIÓN FINAL DEL PARTIDO...")

        import random

        base_wr = 0.50 + (random.uniform(-0.08, 0.08))

        if not self.quiet:
            print(f"📊 Probabilidad de Victoria BLUE: {base_wr:.1%}")
            if base_wr > 0.5:
                print("🚀 PREDICCIÓN: GANA BLUE TEAM")
            else:
                print("🚀 PREDICCIÓN: GANA RED TEAM")

    def get_tactical_analysis(self, champ_id: int, champ_stats: Any, my_role: str, target_side: str) -> str:
        reasons: List[str] = []

        # A. SYNERGY (YOUR TEAM)
        my_allies = self.blue_picks if target_side == "BLUE" else self.red_picks
        best_syn_score = 0
        best_syn_partner = ""

        for ally_name in my_allies:
            ally_id = self.name_to_id.get(ally_name.lower())
            if not ally_id or ally_id == champ_id:
                continue

            wr = self.synergy_map.get((champ_id, ally_id), 0.5)
            if wr > 0.53:
                diff = wr - 0.5
                if diff > best_syn_score:
                    best_syn_score = diff
                    best_syn_partner = ally_name

        if best_syn_partner:
            reasons.append(f"🤝Combo con {best_syn_partner} ({(0.5 + best_syn_score):.0%} WR)")

        # B. MATCHUP (VS ENEMY)
        enemies = self.red_picks if target_side == "BLUE" else self.blue_picks
        enemy_roles = self._solve_roles(enemies)
        role_to_enemy = {v: k for k, v in enemy_roles.items()}
        enemy_laner = role_to_enemy.get(my_role)

        if enemy_laner:
            enemy_id = self.name_to_id.get(enemy_laner.lower())
            enemy_row = self.df.filter(pl.col("champ_id") == enemy_id).mean()

            if enemy_row.height > 0:
                my_prio = champ_stats["style_lane_dominance"] or 0
                en_prio = enemy_row["style_lane_dominance"][0] or 0

                my_scale = champ_stats["style_gold_hunger"] or 0
                en_scale = enemy_row["style_gold_hunger"][0] or 0

                if my_prio > en_prio + 2:
                    reasons.append(f"⚔️Gana línea a {enemy_laner} (Dominante)")
                elif my_prio < en_prio - 2:
                    reasons.append(f"🛡️Jugar seguro vs {enemy_laner} (Prio-)")

                if my_scale > en_scale + 2:
                    reasons.append(f"📈Outscalea a {enemy_laner} (Late)")
                elif my_prio > en_prio + 1 and my_scale < en_scale:
                    reasons.append(f"⚡Debe stompear early a {enemy_laner}")

        return " | ".join(reasons)

    # --- GAME STATE ---
    def configure_series(self, mode: str, total_games: int):
        modes = {"NORMAL": "NORMAL", "FEARLESS": "FEARLESS", "IRONMAN": "IRONMAN"}
        self.series_config["mode"] = modes.get(mode.upper(), "NORMAL")
        self.series_config["total_games"] = max(1, min(5, int(total_games)))
        self.history = []
        self.series_config["current_game"] = 1
        self.reset_game_board()

    def reset_game_board(self):
        self.blue_picks: List[str] = []
        self.red_picks: List[str] = []
        self.bans: List[str] = []
        self.blue_roles: Dict[str, str] = {}
        self.red_roles: Dict[str, str] = {}
        if not self.quiet:
            self.print_dashboard(last_action="Partida Iniciada")

    def get_forbidden_champs(self, my_side: str):
        forbidden = set(self.blue_picks + self.red_picks + self.bans)
        mode = self.series_config["mode"]
        for prev in self.history:
            if mode == "FEARLESS":
                if my_side == "BLUE":
                    forbidden.update(prev["blue_picks"])
                else:
                    forbidden.update(prev["red_picks"])
            elif mode == "IRONMAN":
                forbidden.update(prev["blue_picks"] + prev["red_picks"] + prev["bans"])
        return forbidden

    def get_blocked_count(self):
        mode = self.series_config["mode"]
        if mode == "NORMAL":
            return 0
        blocked = set()
        for prev in self.history:
            if mode == "FEARLESS":
                blocked.update(prev["blue_picks"] + prev["red_picks"])
            elif mode == "IRONMAN":
                blocked.update(prev["blue_picks"] + prev["red_picks"] + prev["bans"])
        return len(blocked)

    def add_ban(self, champ_name: str):
        c = self._resolve_name(champ_name)
        if not c:
            return
        self.bans.append(c)
        if not self.quiet:
            self.print_dashboard(last_action=f"🚫 BAN: {c}")

    def add_pick(self, side: str, champ_name: str):
        c = self._resolve_name(champ_name)
        if not c:
            return
        forbidden = self.get_forbidden_champs(side)
        if c in forbidden:
            if not self.quiet:
                print(f"🔒 BLOQUEADO ({self.series_config['mode']}): {c} no disponible.")
            return
        if side == "BLUE":
            self.blue_picks.append(c)
        else:
            self.red_picks.append(c)
        if not self.quiet:
            self.print_dashboard(last_action=f"✅ {side} PICK: {c}")

    def end_game(self):
        self.history.append(
            {"blue_picks": self.blue_picks.copy(), "red_picks": self.red_picks.copy(), "bans": self.bans.copy()}
        )
        if self.series_config["current_game"] >= self.series_config["total_games"]:
            if not self.quiet:
                print("\n🏆🏁 SERIE FINALIZADA.")
            return
        if not self.quiet:
            print("\n🔄 CAMBIANDO DE LADO...")
        self.series_config["current_game"] += 1
        self.reset_game_board()

    # --- SUGGESTIONS ---
    def suggest_picks(self, side: str):
        team = self.teams[side]
        if not self.quiet:
            print(f"🧠 Buscando los Mejores Picks para {team['name']}...")
        self._analyze_and_print(side, is_ban_mode=False)

    def suggest_bans(self, my_side: str):
        enemy_side = "RED" if my_side == "BLUE" else "BLUE"
        enemy_team = self.teams[enemy_side]
        if not self.quiet:
            print(f"🛡️ Analizando AMENAZAS de {enemy_team['name']} (Sugerencia de Ban)...")
        self._analyze_and_print(enemy_side, is_ban_mode=True)

    def get_suggestions(self, target_side: str, is_ban_mode: bool, roles: Optional[List[str]] = None) -> Dict[str, Any]:
        """Structured version of _analyze_and_print() for UI consumption.

        Logic is preserved; only the output is returned instead of printed.
        If `roles` is provided, it overrides the inferred open roles (useful for flex picks).
        """

        forbidden = self.get_forbidden_champs(target_side)

        # Keep the original role inference; only the output selection is optionally overridden.
        self.blue_roles = self._solve_roles(self.blue_picks)
        self.red_roles = self._solve_roles(self.red_picks)
        target_roles = self.blue_roles if target_side == "BLUE" else self.red_roles

        inferred_open_roles = list({"TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"} - set(target_roles.values()))
        open_roles = roles if roles is not None else inferred_open_roles

        if not open_roles:
            # As before, if there are no open roles, do final prediction (placeholder)
            self.predict_final_matchup()
            return {
                "target_side": target_side,
                "is_ban_mode": is_ban_mode,
                "open_roles": [],
                "recommendations": {},
                "blocked_count": self.get_blocked_count(),
                "mode": self.series_config["mode"],
                "game": self.series_config["current_game"],
                "total_games": self.series_config["total_games"],
            }

        suggestions: List[Suggestion] = []

        for role in open_roles:
            p_name = self.teams[target_side]["players"].get(role.lower(), None)

            raw_cands = self.df.filter(pl.col("position") == role)

            cands = raw_cands.group_by("champ_id").agg(
                [
                    pl.col("games_played").sum(),
                    ((pl.col("stat_winrate") * pl.col("games_played")).sum() / pl.col("games_played").sum()).alias(
                        "stat_winrate"
                    ),
                    pl.col("style_lane_dominance").mean().fill_null(0),
                    pl.col("style_gold_hunger").mean().fill_null(0),
                ]
            )

            total_games = cands["games_played"].sum()
            cands = cands.filter(pl.col("games_played") > 100)
            cands = cands.with_columns((pl.col("games_played") / total_games).alias("pr")).filter(pl.col("pr") > 0.005)
            cand_pd = cands.sort("stat_winrate", descending=True).limit(40).to_pandas()

            for _, row in cand_pd.iterrows():
                c_name = self.id_to_name.get(row["champ_id"])
                if not c_name or c_name in forbidden:
                    continue

                base_score = row["stat_winrate"]
                pro_bonus, pro_note = self.get_pro_bias(p_name, c_name)
                meta_bonus, meta_note = self.get_tournament_bias(c_name)
                final_score = base_score + pro_bonus + meta_bonus

                tactical_note = self.get_tactical_analysis(int(row["champ_id"]), row, role, target_side)

                parts: List[str] = []
                if pro_note:
                    parts.append(pro_note)
                if meta_note:
                    parts.append(meta_note)
                if tactical_note:
                    parts.append(tactical_note)
                elif row["stat_winrate"] > 0.52:
                    parts.append("Stats Fuertes")

                reason_text = " || ".join(parts)

                tags: List[str] = []
                if pro_bonus > 0:
                    tags.append("👤")
                if meta_bonus > 0:
                    tags.append("🏆")

                threat = ""
                if is_ban_mode:
                    threat = "Normal"
                    if final_score > 0.60:
                        threat = "☠️LETHAL"
                    elif final_score > 0.55:
                        threat = "⚠️HIGH"

                suggestions.append(
                    Suggestion(
                        role=role,
                        champion=c_name,
                        score=float(final_score),
                        tactical=reason_text,
                        tags="".join(tags),
                        threat=threat,
                    )
                )

        # sort and top-5 per role
        suggestions.sort(key=lambda s: s.score, reverse=True)
        recs: Dict[str, List[Dict[str, Any]]] = {r: [] for r in open_roles}
        for role in open_roles:
            role_items = [s for s in suggestions if s.role == role][:5]
            recs[role] = [
                {
                    "champion": s.champion,
                    "score": s.score,
                    "tags": s.tags,
                    "threat": s.threat,
                    "tactical": s.tactical,
                }
                for s in role_items
            ]

        return {
            "target_side": target_side,
            "is_ban_mode": is_ban_mode,
            "open_roles": open_roles,
            "inferred_open_roles": inferred_open_roles,
            "recommendations": recs,
            "blocked_count": self.get_blocked_count(),
            "mode": self.series_config["mode"],
            "game": self.series_config["current_game"],
            "total_games": self.series_config["total_games"],
            "teams": {
                "BLUE": {"name": self.teams["BLUE"]["name"], "players": self.teams["BLUE"]["players"]},
                "RED": {"name": self.teams["RED"]["name"], "players": self.teams["RED"]["players"]},
            },
        }

    def _analyze_and_print(self, target_side: str, is_ban_mode: bool):
        res = self.get_suggestions(target_side, is_ban_mode, roles=None)
        open_roles = res["open_roles"]

        if not open_roles:
            return

        t = "🚫 SUGERENCIA DE BANS" if is_ban_mode else "✅ SUGERENCIA DE PICKS"
        print(f"\n{t} ({target_side}):")

        df_res_rows: List[Dict[str, Any]] = []
        for role in open_roles:
            for rec in res["recommendations"].get(role, []):
                df_res_rows.append(
                    {
                        "Rol": role,
                        "Campeón": rec["champion"],
                        "Score": rec["score"],
                        "Tags": rec.get("tags", ""),
                        "Threat": rec.get("threat", ""),
                        "Análisis Táctico": rec.get("tactical", ""),
                    }
                )

        df_res = pd.DataFrame(df_res_rows)

        for role in open_roles:
            p_name = self.teams[target_side]["players"].get(role.lower(), "Unknown")
            print(f"\n📍 {role} ({p_name}):")
            top_5 = df_res[df_res["Rol"] == role].head(5)
            cols = ["Campeón", "Score", "Tags", "Análisis Táctico"]
            if is_ban_mode:
                cols = ["Campeón", "Score", "Threat", "Análisis Táctico"]
            if not top_5.empty:
                print(top_5[cols].to_string(index=False, formatters={"Score": "{:.1%}".format}))

    def _resolve_name(self, text: str) -> Optional[str]:
        matches = [k for k in self.name_to_id.keys() if text.lower() in k]
        return self.id_to_name[self.name_to_id[min(matches, key=len)]] if matches else None

    def _solve_roles(self, picks: List[str]) -> Dict[str, str]:
        if not picks:
            return {}
        roles = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]
        best_sc, best_assign = -1, {}
        for combo in itertools.permutations(roles, len(picks)):
            sc, valid = 1.0, True
            temp = {}
            for i, p in enumerate(picks):
                prob = self.role_map.get(p, {}).get(combo[i], 0.0001)
                if prob < 0.05:
                    prob *= 0.1
                sc *= prob
                temp[p] = combo[i]
                if sc < 1e-12:
                    valid = False
                    break
            if valid and sc > best_sc:
                best_sc = sc
                best_assign = temp
        return best_assign

    # --- DISPLAY (CLI) ---
    def print_dashboard(self, last_action: str = "Esperando acción..."):
        self.blue_roles = self._solve_roles(self.blue_picks)
        self.red_roles = self._solve_roles(self.red_picks)
        border = "═" * 86
        print("\n" * 2)
        print(f"╔{border}╗")
        blocked = self.get_blocked_count()
        header = (
            f" JUEGO {self.series_config['current_game']}/{self.series_config['total_games']} | "
            f"MODO: {self.series_config['mode']} | BLOQUEADOS: {blocked}"
        )
        print(f"║ {header:<84} ║")
        print(f"╠{border}╣")

        b_n, r_n = self.teams["BLUE"]["name"], self.teams["RED"]["name"]
        print(f"║ 🔵 {b_n:<38}  VS  {r_n:>38} 🔴 ║")

        bans_txt = ", ".join(self.bans) if self.bans else "Ninguno"
        print(f"║ 🚫 BANS ACTIVOS: {bans_txt:<67} ║")
        print(f"╠{border}╣")

        roles = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]
        inv_b = {v: k for k, v in self.blue_roles.items()}
        inv_r = {v: k for k, v in self.red_roles.items()}

        for r in roles:
            p_b = self.teams["BLUE"]["players"].get(r.lower(), "")
            c_b = inv_b.get(r, "---")
            str_b = f"{c_b} ({p_b})" if p_b and c_b != "---" else c_b

            p_r = self.teams["RED"]["players"].get(r.lower(), "")
            c_r = inv_r.get(r, "---")
            str_r = f"({p_r}) {c_r}" if p_r and c_r != "---" else c_r

            print(f"║ {str_b:<35} < {r:^8} > {str_r:>35} ║")

        print(f"╚{border}╝")
        print(f"📢 ÚLTIMA ACCIÓN: {last_action}\n")


def run_interactive():
    app = TournamentDraft(quiet=False)

    print("\n🕹️ COMANDOS DE TORNEO (AUTO-ROSTER):")
    print("  setup             -> Configurar")
    print("  roster [B/R] [Team] -> Ej: 'roster BLUE T1'")
    print("  b [champ]         -> Pick Blue")
    print("  r [champ]         -> Pick Red")
    print("  ban [champ]       -> Banear")
    print("  s b / s r         -> Sugerir PICK")
    print("  sb b / sb r       -> Sugerir BAN")
    print("  next              -> Siguiente Partida")

    while True:
        try:
            cmd = input(">> ").strip()
            parts = cmd.split()
            if not parts:
                continue
            act = parts[0].lower()

            if act == "setup":
                m = input("Modo (NORMAL/FEARLESS/IRONMAN): ").strip().upper() or "NORMAL"
                try:
                    g = int(input("Número de Partidas (1-5): "))
                except Exception:
                    g = 1
                app.configure_series(m, g)
            elif act == "roster" and len(parts) >= 3:
                app.set_roster_auto(parts[1].upper(), " ".join(parts[2:]))

            elif act == "ban":
                app.add_ban(" ".join(parts[1:]))
            elif act == "b":
                app.add_pick("BLUE", " ".join(parts[1:]))
            elif act == "r":
                app.add_pick("RED", " ".join(parts[1:]))
            elif act == "next":
                app.end_game()

            elif act == "s":
                side = "BLUE" if len(parts) > 1 and parts[1].lower().startswith("b") else "RED"
                app.suggest_picks(side)
            elif act == "sb":
                side = "BLUE" if len(parts) > 1 and parts[1].lower().startswith("b") else "RED"
                app.suggest_bans(side)

            elif act == "exit":
                break
            else:
                print(f"❌ '{act}' no reconocido.")
        except Exception as e:
            print(f"⚠️ Error: {e}")


if __name__ == "__main__":
    run_interactive()
