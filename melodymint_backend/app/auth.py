import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.db import fetch_one

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-change-this-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week — fine for a course project

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Reads the JWT the frontend sends on every request, figures out which
    user it belongs to, and looks that user up fresh from the database
    (so a banned/deleted user is caught immediately, not just at login).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = fetch_one(
        "SELECT user_id, username, email, role, is_banned FROM user_account WHERE user_id = %s",
        (int(user_id),),
    )
    if user is None:
        raise credentials_exception
    if user["is_banned"]:
        raise HTTPException(status_code=403, detail="This account has been banned")
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_artist_or_admin(user: dict = Depends(get_current_user)) -> dict:
    """Uploading/creating songs is an artist-only capability (admins can too, for moderation)."""
    if user["role"] not in ("artist", "admin"):
        raise HTTPException(status_code=403, detail="Only artist accounts can upload songs")
    return user
