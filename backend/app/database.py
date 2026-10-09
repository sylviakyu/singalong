import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DEFAULT_DB = Path(__file__).resolve().parents[1] / 'data' / 'app.db'
DEFAULT_DB.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.getenv('DATABASE_URL', f'sqlite:///{DEFAULT_DB}')
engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False})
@event.listens_for(engine, 'connect')
def foreign_keys(connection, _):
    connection.execute('PRAGMA foreign_keys=ON')
SessionLocal = sessionmaker(engine)
class Base(DeclarativeBase):
    pass

def get_db():
    with SessionLocal() as db:
        yield db
