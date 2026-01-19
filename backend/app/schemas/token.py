"""
Token and authentication schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID


class LoginRequest(BaseModel):
    """Request schema for login endpoint"""
    email: EmailStr
    password: str


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """User data in login response"""
    id: UUID
    email: str
    role: str
    name: Optional[str] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """Complete login response with token and user data"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    """Data stored in JWT token"""
    email: Optional[str] = None
    user_id: Optional[UUID] = None
