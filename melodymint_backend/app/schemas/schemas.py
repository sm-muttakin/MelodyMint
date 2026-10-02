from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, ConfigDict


# ---------- User ----------
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: Literal["listener", "artist"] = "listener"  # admin accounts are promoted manually, not self-registered


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: int
    username: str
    email: str
    role: str
    is_banned: bool = False


# ---------- Admin ----------
class AdminUserUpdate(BaseModel):
    role: Optional[Literal["listener", "artist", "admin"]] = None
    is_banned: Optional[bool] = None


class AdminSongTagUpdate(BaseModel):
    status: Literal["active", "removed"]
class WalletOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    wallet_id: int
    user_id: int
    token_balance: int


# ---------- Transaction ----------
class TransactionCreate(BaseModel):
    to_user_id: int
    amount: int
    txn_type: Literal["buy", "gift", "spend", "earn"]


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    txn_id: int
    from_user_id: int
    to_user_id: int
    amount: int
    txn_type: str
    created_at: datetime


# ---------- Song ----------
class SongCreate(BaseModel):
    title: str
    artist_name: str
    duration_sec: int


class SongOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    song_id: int
    owner_id: int
    title: str
    artist_name: str
    duration_sec: int
    audio_url: Optional[str] = None


# ---------- Tag ----------
class TagCreate(BaseModel):
    tag_name: str
    tag_category: Literal["genre", "mood", "context"]


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    tag_id: int
    tag_name: str
    tag_category: str


# ---------- SongTag ----------
class SongTagCreate(BaseModel):
    song_id: int
    tag_id: int


class SongTagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    song_tag_id: int
    song_id: int
    tag_id: int
    suggested_by: int
    upvotes: int
    downvotes: int
    status: str


# ---------- TagVote ----------
class TagVoteCreate(BaseModel):
    song_tag_id: int
    value: Literal[1, -1]


class TagVoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    vote_id: int
    song_tag_id: int
    user_id: int
    value: int


# ---------- Playlist ----------
class PlaylistCreate(BaseModel):
    playlist_name: str
    visibility: Literal["private", "public"] = "private"


class PlaylistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    playlist_id: int
    user_id: int
    playlist_name: str
    visibility: str


class PlaylistSongCreate(BaseModel):
    song_id: int
    position: int


class PlaylistSongOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    playlist_id: int
    song_id: int
    position: int


# ---------- ListeningHistory ----------
class ListeningHistoryCreate(BaseModel):
    song_id: int
    listened_sec: int


class ListeningHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    history_id: int
    user_id: int
    song_id: int
    listened_sec: int
    played_at: datetime


# ---------- PlaybackSettings ----------
class PlaybackSettingsUpdate(BaseModel):
    volume: Optional[int] = None
    shuffle: Optional[bool] = None
    loop: Optional[bool] = None


class PlaybackSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: int
    volume: int
    shuffle: bool
    loop: bool


# ---------- Analytics (advanced SQL query results) ----------
class TrendingTagOut(BaseModel):
    tag_id: int
    tag_name: str
    tag_category: str
    song_count: int
    total_upvotes: int
    rank: int


class TopArtistOut(BaseModel):
    user_id: int
    username: str
    song_count: int
    total_listened_sec: int
    tokens_earned: int
    rank: int
