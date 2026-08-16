import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# In Docker, env vars come from docker-compose's `env_file:` and backend/.env
# is never copied into the image, so this is a no-op there. Running locally
# (e.g. `uvicorn app.main:app`), it loads the same file directly.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
