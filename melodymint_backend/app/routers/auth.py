from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from app.db import fetch_one, execute
from app.schemas.schemas import UserRegister, UserOut, Token
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


# someone types a new username/email/password -> we make them an account, a wallet, and playback settings
@router.post("/register", response_model=UserOut)
def register(payload: UserRegister):
    if fetch_one("SELECT user_id FROM user_account WHERE username = %s", (payload.username,)):
        raise HTTPException(status_code=400, detail="Username already taken")
    if fetch_one("SELECT user_id FROM user_account WHERE email = %s", (payload.email,)):
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = execute(
        "INSERT INTO user_account (username, email, password_hash, role) "
        "VALUES (%s, %s, %s, %s) RETURNING user_id, username, email, role, is_banned",
        (payload.username, payload.email, hash_password(payload.password), payload.role),
        returning=True,
    )
    execute("INSERT INTO wallet (user_id, token_balance) VALUES (%s, 0)", (user["user_id"],))
    execute("INSERT INTO playback_settings (user_id, volume, shuffle, loop) VALUES (%s, 80, FALSE, FALSE)",
            (user["user_id"],))
    return user


# someone types username+password -> if correct, hand them a login ticket (JWT)
@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = fetch_one("SELECT * FROM user_account WHERE username = %s", (form_data.username,))
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    if user["is_banned"]:
        raise HTTPException(status_code=403, detail="This account has been banned")

    token = create_access_token(user["user_id"])
    return Token(access_token=token)


# whoever's ticket this is, tell the frontend who they are
@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    return current_user
