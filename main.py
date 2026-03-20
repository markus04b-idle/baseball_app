from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI
from sqlmodel import Session, select
from models import engine, Teams, Batting, People

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

app.mount("/", StaticFiles(directory="static", html=True), name="static")
