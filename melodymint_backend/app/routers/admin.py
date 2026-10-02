from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import fetch_all, fetch_one, execute
from app.schemas.schemas import UserOut, AdminUserUpdate, SongTagOut, AdminSongTagUpdate, TopArtistOut
from app.auth import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


# admin-only: list every user, banned ones included
@router.get("/users", response_model=list[UserOut])
def list_all_users(admin: dict = Depends(require_admin)):
    """Unlike GET /users/, this includes banned accounts too."""
    return fetch_all("SELECT user_id, username, email, role, is_banned FROM user_account")


# admin-only: change someone's role, or ban/unban them
@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: AdminUserUpdate, admin: dict = Depends(require_admin)):
    user = fetch_one("SELECT * FROM user_account WHERE user_id = %s", (user_id,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == admin["user_id"] and payload.is_banned:
        raise HTTPException(status_code=400, detail="You cannot ban yourself")

    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        return user

    set_clause = ", ".join(f"{key} = %s" for key in fields)
    params = list(fields.values()) + [user_id]
    return execute(
        f"UPDATE user_account SET {set_clause} WHERE user_id = %s "
        f"RETURNING user_id, username, email, role, is_banned",
        params,
        returning=True,
    )


@router.get("/song-tags", response_model=list[SongTagOut])
# admin-only: list flagged tag suggestions so a human can double check them
def list_song_tags_for_review(
    status: str = Query(default=None, description="Filter by status: active | removed"),
    admin: dict = Depends(require_admin),
):
    if status:
        return fetch_all("SELECT * FROM song_tag WHERE status = %s ORDER BY downvotes DESC", (status,))
    return fetch_all("SELECT * FROM song_tag ORDER BY downvotes DESC")


# admin-only: manually flip a tag back to active, or remove it
@router.patch("/song-tags/{song_tag_id}", response_model=SongTagOut)
def moderate_song_tag(song_tag_id: int, payload: AdminSongTagUpdate, admin: dict = Depends(require_admin)):
    updated = execute(
        "UPDATE song_tag SET status = %s WHERE song_tag_id = %s RETURNING *",
        (payload.status, song_tag_id),
        returning=True,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="SongTag not found")
    return updated


# admin-only: delete a song entirely
@router.delete("/songs/{song_id}")
def delete_song(song_id: int, admin: dict = Depends(require_admin)):
    affected = execute("DELETE FROM song WHERE song_id = %s", (song_id,))
    if affected == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    return {"detail": "Song deleted"}


# admin-only report: which artists are earning the most, ranked
@router.get("/analytics/top-artists", response_model=list[TopArtistOut])
def top_artists(admin: dict = Depends(require_admin)):
    """
    ADVANCED QUERY (CTE + window function + subquery): first builds a
    temporary named result (the "WITH ... AS" part, called a CTE) that
    combines each artist's songs with their listening totals and token
    earnings, THEN ranks the CTE's rows with RANK() OVER (...). This is
    the kind of multi-step report a plain SELECT can't do in one pass.
    """
    return fetch_all(
        """
        WITH artist_stats AS (
            SELECT
                u.user_id,
                u.username,
                COUNT(DISTINCT s.song_id) AS song_count,
                COALESCE(SUM(lh.listened_sec), 0) AS total_listened_sec,
                COALESCE((
                    SELECT SUM(t.amount)
                    FROM transaction t
                    WHERE t.to_user_id = u.user_id AND t.txn_type = 'earn'
                ), 0) AS tokens_earned
            FROM user_account u
            JOIN song s ON s.owner_id = u.user_id
            LEFT JOIN listening_history lh ON lh.song_id = s.song_id
            WHERE u.role = 'artist'
            GROUP BY u.user_id, u.username
        )
        SELECT
            user_id, username, song_count, total_listened_sec, tokens_earned,
            RANK() OVER (ORDER BY total_listened_sec DESC) AS rank
        FROM artist_stats
        ORDER BY rank
        """
    )
