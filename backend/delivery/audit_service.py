from .models import AuditLog


class AuditService:
    """
    Centralized audit logging service.

    Application code should use this service instead of creating
    AuditLog objects directly. This keeps audit behavior
    consistent across authentication, repository, delivery and
    user-management workflows.

    IMPORTANT:
    Never pass passwords, JWTs, repository access tokens,
    encrypted secrets, SMTP credentials, Django SECRET_KEY,
    or other credentials in metadata.
    """

    # ==========================================================
    # SAFE METADATA
    # ==========================================================

    SENSITIVE_KEYS = {
        "password",
        "password_confirm",

        "access_token",
        "refresh",
        "refresh_token",
        "token",

        "secret",
        "secret_key",

        "encrypted_token",

        "smtp_password",
        "smtp_username",

        "api_key",

        "authorization",
        "cookie",
        "session",

        # ------------------------------------------------------
        # REPOSITORY CREDENTIALS
        # ------------------------------------------------------

        "credential",
        "credentials",

        "pat",
        "personal_access_token",

        "private_key",
        "ssh_key",

        # ------------------------------------------------------
        # APPLICATION SECRETS
        # ------------------------------------------------------

        "django_secret_key",
        "repository_credential_key",
    }

    @classmethod
    def sanitize_metadata(
        cls,
        metadata,
    ):
        """
        Return metadata safe for audit storage.

        Dictionaries are recursively sanitized.
        Lists and tuples are recursively sanitized.
        Primitive values are preserved.

        Sensitive keys are replaced with a fixed marker.
        """

        if metadata is None:
            return {}

        # ------------------------------------------------------
        # DICTIONARY
        # ------------------------------------------------------

        if isinstance(
            metadata,
            dict,
        ):

            cleaned = {}

            for key, value in metadata.items():

                key_string = str(
                    key
                )

                if (
                    key_string.lower()
                    in cls.SENSITIVE_KEYS
                ):

                    cleaned[key_string] = (
                        "[REDACTED]"
                    )

                    continue

                cleaned[key_string] = (
                    cls.sanitize_metadata(
                        value
                    )
                )

            return cleaned

        # ------------------------------------------------------
        # LIST / TUPLE
        # ------------------------------------------------------

        if isinstance(
            metadata,
            (list, tuple),
        ):

            return [
                cls.sanitize_metadata(
                    item
                )
                for item in metadata
            ]

        # ------------------------------------------------------
        # PRIMITIVE
        # ------------------------------------------------------

        return metadata

    # ==========================================================
    # CLIENT IP
    # ==========================================================

    @staticmethod
    def get_client_ip(
        request,
    ):
        """
        Extract the originating client IP.

        If the application is behind a trusted proxy, the first
        X-Forwarded-For value may represent the original client.

        The request META value is used as the fallback.
        """

        if request is None:
            return None

        forwarded_for = request.META.get(
            "HTTP_X_FORWARDED_FOR"
        )

        if forwarded_for:

            return (
                forwarded_for
                .split(",")[0]
                .strip()
            )

        return request.META.get(
            "REMOTE_ADDR"
        )

    # ==========================================================
    # LOG ACTION
    # ==========================================================

    @classmethod
    def log(
        cls,
        *,
        request=None,
        user=None,
        action,
        resource,
        resource_id="",
        metadata=None,
    ):
        """
        Create an audit record.

        Parameters:

            request:
                Optional DRF/Django request. Used to derive
                authenticated user and client IP.

            user:
                Optional explicit user. If omitted, the
                authenticated request user is used.

            action:
                Stable action identifier such as
                USER_LOGIN or REPOSITORY_UPDATED.

            resource:
                Resource category such as
                authentication, user, repository or delivery_job.

            resource_id:
                Identifier of the affected resource.

            metadata:
                Safe contextual information. Sensitive values
                are recursively redacted.
        """

        # ------------------------------------------------------
        # RESOLVE USER FROM REQUEST
        # ------------------------------------------------------

        if (
            user is None
            and request is not None
        ):

            request_user = getattr(
                request,
                "user",
                None,
            )

            if (
                request_user
                and getattr(
                    request_user,
                    "is_authenticated",
                    False,
                )
            ):

                user = request_user

        # ------------------------------------------------------
        # DO NOT RETAIN UNSAVED USER OBJECTS
        # ------------------------------------------------------

        if (
            user is not None
            and getattr(
                user,
                "pk",
                None,
            )
            is None
        ):

            user = None

        # ------------------------------------------------------
        # SANITIZE METADATA
        # ------------------------------------------------------

        safe_metadata = (
            cls.sanitize_metadata(
                metadata
            )
        )

        # ------------------------------------------------------
        # CLIENT IP
        # ------------------------------------------------------

        ip_address = (
            cls.get_client_ip(
                request
            )
            if request is not None
            else None
        )

        # ------------------------------------------------------
        # CREATE AUDIT RECORD
        # ------------------------------------------------------

        return AuditLog.objects.create(
            user=user,

            action=str(
                action
            )[:100],

            resource=str(
                resource
            )[:100],

            resource_id=(
                str(resource_id)
                if resource_id is not None
                else ""
            )[:100],

            ip_address=ip_address,

            metadata=safe_metadata,
        )

    # ==========================================================
    # SAFE FAILURE
    # ==========================================================

    @classmethod
    def try_log(
        cls,
        **kwargs,
    ):
        """
        Best-effort audit logging.

        Business operations should not fail solely because an
        audit record could not be written.

        The exception is deliberately swallowed here; the
        application can add centralized error reporting later.
        """

        try:

            return cls.log(
                **kwargs
            )

        except Exception:

            return None