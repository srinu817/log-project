from pathlib import Path
import os
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken


class SecurityViolation(Exception):
    """Raised when a file or credential fails security validation."""
    pass


class SecurityService:
    """
    Security utilities used by the delivery system.

    Responsibilities:
    1. Validate files before archive creation.
    2. Block sensitive files.
    3. Enforce file-size limits.
    4. Validate readable files.
    5. Normalize extensions.
    6. Prevent unsafe archive names.
    7. Encrypt/decrypt repository credentials.
    """

    # ==========================================================
    # FILE SECURITY
    # ==========================================================

    SENSITIVE_NAMES = {
        ".env",
        ".env.local",
        ".env.production",
        ".env.development",
        "id_rsa",
        "id_ed25519",
        "private.key",
        "server.key",
        "database.sql",
        "dump.sql",
        "credentials.json",
        "secrets.json",
    }

    SENSITIVE_EXTENSIONS = {
        ".pem",
        ".p12",
        ".pfx",
        ".key",
        ".bak",
        ".secret",
    }

    MAX_FILE_SIZE = 50 * 1024 * 1024

    # ==========================================================
    # CREDENTIAL ENCRYPTION
    # ==========================================================

    @classmethod
    def _get_fernet(cls):
        """
        Create the Fernet encryption service.

        REPOSITORY_CREDENTIAL_KEY should be stored
        in the backend .env file.
        """

        key = os.getenv(
            "REPOSITORY_CREDENTIAL_KEY",
            "",
        ).strip()

        if not key:
            raise SecurityViolation(
                "REPOSITORY_CREDENTIAL_KEY is not configured."
            )

        try:
            return Fernet(
                key.encode("utf-8")
            )

        except Exception as exc:
            raise SecurityViolation(
                "Invalid REPOSITORY_CREDENTIAL_KEY."
            ) from exc

    @classmethod
    def encrypt_secret(cls, value):
        """
        Encrypt a sensitive value before storing it
        in the database.
        """

        if value is None:
            return ""

        value = str(value)

        if not value:
            return ""

        try:
            fernet = cls._get_fernet()

            encrypted = fernet.encrypt(
                value.encode("utf-8")
            )

            return encrypted.decode("utf-8")

        except SecurityViolation:
            raise

        except Exception as exc:
            raise SecurityViolation(
                "Unable to encrypt credential."
            ) from exc

    @classmethod
    def decrypt_secret(cls, encrypted_value):
        """
        Decrypt a credential when it is required
        for repository authentication.
        """

        if not encrypted_value:
            return ""

        try:
            fernet = cls._get_fernet()

            decrypted = fernet.decrypt(
                encrypted_value.encode("utf-8")
            )

            return decrypted.decode("utf-8")

        except InvalidToken as exc:
            raise SecurityViolation(
                "Stored credential could not be decrypted."
            ) from exc

        except SecurityViolation:
            raise

        except Exception as exc:
            raise SecurityViolation(
                "Unable to decrypt credential."
            ) from exc

    # ==========================================================
    # FILE SAFETY
    # ==========================================================

    @classmethod
    def is_sensitive(
        cls,
        path,
    ):
        """
        Return True when a file should never
        be included in the delivery archive.
        """

        path = Path(path)

        file_name = path.name.lower()
        extension = path.suffix.lower()

        if file_name in cls.SENSITIVE_NAMES:
            return True

        if extension in cls.SENSITIVE_EXTENSIONS:
            return True

        return False

    # ==========================================================
    # SIZE CHECK
    # ==========================================================

    @classmethod
    def is_within_size_limit(
        cls,
        path,
    ):
        """
        Check maximum individual file size.
        """

        path = Path(path)

        try:
            return (
                path.stat().st_size
                <= cls.MAX_FILE_SIZE
            )

        except OSError:
            return False

    # ==========================================================
    # READABILITY
    # ==========================================================

    @staticmethod
    def is_readable(path):
        """
        Check whether a file can be opened.
        """

        path = Path(path)

        try:
            with path.open("rb"):
                return True

        except (
            OSError,
            PermissionError,
        ):
            return False

    # ==========================================================
    # VALIDATE FILE
    # ==========================================================

    @classmethod
    def validate_file(
        cls,
        path,
    ):
        """
        Perform all security checks on one file.
        """

        path = Path(path)

        if not path.exists():
            raise SecurityViolation(
                f"File does not exist: {path}"
            )

        if not path.is_file():
            raise SecurityViolation(
                f"Path is not a file: {path}"
            )

        if cls.is_sensitive(path):
            raise SecurityViolation(
                f"Sensitive file blocked: {path.name}"
            )

        if not cls.is_within_size_limit(path):
            raise SecurityViolation(
                f"File exceeds the maximum size limit: "
                f"{path.name}"
            )

        if not cls.is_readable(path):
            raise SecurityViolation(
                f"File is not readable: {path.name}"
            )

        return True

    # ==========================================================
    # FILTER FILES
    # ==========================================================

    @classmethod
    def filter_files(
        cls,
        files,
    ):
        """
        Filter a collection of files.

        Returns:

        {
            "allowed": [...],
            "blocked": [...]
        }
        """

        allowed = []
        blocked = []

        for file_path in files:

            path = Path(file_path)

            try:
                cls.validate_file(path)

                allowed.append(path)

            except SecurityViolation as exc:

                blocked.append(
                    {
                        "file": str(path),
                        "reason": str(exc),
                    }
                )

        return {
            "allowed": allowed,
            "blocked": blocked,
        }

    # ==========================================================
    # EXTENSION CHECK
    # ==========================================================

    @staticmethod
    def normalize_extensions(
        extensions,
    ):
        """
        Normalize configured extensions.

        Example:

        ["log", ".txt"]

        becomes:

        [".log", ".txt"]
        """

        normalized = set()

        for extension in extensions or []:

            extension = str(
                extension
            ).strip().lower()

            if not extension:
                continue

            if not extension.startswith("."):
                extension = "." + extension

            normalized.add(extension)

        return normalized

    # ==========================================================
    # ARCHIVE PATH SAFETY
    # ==========================================================

    @staticmethod
    def safe_archive_name(
        filename,
    ):
        """
        Prevent path traversal in archive names.
        """

        filename = Path(
            filename
        ).name

        if not filename:
            raise SecurityViolation(
                "Invalid archive filename."
            )

        return filename