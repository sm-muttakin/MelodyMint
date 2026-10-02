# MelodyMint Backend

FastAPI + PostgreSQL backend implementing the finalized MelodyMint ERD
(tag & token-based music sharing platform — CSE 216 Database Sessional).

## 1. Prerequisites

- Python 3.10+
- PostgreSQL running locally (or a remote instance)

## 2. Set up PostgreSQL

```sql
CREATE DATABASE melodymint;
CREATE USER melodymint_user WITH PASSWORD 'melodymint_pass';
GRANT ALL PRIVILEGES ON DATABASE melodymint TO melodymint_user;
```

## 3. Set up the project

```bash
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit .env if your DB user/password/host differ
```

## 4. Run the server

```bash
uvicorn app.main:app --reload
```

On startup, the app auto-creates all tables via SQLAlchemy (`Base.metadata.create_all`).
This is convenient for coursework; for a "real" deployment you'd normally use
Alembic migrations instead.

Visit **http://127.0.0.1:8000/docs** for interactive Swagger UI — you can test
every endpoint from the browser without writing any frontend code yet.

## 5. Project structure

```
app/
  database.py           # SQLAlchemy engine/session setup
  main.py                # FastAPI app, router registration, startup hook
  models/
    models.py            # SQLAlchemy ORM models (mirrors the ERD)
  schemas/
    schemas.py            # Pydantic request/response schemas
  services/
    token_service.py      # Business logic that would be PL/SQL triggers/procedures
                           # in the Oracle version: token transfers, tag-vote sync,
                           # tag-suggestion rewards, listening-based owner earnings
  routers/
    users.py               # /users, /users/{id}/wallet
    transactions.py        # /transactions  (buy / gift / spend / earn)
    songs.py                # /songs
    tags.py                  # /tags, /song-tags, /song-tags/vote, tag-based search
    playlists.py              # /playlists, /playlists/{id}/songs
    listening.py               # /listening  (logs a listen, credits owner tokens)
    playback.py                 # /playback-settings/{user_id}
```

## 6. Where the "PL/SQL logic" lives now

Since the stack moved from Oracle PL/SQL to FastAPI + PostgreSQL, the trigger/
procedure behavior from the original design lives in `app/services/token_service.py`:

| Original design                          | Now implemented as                              |
|-------------------------------------------|--------------------------------------------------|
| `transfer_tokens` procedure               | `transfer_tokens()` — buy/gift/spend/earn        |
| Trigger to sync SONG_TAG vote counts      | `sync_song_tag_votes()` — called after every vote |
| Procedure to reward tag suggester         | `reward_tag_suggestion()` — auto-called once a tag clears the approval threshold |
| Trigger to credit owner from listening time| `log_listening_and_credit_owner()`               |

Thresholds (approval votes needed, seconds-per-token, etc.) are constants at
the top of that file — tune them to match whatever your project write-up specifies.

## 7. Quick manual test flow (via /docs)

1. `POST /users/` twice — one listener, one artist. Each auto-gets a wallet + playback settings.
2. `POST /songs/` with the artist's `owner_id`.
3. `POST /tags/` to create a mood/genre tag.
4. `POST /song-tags/` to suggest that tag for the song.
5. `POST /song-tags/vote` a few times from different `user_id`s to push it past the approval threshold — the suggester's wallet gets credited automatically.
6. `POST /transactions/` with `txn_type: buy` to top up a wallet.
7. `POST /listening/` a few times — once cumulative `listened_sec` crosses the threshold, the song owner's wallet is credited.
8. `POST /playlists/` then `POST /playlists/{id}/songs` to build a playlist.
9. `PATCH /playback-settings/{user_id}` to change volume/shuffle/loop.

## 8. Next steps (frontend)

This backend is intentionally frontend-agnostic — any client (React, Flutter,
plain HTML forms) can consume it via the JSON API documented at `/docs`.
