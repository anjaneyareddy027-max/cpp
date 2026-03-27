"""
Authentication module for StudyHub.

Provides password hashing, JWT-like token generation/verification,
and password strength validation using only Python standard library.
"""

import hashlib
import hmac
import base64
import json
import os
import time
import secrets


class AuthManager:
    """Handles authentication operations: hashing, tokens, and password policy."""

    # PBKDF2 iteration count — high enough for security, reasonable for speed
    PBKDF2_ITERATIONS = 100_000

    # ------------------------------------------------------------------ #
    #  Password hashing
    # ------------------------------------------------------------------ #

    @staticmethod
    def hash_password(password: str, salt: bytes = None) -> tuple:
        """
        Hash a password with PBKDF2-HMAC-SHA256.

        Args:
            password: The plaintext password to hash.
            salt: Optional salt bytes. A random 32-byte salt is generated
                  if none is provided.

        Returns:
            Tuple of (hashed_hex, salt_hex).
        """
        if salt is None:
            salt = os.urandom(32)
        elif isinstance(salt, str):
            salt = bytes.fromhex(salt)

        hashed = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            AuthManager.PBKDF2_ITERATIONS,
        )
        return hashed.hex(), salt.hex()

    @staticmethod
    def verify_password(password: str, stored_hash: str, salt: str) -> bool:
        """
        Verify a plaintext password against a stored hash and salt.

        Args:
            password: The plaintext password to check.
            stored_hash: The hex-encoded hash to compare against.
            salt: The hex-encoded salt used during hashing.

        Returns:
            True if the password matches, False otherwise.
        """
        hashed, _ = AuthManager.hash_password(password, bytes.fromhex(salt))
        return hmac.compare_digest(hashed, stored_hash)

    # ------------------------------------------------------------------ #
    #  Token management
    # ------------------------------------------------------------------ #

    @staticmethod
    def _b64_encode(data: bytes) -> str:
        """URL-safe base64 encode, stripping padding."""
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")

    @staticmethod
    def _b64_decode(text: str) -> bytes:
        """URL-safe base64 decode, restoring padding."""
        padding = 4 - len(text) % 4
        if padding != 4:
            text += "=" * padding
        return base64.urlsafe_b64decode(text)

    @staticmethod
    def generate_token(
        user_id: str,
        username: str,
        secret_key: str,
        expires_hours: int = 24,
    ) -> str:
        """
        Generate a JWT-like token: header.payload.signature

        Args:
            user_id: Unique identifier for the user.
            username: Display name / login name.
            secret_key: Secret used to sign the token.
            expires_hours: Hours until the token expires (default 24).

        Returns:
            A dot-separated token string.
        """
        header = {"alg": "HS256", "typ": "JWT"}
        now = time.time()
        payload = {
            "userId": user_id,
            "username": username,
            "iat": now,
            "exp": now + expires_hours * 3600,
        }

        header_b64 = AuthManager._b64_encode(json.dumps(header).encode("utf-8"))
        payload_b64 = AuthManager._b64_encode(json.dumps(payload).encode("utf-8"))

        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        signature = hmac.new(
            secret_key.encode("utf-8"), signing_input, hashlib.sha256
        ).digest()
        signature_b64 = AuthManager._b64_encode(signature)

        return f"{header_b64}.{payload_b64}.{signature_b64}"

    @staticmethod
    def decode_token(token: str, secret_key: str) -> dict:
        """
        Decode and verify a JWT-like token.

        Args:
            token: The token string to decode.
            secret_key: The secret key used to verify the signature.

        Returns:
            The payload dictionary.

        Raises:
            ValueError: If the token is malformed, the signature is invalid,
                        or the token has expired.
        """
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid token format")

        header_b64, payload_b64, signature_b64 = parts

        # Verify signature
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(
            secret_key.encode("utf-8"), signing_input, hashlib.sha256
        ).digest()
        actual_sig = AuthManager._b64_decode(signature_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Invalid token signature")

        # Decode payload
        payload = json.loads(AuthManager._b64_decode(payload_b64))

        # Check expiry
        if payload.get("exp", 0) < time.time():
            raise ValueError("Token has expired")

        return payload

    # ------------------------------------------------------------------ #
    #  Password strength
    # ------------------------------------------------------------------ #

    @staticmethod
    def validate_password_strength(password: str) -> tuple:
        """
        Check whether a password meets minimum strength requirements.

        Rules:
            - At least 8 characters long
            - Contains at least one uppercase letter
            - Contains at least one digit

        Args:
            password: The password string to evaluate.

        Returns:
            Tuple of (is_valid: bool, errors: list[str]).
        """
        errors = []

        if len(password) < 8:
            errors.append("Password must be at least 8 characters long")
        if not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit")

        return (len(errors) == 0, errors)
