from datetime import datetime, timedelta, timezone
from typing import Optional

from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from backend.app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
        data: dict,
        expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(
        data: dict,
        expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )

    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[
                settings.ALGORITHM])
        return payload
    except JWTError:
        return None


class PasswordEncryption:
    def __init__(self):
        encryption_key = settings.ENCRYPTION_KEY
        if not encryption_key:
            encryption_key = Fernet.generate_key().decode()
            print(
                "WARNING: Using generated encryption key. "
                "Set ENCRYPTION_KEY in .env for production!"
            )
            print(
                f"Generated key: "
                f"{encryption_key}"
            )

        if isinstance(encryption_key, str):
            encryption_key = encryption_key.encode()

        self.cipher = Fernet(encryption_key)

    def encrypt(self, plain_password: str) -> str:
        if not plain_password:
            return ""

        encrypted_bytes = self.cipher.encrypt(plain_password.encode())
        return encrypted_bytes.decode()

    def decrypt(self, encrypted_password: str) -> str:
        if not encrypted_password:
            return ""

        try:
            decrypted_bytes = self.cipher.decrypt(encrypted_password.encode())
            return decrypted_bytes.decode()
        except Exception as e:
            raise ValueError(f"Failed to decrypt password: {str(e)}")


_password_encryption = None


def get_password_encryption() -> PasswordEncryption:
    global _password_encryption
    if _password_encryption is None:
        _password_encryption = PasswordEncryption()
    return _password_encryption


def encrypt_password(plain_password: str) -> str:
    return get_password_encryption().encrypt(plain_password)


def decrypt_password(encrypted_password: str) -> str:
    return get_password_encryption().decrypt(encrypted_password)
