from fastapi import APIRouter, Depends

from app.schemas.schemas import ListeningHistoryCreate, ListeningHistoryOut
from app.services.token_service import log_listening_and_credit_owner
from app.auth import get_current_user

router = APIRouter(prefix="/listening", tags=["listening"])


# record that someone listened to a song for N seconds — the DB trigger pays the owner automatically
@router.post("/", response_model=ListeningHistoryOut)
def log_listening(payload: ListeningHistoryCreate, current_user: dict = Depends(get_current_user)):
    return log_listening_and_credit_owner(current_user["user_id"], payload.song_id, payload.listened_sec)
