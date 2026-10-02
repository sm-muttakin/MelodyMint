# MelodyMint Frontend

React (Vite) frontend for MelodyMint, talking to the FastAPI backend.

## Setup

```bash
npm install
cp .env.example .env   # only needed if your backend isn't at http://127.0.0.1:8000
npm run dev
```

Open http://localhost:5173. Make sure the backend (`uvicorn app.main:app --reload`)
is already running, and ideally seeded with `seed_data.py` so there's data to see.

## How it's organized

```
src/
  api/
    client.js         # thin fetch wrapper, one function per backend endpoint
    AppContext.jsx     # global state: list of users, "active user", toast notifications
  components/
    Sidebar.jsx         # left nav
    UserSwitcher.jsx     # dropdown to act as a different user (no auth yet)
    TagChip.jsx           # tag pill with live upvote/downvote bar, reused on 2 pages
  pages/
    DiscoverPage.jsx       # search songs by tag/mood, create new tags
    SongsPage.jsx            # upload songs, suggest/vote on tags, simulate listens
    PlaylistsPage.jsx         # create playlists, add/remove songs
    WalletPage.jsx              # balance, buy tokens, gift tokens
    SettingsPage.jsx             # playback settings, create new users
```

## Notes

- There's no login system yet — the top-right "Acting as" dropdown lets you switch
  between users you've created, and every action (uploading a song, voting, gifting
  tokens) happens as whoever is selected there. This is intentional for a course
  demo; if you want real auth later, that's a separate addition.
- "Log 60s listen" on the Songs page simulates playback — click it a few times on
  the same song and watch the owner's wallet balance increase once the cumulative
  listening time crosses the earning threshold (300s by default, set in the
  backend's `token_service.py`).
- Tag voting updates the upvote/downvote bar live and reflects the `status`
  (active/removed) the backend computes.
