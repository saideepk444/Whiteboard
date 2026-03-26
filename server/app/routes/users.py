from asyncpg import UniqueViolationError
from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from pydantic import BaseModel

from app.auth import create_token, decode_token, hash_password, verify_password
from app.db import get_pool

router = APIRouter(prefix="/api/auth")


# ---------------------------------------------------------------------------
# Request / response shapes (like input/output structs)
# ---------------------------------------------------------------------------

class SignupRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    token: str
    user_id: str
    username: str


# ---------------------------------------------------------------------------
# Dependency: extract and validate the JWT from the Authorization header.
# Any route that needs the current user declares `user=Depends(require_auth)`.
# FastAPI calls this function automatically before the route handler runs —
# think of it like a middleware applied per-function rather than globally.
# ---------------------------------------------------------------------------

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    try:
        payload = decode_token(credentials.credentials)
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest):
    pool = await get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO users (username, email, password_hash)
                VALUES ($1, $2, $3)
                RETURNING id, username
                """,
                body.username,
                body.email.lower(),
                hash_password(body.password),
            )
        except UniqueViolationError:
            raise HTTPException(status_code=409, detail="Username or email already taken")

    token = create_token(str(row["id"]), row["username"])
    return TokenResponse(token=token, user_id=str(row["id"]), username=row["username"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, username, password_hash FROM users WHERE email = $1",
            body.email.lower(),
        )

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(str(row["id"]), row["username"])
    return TokenResponse(token=token, user_id=str(row["id"]), username=row["username"])
