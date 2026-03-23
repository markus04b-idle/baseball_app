from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI
from sqlmodel import Session, select
from sqlalchemy import func, and_
from models import engine, Teams, Batting, People

#fastapi dev main.py to load website

app = FastAPI()

@app.get("/years")
async def get_years():
    with Session(engine) as session:
        statement = select(Teams.yearID).distinct().order_by(Teams.yearID)
        years = session.exec(statement).all()
    return years

@app.get("/teams")
async def get_teams(year: int):
    with Session(engine) as session:
        statement = select(Teams.teamID, Teams.name, Teams.lgID, Teams.divID)
        statement = statement.where(Teams.yearID == year).order_by(Teams.lgID, Teams.divID, Teams.name)
        rows = session.exec(statement).all()
    teams = []
    for row in rows:
        teams.append({
            "teamID": row[0],
            "name": row[1],
            "league": row[2] or "Unknown",
            "division": row[3] or "Unknown"
        })
    return teams

@app.get("/team-players")
async def get_team_players(year: int, teamID: str):
    with Session(engine) as session:
        statement = select(People.nameFirst, People.nameLast).join(Batting, Batting.playerID == People.playerID)
        statement = statement.where(Batting.yearID == year, Batting.teamID == teamID).distinct().order_by(People.nameLast, People.nameFirst)
        rows = session.exec(statement).all()
    players = [{"first": row[0] or "", "last": row[1] or ""} for row in rows]
    return players

@app.get("/team-players-by-name")
async def get_team_players_by_name(year: int, team_name: str):
    team_name = team_name.strip()
    with Session(engine) as session:
        # First, find the teamID
        team_statement = select(Teams.teamID).where(Teams.yearID == year, Teams.name.ilike(team_name))
        team_result = session.exec(team_statement).first()
        if not team_result:
            return []
        teamID = team_result
        # Get playerIDs for this team/year
        player_statement = select(Batting.playerID).where(Batting.yearID == year, Batting.teamID == teamID).distinct()
        player_ids = session.exec(player_statement).all()
        players = []
        for player_id in player_ids:
            # Get name
            name_statement = select(People.nameFirst, People.nameLast).where(People.playerID == player_id)
            name_result = session.exec(name_statement).first()
            if not name_result:
                continue
            first, last = name_result
            players.append({
                "playerID": player_id,
                "first": first or "",
                "last": last or ""
            })
    players.sort(key=lambda p: (p['last'], p['first']))
    return players

@app.get("/player-stats")
async def get_player_stats(playerID: str, year: int, teamID: str):
    with Session(engine) as session:
        # Get stats for this player on this team in this year
        stats_statement = select(
            func.sum(Batting.G).label("G"),
            func.sum(Batting.AB).label("AB"),
            func.sum(Batting.R).label("R"),
            func.sum(Batting.H).label("H"),
            func.sum(Batting.twoB).label("2B"),
            func.sum(Batting.threeB).label("3B"),
            func.sum(Batting.HR).label("HR"),
            func.sum(Batting.RBI).label("RBI"),
            func.sum(Batting.SB).label("SB"),
            func.sum(Batting.CS).label("CS")
        ).where(Batting.playerID == playerID, Batting.yearID == year, Batting.teamID == teamID)
        stats_result = session.exec(stats_statement).first()
        if stats_result:
            stats = {
                "G": stats_result[0] or 0,
                "AB": stats_result[1] or 0,
                "R": stats_result[2] or 0,
                "H": stats_result[3] or 0,
                "2B": stats_result[4] or 0,
                "3B": stats_result[5] or 0,
                "HR": stats_result[6] or 0,
                "RBI": stats_result[7] or 0,
                "SB": stats_result[8] or 0,
                "CS": stats_result[9] or 0
            }
        else:
            stats = {
                "G": 0,
                "AB": 0,
                "R": 0,
                "H": 0,
                "2B": 0,
                "3B": 0,
                "HR": 0,
                "RBI": 0,
                "SB": 0,
                "CS": 0
            }
        # Get other teams in this year
        other_team_ids = session.exec(select(Batting.teamID).where(Batting.playerID == playerID, Batting.yearID == year, Batting.teamID != teamID).distinct()).all()
        other_team_ids = [row[0] for row in other_team_ids]
        if other_team_ids:
            other_team_statement = select(Teams.name).where(Teams.teamID.in_(other_team_ids), Teams.yearID == year).distinct()
            other_teams = session.exec(other_team_statement).all()
            other_team_names = [row[0] for row in other_teams]
        else:
            other_team_names = []
    return {"stats": stats, "other_teams": other_team_names}

app.mount("/", StaticFiles(directory="static", html=True), name="static")
