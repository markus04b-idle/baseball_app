from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI
from sqlmodel import Session, select
from sqlalchemy import func
from models import engine, Teams, Batting, People

# fastapi dev main.py to load website

app = FastAPI()


@app.get("/years")
async def get_years():
    with Session(engine) as session:
        years = session.exec(
            select(Teams.yearID).distinct().order_by(Teams.yearID)
        ).all()
    return years


@app.get("/teams")
async def get_teams(year: int):
    with Session(engine) as session:
        rows = session.exec(
            select(Teams.teamID, Teams.name, Teams.lgID, Teams.divID)
            .where(Teams.yearID == year)
            .order_by(Teams.lgID, Teams.divID, Teams.name)
        ).all()
    return [
        {
            "teamID": r[0],
            "name": r[1],
            "league": r[2] or "Unknown",
            "division": r[3] or "Unknown",
        }
        for r in rows
    ]


@app.get("/team-players")
async def get_team_players(year: int, teamID: str):
    with Session(engine) as session:
        player_ids = session.exec(
            select(Batting.playerID)
            .where(Batting.yearID == year, Batting.teamID == teamID)
            .distinct()
        ).all()

        players = []
        for pid in player_ids:
            person = session.get(People, pid)
            if person:
                players.append({
                    "playerID": person.playerID,
                    "first": person.nameFirst or "",
                    "last": person.nameLast or "",
                })

    players.sort(key=lambda p: (p["last"], p["first"]))
    return players


@app.get("/player-stats")
async def get_player_stats(playerID: str, year: int, teamID: str):
    with Session(engine) as session:
        row = session.exec(
            select(
                func.sum(Batting.G),
                func.sum(Batting.AB),
                func.sum(Batting.R),
                func.sum(Batting.H),
                func.sum(Batting.twoB),
                func.sum(Batting.threeB),
                func.sum(Batting.HR),
                func.sum(Batting.RBI),
                func.sum(Batting.SB),
                func.sum(Batting.CS),
            ).where(
                Batting.playerID == playerID,
                Batting.yearID == year,
                Batting.teamID == teamID,
            )
        ).first()

        keys = ["G", "AB", "R", "H", "2B", "3B", "HR", "RBI", "SB", "CS"]
        if row:
            stats = {k: (row[i] or 0) for i, k in enumerate(keys)}
        else:
            stats = {k: 0 for k in keys}

        other_team_ids = session.exec(
            select(Batting.teamID)
            .where(
                Batting.playerID == playerID,
                Batting.yearID == year,
                Batting.teamID != teamID,
            )
            .distinct()
        ).all()

        other_team_names = []
        for tid in other_team_ids:
            team = session.exec(
                select(Teams.name).where(Teams.teamID == tid, Teams.yearID == year)
            ).first()
            if team:
                other_team_names.append(team)

    return {"stats": stats, "other_teams": other_team_names}


@app.get("/player-details")
async def get_player_details(playerID: str):
    with Session(engine) as session:
        person = session.get(People, playerID)

    if not person:
        return {"error": "Player not found"}

    return {
        "playerID": person.playerID,
        "first": person.nameFirst or "",
        "last": person.nameLast or "",
        "given": person.nameGiven or "",
        "birthYear": person.birthYear,
        "birthMonth": person.birthMonth,
        "birthDay": person.birthDay,
        "birthCity": person.birthCity or "",
        "birthState": person.birthState or "",
        "birthCountry": person.birthCountry or "",
        "height": person.height,
        "weight": person.weight,
        "bats": person.bats or "",
        "throws": person.throws or "",
        "debut": person.debut or "",
        "finalGame": person.finalGame or "",
    }


app.mount("/", StaticFiles(directory="static", html=True), name="static")
