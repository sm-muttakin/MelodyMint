"""
MelodyMint sample data seeder (auth-aware version).

Usage:
    1. Start the server:  uvicorn app.main:app --reload
    2. In another terminal:  python3 seed_data.py

Registers real accounts (with passwords), logs each one in to get a JWT,
then uses that JWT for every action — exactly like the real frontend does.
"""

import requests

BASE = "http://127.0.0.1:8000"
PASSWORD = "password123"


def register_and_login(username, email, role):
    requests.post(f"{BASE}/auth/register", json={
        "username": username, "email": email, "password": PASSWORD, "role": role
    })
    r = requests.post(f"{BASE}/auth/login", data={"username": username, "password": PASSWORD})
    r.raise_for_status()
    token = r.json()["access_token"]
    me = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    return {"token": token, "headers": {"Authorization": f"Bearer {token}"}, **me}


def main():
    print("== Registering + logging in users ==")
    listeners = [
        register_and_login("sm", "sm@example.com", "listener"),
        register_and_login("nafis", "nafis@example.com", "listener"),
        register_and_login("tanha", "tanha@example.com", "listener"),
        register_and_login("rafi", "rafi@example.com", "listener"),
    ]
    artists = [
        register_and_login("artist_arko", "arko@example.com", "artist"),
        register_and_login("artist_meem", "meem@example.com", "artist"),
    ]
    for u in listeners + artists:
        print(f"  {u['username']:<14} user_id={u['user_id']}")

    print("\n== Creating songs (as each artist) ==")
    def create_song(artist, title, name, duration):
        r = requests.post(f"{BASE}/songs/", headers=artist["headers"], json={
            "title": title, "artist_name": name, "duration_sec": duration
        })
        r.raise_for_status()
        return r.json()

    songs = [
        create_song(artists[0], "Rainy Days", "Arko", 210),
        create_song(artists[0], "Late Night Drive", "Arko", 195),
        create_song(artists[1], "Travel Light", "Meem", 240),
        create_song(artists[1], "Soft Focus", "Meem", 180),
    ]
    for s in songs:
        print(f"  {s['title']:<18} song_id={s['song_id']} owner_id={s['owner_id']}")

    print("\n== Creating tags (as sm) ==")
    def create_tag(user, name, category):
        r = requests.post(f"{BASE}/tags/", headers=user["headers"], json={
            "tag_name": name, "tag_category": category
        })
        r.raise_for_status()
        return r.json()

    tags = [
        create_tag(listeners[0], "rainy", "mood"),
        create_tag(listeners[0], "travel", "context"),
        create_tag(listeners[0], "soft", "mood"),
        create_tag(listeners[0], "lofi", "genre"),
    ]
    for t in tags:
        print(f"  {t['tag_name']:<10} tag_id={t['tag_id']} category={t['tag_category']}")

    print("\n== Suggesting tags for songs ==")
    def suggest_tag(user, song, tag):
        r = requests.post(f"{BASE}/song-tags/", headers=user["headers"], json={
            "song_id": song["song_id"], "tag_id": tag["tag_id"]
        })
        r.raise_for_status()
        return r.json()

    song_tags = [
        suggest_tag(listeners[0], songs[0], tags[0]),
        suggest_tag(listeners[1], songs[0], tags[3]),
        suggest_tag(listeners[2], songs[2], tags[1]),
        suggest_tag(listeners[3], songs[3], tags[2]),
    ]
    for st in song_tags:
        print(f"  song_tag_id={st['song_tag_id']} song_id={st['song_id']} tag_id={st['tag_id']}")

    print("\n== Casting votes (enough to push the first tag past the reward threshold) ==")
    def vote(user, song_tag, value):
        r = requests.post(f"{BASE}/song-tags/vote", headers=user["headers"], json={
            "song_tag_id": song_tag["song_tag_id"], "value": value
        })
        return r

    voters = listeners + artists
    target = song_tags[0]
    for voter in voters[:5]:
        r = vote(voter, target, 1)
        if r.ok:
            result = r.json()
            print(f"  vote by {voter['username']:<14} -> upvotes={result['upvotes']} status={result['status']}")
        else:
            print(f"  vote by {voter['username']} failed: {r.json()}")

    vote(listeners[2], song_tags[1], -1)
    vote(listeners[0], song_tags[2], 1)

    print("\n== Token purchases and gifting ==")
    def transact(user, to_user_id, amount, txn_type):
        r = requests.post(f"{BASE}/transactions/", headers=user["headers"], json={
            "to_user_id": to_user_id, "amount": amount, "txn_type": txn_type
        })
        r.raise_for_status()
        return r.json()

    transact(listeners[0], listeners[0]["user_id"], 100, "buy")
    transact(listeners[1], listeners[1]["user_id"], 60, "buy")
    transact(listeners[0], listeners[1]["user_id"], 20, "gift")

    def wallet(user):
        r = requests.get(f"{BASE}/users/{user['user_id']}/wallet", headers=user["headers"])
        return r.json()

    print(f"  sm wallet:    {wallet(listeners[0])}")
    print(f"  nafis wallet: {wallet(listeners[1])}")

    print("\n== Logging listens (crosses earning threshold for artist_arko) ==")
    def log_listen(user, song, sec):
        r = requests.post(f"{BASE}/listening/", headers=user["headers"], json={
            "song_id": song["song_id"], "listened_sec": sec
        })
        r.raise_for_status()

    log_listen(listeners[0], songs[0], 200)
    log_listen(listeners[1], songs[0], 150)  # cumulative 350s -> 1 token
    print(f"  artist_arko wallet: {wallet(artists[0])}")

    print("\n== Building a playlist (as sm) ==")
    r = requests.post(f"{BASE}/playlists/", headers=listeners[0]["headers"], json={"playlist_name": "Chill Mix"})
    playlist = r.json()
    requests.post(f"{BASE}/playlists/{playlist['playlist_id']}/songs", headers=listeners[0]["headers"], json={
        "song_id": songs[0]["song_id"], "position": 1
    })
    requests.post(f"{BASE}/playlists/{playlist['playlist_id']}/songs", headers=listeners[0]["headers"], json={
        "song_id": songs[2]["song_id"], "position": 2
    })
    print(f"  playlist_id={playlist['playlist_id']} with 2 songs")

    print("\n== Updating playback settings (as sm) ==")
    r = requests.patch(f"{BASE}/playback-settings/me", headers=listeners[0]["headers"], json={
        "volume": 55, "shuffle": True, "loop": False
    })
    print(f"  {r.json()}")

    print("\nDone. All sample data seeded successfully.")
    print("\nLogin with any of these to explore (password: password123):")
    for u in listeners + artists:
        print(f"  {u['username']}")
    print("\nTo get an admin account, register/pick a user then run this SQL:")
    print("  UPDATE user_account SET role='admin' WHERE username='sm';")


if __name__ == "__main__":
    main()
