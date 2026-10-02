from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_one, execute
from app.schemas.schemas import PlaybackSettingsUpdate, PlaybackSettingsOut
from app.auth import get_current_user

router = APIRouter(prefix="/playback-settings", tags=["playback"])


# get YOUR OWN volume/shuffle/loop settings
@router.get("/me", response_model=PlaybackSettingsOut)
def get_my_playback_settings(current_user: dict = Depends(get_current_user)):
    settings = fetch_one("SELECT * FROM playback_settings WHERE user_id = %s", (current_user["user_id"],))
    if not settings:
        raise HTTPException(status_code=404, detail="Playback settings not found")
    return settings


# change YOUR OWN volume/shuffle/loop settings — only the fields you send get updated
@router.patch("/me", response_model=PlaybackSettingsOut)
def update_my_playback_settings(
    payload: PlaybackSettingsUpdate, current_user: dict = Depends(get_current_user)
):
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        settings = fetch_one("SELECT * FROM playback_settings WHERE user_id = %s", (current_user["user_id"],))
        if not settings:
            raise HTTPException(status_code=404, detail="Playback settings not found")
        return settings

    # Field names come only from PlaybackSettingsUpdate's fixed set
    # (volume/shuffle/loop), never from arbitrary user input, so building
    # the SET clause from them is safe — the values themselves are still
    # passed as parameters, never interpolated into the SQL string.
    set_clause = ", ".join(f"{key} = %s" for key in fields)
    params = list(fields.values()) + [current_user["user_id"]]

    settings = execute(
        f"UPDATE playback_settings SET {set_clause} WHERE user_id = %s RETURNING *",
        params,
        returning=True,
    )
    if not settings:
        raise HTTPException(status_code=404, detail="Playback settings not found")
    return settings
