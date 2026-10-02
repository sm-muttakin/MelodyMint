from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_all, fetch_one, execute
from app.schemas.schemas import PlaylistCreate, PlaylistOut, PlaylistSongCreate, PlaylistSongOut, SongOut
from app.auth import get_current_user

router = APIRouter(prefix="/playlists", tags=["playlists"])


# helper: make sure this playlist exists AND belongs to you (or you're admin) before touching it
def _own_playlist_or_404(playlist_id: int, current_user: dict) -> dict:
    playlist = fetch_one("SELECT * FROM playlist WHERE playlist_id = %s", (playlist_id,))
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist["user_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not your playlist")
    return playlist


# make a new empty playlist, owned by whoever's logged in
@router.post("/", response_model=PlaylistOut)
def create_playlist(payload: PlaylistCreate, current_user: dict = Depends(get_current_user)):
    return execute(
        "INSERT INTO playlist (user_id, playlist_name, visibility) VALUES (%s, %s, %s) RETURNING *",
        (current_user["user_id"], payload.playlist_name, payload.visibility),
        returning=True,
    )


# look up one playlist by its id number
@router.get("/{playlist_id}", response_model=PlaylistOut)
def get_playlist(playlist_id: int):
    playlist = fetch_one("SELECT * FROM playlist WHERE playlist_id = %s", (playlist_id,))
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


# give back every playlist a specific user owns
@router.get("/user/{user_id}", response_model=list[PlaylistOut])
def get_user_playlists(user_id: int):
    return fetch_all("SELECT * FROM playlist WHERE user_id = %s", (user_id,))


# add one song into one of YOUR playlists
@router.post("/{playlist_id}/songs", response_model=PlaylistSongOut)
def add_song_to_playlist(
    playlist_id: int,
    payload: PlaylistSongCreate,
    current_user: dict = Depends(get_current_user),
):
    _own_playlist_or_404(playlist_id, current_user)  # ownership check
    if not fetch_one("SELECT song_id FROM song WHERE song_id = %s", (payload.song_id,)):
        raise HTTPException(status_code=404, detail="Song not found")
    if fetch_one(
        "SELECT 1 FROM playlist_song WHERE playlist_id = %s AND song_id = %s",
        (playlist_id, payload.song_id),
    ):
        raise HTTPException(status_code=400, detail="Song already in playlist")

    return execute(
        "INSERT INTO playlist_song (playlist_id, song_id, position) VALUES (%s, %s, %s) RETURNING *",
        (playlist_id, payload.song_id, payload.position),
        returning=True,
    )


# give back the songs in one playlist, in the right order
@router.get("/{playlist_id}/songs", response_model=list[SongOut])
def get_playlist_songs(playlist_id: int):
    rows = fetch_all(
        "SELECT s.* FROM song s "
        "JOIN playlist_song ps ON ps.song_id = s.song_id "
        "WHERE ps.playlist_id = %s ORDER BY ps.position",
        (playlist_id,),
    )
    return [
        {
            "song_id": r["song_id"],
            "owner_id": r["owner_id"],
            "title": r["title"],
            "artist_name": r["artist_name"],
            "duration_sec": r["duration_sec"],
            "audio_url": f"/media/audio/{r['audio_filename']}" if r.get("audio_filename") else None,
        }
        for r in rows
    ]


# remove one song from one of YOUR playlists
@router.delete("/{playlist_id}/songs/{song_id}")
def remove_song_from_playlist(
    playlist_id: int, song_id: int, current_user: dict = Depends(get_current_user)
):
    _own_playlist_or_404(playlist_id, current_user)  # ownership check
    affected = execute(
        "DELETE FROM playlist_song WHERE playlist_id = %s AND song_id = %s", (playlist_id, song_id)
    )
    if affected == 0:
        raise HTTPException(status_code=404, detail="Song not in playlist")
    return {"detail": "Song removed from playlist"}
