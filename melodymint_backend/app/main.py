from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db import get_conn
from app.routers import auth, users, transactions, songs, tags, playlists, listening, playback, admin

app = FastAPI(
    title="MelodyMint API",
    description="Backend for MelodyMint — tag & token-based music sharing platform (CSE 216). "
                "Uses raw parameterized SQL throughout — no ORM.",
    version="2.0.0",
)

# Without this, the browser blocks every request from the frontend (running
# on a different port, e.g. localhost:5173) with a generic "NetworkError" /
# "Failed to fetch" — the request never even reaches an endpoint. Dev origins
# are wide open here for convenience; lock this down to your real frontend
# URL before deploying anywhere public.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Runs schema.sql (plain CREATE TABLE IF NOT EXISTS statements) so the
    database is ready on first run, without needing a separate migration
    step. Safe to run on every restart."""
    schema_path = Path(__file__).resolve().parent.parent / "schema.sql"
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(schema_path.read_text())


MEDIA_DIR = Path(__file__).resolve().parent.parent / "media"
MEDIA_DIR.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(songs.router)
app.include_router(tags.router)
app.include_router(playlists.router)
app.include_router(listening.router)
app.include_router(playback.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "MelodyMint API"}
