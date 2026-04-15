import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


def _validate_bcrypt_password_length(v: str) -> str:
    # bcrypt processes only the first 72 bytes of UTF-8 encoded passwords.
    if len(v.encode("utf-8")) > 72:
        raise ValueError("must be at most 72 bytes")
    return v


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("is required")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("must be at least 8 characters")
        return _validate_bcrypt_password_length(v)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    @field_validator("password")
    @classmethod
    def password_max_length_for_bcrypt(cls, v: str) -> str:
        return _validate_bcrypt_password_length(v)


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    email: str
    created_at: datetime


class TokenResponse(BaseModel):
    token: str
    user: UserOut
