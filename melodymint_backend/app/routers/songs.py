import wave
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from mutagen import File as MutagenFile

from app.db import fetch_all, fetch_one, execute
from app.schemas.schemas import SongCreate, SongOut
from app.auth import get_current_user, require_artist_or_admin

router = APIRouter(prefix="/songs", tags=["songs"])

AUDIO_DIR = Path(__file__).resolve().parent.parent.parent / "media" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".flac"}


# helper: turn a raw database song row into the JSON shape the frontend expects (builds the audio_url)
def _song_to_out(song: dict) -> dict:
    return {
        "song_id": song["song_id"],
        "owner_id": song["owner_id"],
        "title": song["title"],
        "artist_name": song["artist_name"],
        "duration_sec": song["duration_sec"],
        "audio_url": f"/media/audio/{song['audio_filename']}" if song.get("audio_filename") else None,
    }


# helper: figure out how many seconds long an uploaded audio file actually is
def _detect_duration_sec(path: Path) -> int:
    try:
        audio = MutagenFile(path)
        if audio and audio.info and audio.info.length:
            return int(audio.info.length)
    except Exception:
        pass
    if path.suffix.lower() == ".wav":
        try:
            with wave.open(str(path), "rb") as w:
                frames = w.getnframes()
                rate = w.getframerate()
                if rate:
                    return int(frames / rate)
        except Exception:
            pass
    return 0


# make a song row with no real audio file (duration typed in by hand) — artists/admins only
@router.post("/", response_model=SongOut)
def create_song(payload: SongCreate, current_user: dict = Depends(require_artist_or_admin)):
    """Only artist (or admin) accounts can create songs — enforced server-side."""
    song = execute(
        "INSERT INTO song (owner_id, title, artist_name, duration_sec) VALUES (%s, %s, %s, %s) RETURNING *",
        (current_user["user_id"], payload.title, payload.artist_name, payload.duration_sec),
        returning=True,
    )
    return _song_to_out(song)


# save a real audio file to disk, read its length automatically, make the song row — artists/admins only
@router.post("/upload", response_model=SongOut)
async def upload_song(
    title: str = Form(...),
    artist_name: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_artist_or_admin),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    stored_filename = f"{uuid.uuid4().hex}{ext}"
    stored_path = AUDIO_DIR / stored_filename

    contents = await file.read()
    with open(stored_path, "wb") as f:
        f.write(contents)

    duration_sec = _detect_duration_sec(stored_path)

    song = execute(
        "INSERT INTO song (owner_id, title, artist_name, duration_sec, audio_filename) "
        "VALUES (%s, %s, %s, %s, %s) RETURNING *",
        (current_user["user_id"], title, artist_name, duration_sec, stored_filename),
        returning=True,
    )
    return _song_to_out(song)


# type something in a search box -> find songs whose title or artist matches
@router.get("/search", response_model=list[SongOut])
def search_songs(q: str = Query(..., min_length=1)):
    """Full-text-ish search across song title and artist name. Parameterized
    to avoid SQL injection even though it's a LIKE pattern."""
    like = f"%{q}%"
    results = fetch_all(
        "SELECT * FROM song WHERE title ILIKE %s OR artist_name ILIKE %s", (like, like)
    )
    return [_song_to_out(s) for s in results]


# look up one song by its id number
@router.get("/{song_id}", response_model=SongOut)
def get_song(song_id: int):
    song = fetch_one("SELECT * FROM song WHERE song_id = %s", (song_id,))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return _song_to_out(song)


# give back every song there is
@router.get("/", response_model=list[SongOut])
def list_songs():
    return [_song_to_out(s) for s in fetch_all("SELECT * FROM song")]
