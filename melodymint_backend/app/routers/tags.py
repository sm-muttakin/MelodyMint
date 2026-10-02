from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_all, fetch_one, execute
from app.schemas.schemas import TagCreate, TagOut, SongTagCreate, SongTagOut, TagVoteCreate, TrendingTagOut
from app.services.token_service import cast_tag_vote
from app.auth import get_current_user

router = APIRouter(tags=["tags"])


# make a brand new tag like 'rainy' or 'lofi', if it doesn't already exist
@router.post("/tags/", response_model=TagOut)
def create_tag(payload: TagCreate, current_user: dict = Depends(get_current_user)):
    if fetch_one("SELECT tag_id FROM tag WHERE tag_name = %s", (payload.tag_name,)):
        raise HTTPException(status_code=400, detail="Tag already exists")
    return execute(
        "INSERT INTO tag (tag_name, tag_category) VALUES (%s, %s) RETURNING *",
        (payload.tag_name, payload.tag_category),
        returning=True,
    )


# give back every tag there is
@router.get("/tags/", response_model=list[TagOut])
def list_tags():
    return fetch_all("SELECT * FROM tag")


# someone suggests a tag for a song — starts live, votes decide if it sticks
@router.post("/song-tags/", response_model=SongTagOut)
def suggest_song_tag(payload: SongTagCreate, current_user: dict = Depends(get_current_user)):
    if fetch_one(
        "SELECT song_tag_id FROM song_tag WHERE song_id = %s AND tag_id = %s",
        (payload.song_id, payload.tag_id),
    ):
        raise HTTPException(status_code=400, detail="This tag has already been suggested for this song")

    return execute(
        "INSERT INTO song_tag (song_id, tag_id, suggested_by) VALUES (%s, %s, %s) RETURNING *",
        (payload.song_id, payload.tag_id, current_user["user_id"]),
        returning=True,
    )


# show the active tags on one song
@router.get("/songs/{song_id}/tags", response_model=list[SongTagOut])
def get_song_tags(song_id: int):
    return fetch_all("SELECT * FROM song_tag WHERE song_id = %s AND status = 'active'", (song_id,))


# this IS the 'search by mood' feature — give back every song that has this tag
@router.get("/tags/{tag_id}/songs", response_model=list[SongTagOut])
def search_songs_by_tag(tag_id: int):
    return fetch_all("SELECT * FROM song_tag WHERE tag_id = %s AND status = 'active'", (tag_id,))


# upvote or downvote a tag suggestion
@router.post("/song-tags/vote", response_model=SongTagOut)
def vote_on_song_tag(payload: TagVoteCreate, current_user: dict = Depends(get_current_user)):
    return cast_tag_vote(payload.song_tag_id, current_user["user_id"], payload.value)


# look at what you've listened to, guess what else you'd like based on shared tags
@router.get("/recommendations/me", response_model=list[SongTagOut])
def recommend_for_me(current_user: dict = Depends(get_current_user)):
    """
    Simple content-based recommendation: find the tags on songs the user
    has listened to most, then surface other active song-tag pairings for
    those same tags (excluding songs they've already listened to).
    """
    listened = fetch_all(
        "SELECT DISTINCT song_id FROM listening_history WHERE user_id = %s", (current_user["user_id"],)
    )
    listened_ids = [r["song_id"] for r in listened]
    if not listened_ids:
        return []

    top_tags = fetch_all(
        "SELECT tag_id, COUNT(*) AS c FROM song_tag "
        "WHERE song_id = ANY(%s) AND status = 'active' "
        "GROUP BY tag_id ORDER BY c DESC LIMIT 5",
        (listened_ids,),
    )
    tag_ids = [r["tag_id"] for r in top_tags]
    if not tag_ids:
        return []

    return fetch_all(
        "SELECT * FROM song_tag WHERE tag_id = ANY(%s) AND status = 'active' "
        "AND song_id != ALL(%s) LIMIT 20",
        (tag_ids, listened_ids),
    )


# top 10 tags right now, ranked by total upvotes
@router.get("/tags/trending", response_model=list[TrendingTagOut])
def trending_tags():
    """
    ADVANCED QUERY (window function): ranks every tag by how many total
    upvotes its song-pairings have, using RANK() OVER (...) instead of
    sorting in Python. GROUP BY collapses all the songs sharing a tag
    into one row per tag first, then RANK() numbers them 1, 2, 3, ...
    """
    return fetch_all(
        """
        SELECT
            t.tag_id,
            t.tag_name,
            t.tag_category,
            COUNT(st.song_tag_id)  AS song_count,
            COALESCE(SUM(st.upvotes), 0) AS total_upvotes,
            RANK() OVER (ORDER BY COALESCE(SUM(st.upvotes), 0) DESC) AS rank
        FROM tag t
        JOIN song_tag st ON st.tag_id = t.tag_id AND st.status = 'active'
        GROUP BY t.tag_id, t.tag_name, t.tag_category
        ORDER BY rank
        LIMIT 10
        """
    )
