"""
Security utilities for password hashing and encryption
"""
from passlib.context import CryptContext
from cryptography.fernet import Fernet
from backend.app.core.config import settings
import base64
import os

# Password hashing context for user authentication
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password for storing"""
    return pwd_context.hash(password)


# Encryption for database connection passwords
class PasswordEncryption:
    """
    Handles encryption/decryption of database connection passwords
    Uses Fernet (symmetric encryption) from cryptography library
    """
    
    def __init__(self):
        # Get encryption key from environment or generate one
        # In production, this should be stored securely (e.g., AWS Secrets Manager)
        encryption_key = os.getenv("ENCRYPTION_KEY")
        if not encryption_key:
            # Generate a key for development (WARNING: not for production!)
            encryption_key = Fernet.generate_key().decode()
            print(f"WARNING: Using generated encryption key. Set ENCRYPTION_KEY in .env for production!")
            print(f"Generated key: {encryption_key}")
        
        # Ensure key is bytes
        if isinstance(encryption_key, str):
            encryption_key = encryption_key.encode()
        
        self.cipher = Fernet(encryption_key)
    
    def encrypt(self, plain_password: str) -> str:
        """
        Encrypt a plain text password
        Returns base64 encoded encrypted string
        """
        if not plain_password:
            return ""
        
        encrypted_bytes = self.cipher.encrypt(plain_password.encode())
        return encrypted_bytes.decode()
    
    def decrypt(self, encrypted_password: str) -> str:
        """
        Decrypt an encrypted password
        Returns plain text password
        """
        if not encrypted_password:
            return ""
        
        try:
            decrypted_bytes = self.cipher.decrypt(encrypted_password.encode())
            return decrypted_bytes.decode()
        except Exception as e:
            raise ValueError(f"Failed to decrypt password: {str(e)}")


# Singleton instance
_password_encryption = None


def get_password_encryption() -> PasswordEncryption:
    """Get the password encryption singleton instance"""
    global _password_encryption
    if _password_encryption is None:
        _password_encryption = PasswordEncryption()
    return _password_encryption


# Convenience functions
def encrypt_password(plain_password: str) -> str:
    """Encrypt a database connection password"""
    return get_password_encryption().encrypt(plain_password)


def decrypt_password(encrypted_password: str) -> str:
    """Decrypt a database connection password"""
    return get_password_encryption().decrypt(encrypted_password)

