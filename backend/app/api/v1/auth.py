from fastapi import APIRouter, Depends, HTTPException, status, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.db import get_db
from app.models.base import User
from pydantic import BaseModel, EmailStr
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
# Make bearer optional where used (via custom dependency)
security = HTTPBearer(auto_error=True)

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours instead of 30 minutes

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    query = select(User).where(User.username == username)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user

async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db)
) -> User | None:
    """Return current user if Authorization header is provided and valid; otherwise None.

    This allows endpoints to behave with optional auth.
    """
    if credentials is None:
        return None
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except jwt.PyJWTError:
        return None

    query = select(User).where(User.username == username)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    return user

@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    query = select(User).where((User.username == user_data.username) | (User.email == user_data.email))
    result = await db.execute(query)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        created_at=user.created_at
    )

@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    # Find user
    query = select(User).where(User.username == user_data.username)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            created_at=user.created_at
        )
    )

@router.post("/logout")
async def logout():
    # In a stateless JWT setup, logout is typically handled client-side
    # by removing the token from storage
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        username=current_user.username,
        email=current_user.email,
        created_at=current_user.created_at
    )
