"""
Talks to the PL/pgSQL functions/triggers in schema.sql. The real "brain"
of the token economy now lives IN the database (see schema.sql) — this
file just calls it and turns database errors into clean HTTP errors.
"""

import psycopg2.errors
from fastapi import HTTPException
from app.db import fetch_one, execute


def get_wallet_balance(user_id: int) -> int:
    """Look up one number: how many tokens this user has."""
    wallet = fetch_one("SELECT token_balance FROM wallet WHERE user_id = %s", (user_id,))
    if not wallet:
        raise HTTPException(status_code=404, detail=f"Wallet not found for user_id={user_id}")
    return wallet["token_balance"]


def transfer_tokens(from_user_id: int, to_user_id: int, amount: int, txn_type: str) -> dict:
    """Calls the fn_transfer_tokens PL/pgSQL procedure to move tokens safely.
    Catches the database's RAISE EXCEPTION and turns it into a normal 400/404."""
    try:
        return execute(
            "SELECT * FROM fn_transfer_tokens(%s, %s, %s, %s)",
            (from_user_id, to_user_id, amount, txn_type),
            returning=True,
        )
    except psycopg2.errors.RaiseException as e:
        msg = str(e)
        if "INSUFFICIENT_BALANCE" in msg:
            raise HTTPException(status_code=400, detail="Insufficient token balance")
        if "WALLET_NOT_FOUND" in msg:
            raise HTTPException(status_code=404, detail="Wallet not found")
        if "INVALID_AMOUNT" in msg:
            raise HTTPException(status_code=400, detail="Transfer amount must be positive")
        raise HTTPException(status_code=400, detail="Transfer failed")


def cast_tag_vote(song_tag_id: int, user_id: int, value: int) -> dict:
    """Records one vote. The trg_tag_vote_after_insert DB trigger does all
    the recounting/reward work automatically right after the INSERT below."""
    already_voted = fetch_one(
        "SELECT vote_id FROM tag_vote WHERE song_tag_id = %s AND user_id = %s", (song_tag_id, user_id)
    )
    if already_voted:
        raise HTTPException(status_code=400, detail="User has already voted on this song-tag pairing")

    execute("INSERT INTO tag_vote (song_tag_id, user_id, value) VALUES (%s, %s, %s)",
            (song_tag_id, user_id, value))

    # the trigger already updated song_tag by the time we get here — just read it back
    return fetch_one("SELECT * FROM song_tag WHERE song_tag_id = %s", (song_tag_id,))


def log_listening_and_credit_owner(user_id: int, song_id: int, listened_sec: int) -> dict:
    """Records one listen. The trg_listening_history_after_insert DB
    trigger automatically pays the song owner if a token was earned."""
    song = fetch_one("SELECT song_id FROM song WHERE song_id = %s", (song_id,))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    return execute(
        "INSERT INTO listening_history (user_id, song_id, listened_sec) VALUES (%s, %s, %s) RETURNING *",
        (user_id, song_id, listened_sec),
        returning=True,
    )
