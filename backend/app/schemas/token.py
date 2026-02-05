from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str
    name: Optional[str] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    user: UserResponse


class RefreshResponse(BaseModel):
    message: str = "Token refreshed successfully"


class LogoutResponse(BaseModel):
    message: str = "Logged out successfully"


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[UUID] = None
