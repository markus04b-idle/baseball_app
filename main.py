from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI
from sqlmodel import Session, select
from models import engine, Teams

app = FastAPI()

@app.get("/years")
async def get_years():
    with Session(engine) as session:
        statement = select(Teams.yearID).distinct().order_by(Teams.yearID)
        years = session.exec(statement).all()
    return years

app.mount("/", StaticFiles(directory="static", html=True), name="static")