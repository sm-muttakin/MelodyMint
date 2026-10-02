from fastapi import APIRouter, Depends

from app.schemas.schemas import TransactionCreate, TransactionOut
from app.services.token_service import transfer_tokens
from app.auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["transactions"])


# buy/gift/spend/earn tokens — figures out who's sending/receiving from your login, not the request body
@router.post("/", response_model=TransactionOut)
def create_transaction(payload: TransactionCreate, current_user: dict = Depends(get_current_user)):
    """
    'buy' and 'earn': tokens created for the logged-in user.
    'gift' and 'spend': tokens move from the logged-in user to to_user_id.
    The sender is ALWAYS the logged-in user — never taken from the request
    body — so nobody can spend or gift from someone else's wallet.
    """
    if payload.txn_type in ("buy", "earn"):
        from_id = to_id = current_user["user_id"]
    else:
        from_id = current_user["user_id"]
        to_id = payload.to_user_id

    return transfer_tokens(from_id, to_id, payload.amount, payload.txn_type)
