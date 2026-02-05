from datetime import datetime, timedelta, timezone

from fastapi import (APIRouter, Depends, HTTPException, Request, Response,
                     status)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.security import (create_access_token,
                                       create_refresh_token,
                                       decode_access_token, verify_password)
from backend.app.db.session import get_db
from backend.app.models.models import User, UserSession
from backend.app.schemas.token import (LoginRequest, LoginResponse,
                                       LogoutResponse, RefreshResponse,
                                       UserResponse)

router = APIRouter()


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Read token from cookie instead of Authorization header
    token = request.cookies.get(settings.COOKIE_ACCESS_TOKEN_NAME)
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    # Verify token type
    token_type = payload.get("type")
    if token_type != "access":
        raise credentials_exception

    email: str = payload.get("sub")
    user_id: str = payload.get("user_id")

    if email is None or user_id is None:
        raise credentials_exception

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    return user


@router.post("/login", response_model=LoginResponse)
async def login(
    response: Response,
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    # Authenticate user
    result = await db.execute(select(User).where(
        User.email == login_data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    # Create tokens
    access_token_expires = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": str(user.id)},
        expires_delta=access_token_expires
    )

    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = create_refresh_token(
        data={"sub": user.email, "user_id": str(user.id)},
        expires_delta=refresh_token_expires
    )

    # Get user agent and IP address
    user_agent = request.headers.get("user-agent", "")
    ip_address = request.client.host if request.client else None

    # Create UserSession in database
    session_db = UserSession(
        user_id=user.id,
        refresh_token=refresh_token,
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=datetime.now(timezone.utc) + refresh_token_expires,
        is_revoked=False
    )
    db.add(session_db)
    await db.commit()

    # Set HttpOnly cookies
    response.set_cookie(
        key=settings.COOKIE_ACCESS_TOKEN_NAME,
        value=access_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path=settings.COOKIE_PATH
    )

    response.set_cookie(
        key=settings.COOKIE_REFRESH_TOKEN_NAME,
        value=refresh_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=settings.COOKIE_PATH
    )

    user_response = UserResponse(
        id=user.id,
        email=user.email,
        role=user.role.value,
        name=user.email.split('@')[0].title()
    )

    return LoginResponse(user=user_response)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Get refresh token from cookie
    refresh_token = request.cookies.get(settings.COOKIE_REFRESH_TOKEN_NAME)
    if not refresh_token:
        raise credentials_exception

    # Validate token
    payload = decode_access_token(refresh_token)
    if payload is None:
        # Delete cookies if token is invalid
        response.delete_cookie(
            key=settings.COOKIE_ACCESS_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        response.delete_cookie(
            key=settings.COOKIE_REFRESH_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        raise credentials_exception

    # Verify token type
    token_type = payload.get("type")
    if token_type != "refresh":
        response.delete_cookie(
            key=settings.COOKIE_ACCESS_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        response.delete_cookie(
            key=settings.COOKIE_REFRESH_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        raise credentials_exception

    # Check if session exists in database and is valid
    result = await db.execute(
        select(UserSession).where(
            UserSession.refresh_token == refresh_token
        )
    )
    old_session = result.scalar_one_or_none()

    if not old_session:
        response.delete_cookie(
            key=settings.COOKIE_ACCESS_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        response.delete_cookie(
            key=settings.COOKIE_REFRESH_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session not found"
        )

    # Check if session is revoked
    if old_session.is_revoked:
        response.delete_cookie(
            key=settings.COOKIE_ACCESS_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        response.delete_cookie(
            key=settings.COOKIE_REFRESH_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked"
        )

    # Check if session is expired
    if old_session.expires_at < datetime.now(timezone.utc):
        response.delete_cookie(
            key=settings.COOKIE_ACCESS_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        response.delete_cookie(
            key=settings.COOKIE_REFRESH_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired"
        )

    # Get user from session
    result = await db.execute(select(User).where(
        User.id == old_session.user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        response.delete_cookie(
            key=settings.COOKIE_ACCESS_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        response.delete_cookie(
            key=settings.COOKIE_REFRESH_TOKEN_NAME,
            path=settings.COOKIE_PATH
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # Revoke old session
    old_session.is_revoked = True

    # Create new tokens
    access_token_expires = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": str(user.id)},
        expires_delta=access_token_expires
    )

    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    new_refresh_token = create_refresh_token(
        data={"sub": user.email, "user_id": str(user.id)},
        expires_delta=refresh_token_expires
    )

    # Get user agent and IP address
    user_agent = request.headers.get("user-agent", "")
    ip_address = request.client.host if request.client else None

    # Create new UserSession in database
    new_session = UserSession(
        user_id=user.id,
        refresh_token=new_refresh_token,
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=datetime.now(timezone.utc) + refresh_token_expires,
        is_revoked=False
    )
    db.add(new_session)
    await db.commit()

    # Set new cookies
    response.set_cookie(
        key=settings.COOKIE_ACCESS_TOKEN_NAME,
        value=access_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path=settings.COOKIE_PATH
    )

    response.set_cookie(
        key=settings.COOKIE_REFRESH_TOKEN_NAME,
        value=new_refresh_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=settings.COOKIE_PATH
    )

    return RefreshResponse()


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Get refresh token from cookie
    refresh_token = request.cookies.get(
        settings.COOKIE_REFRESH_TOKEN_NAME
    )

    if refresh_token:
        # Mark session as revoked in database
        result = await db.execute(
            select(UserSession).where(
                UserSession.refresh_token == refresh_token
            )
        )
        session = result.scalar_one_or_none()

        if session:
            session.is_revoked = True
            await db.commit()

    # Delete both cookies
    response.delete_cookie(
        key=settings.COOKIE_ACCESS_TOKEN_NAME,
        path=settings.COOKIE_PATH
    )
    response.delete_cookie(
        key=settings.COOKIE_REFRESH_TOKEN_NAME,
        path=settings.COOKIE_PATH
    )

    return LogoutResponse()


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role.value,
        name=current_user.email.split('@')[0].title()
    )
