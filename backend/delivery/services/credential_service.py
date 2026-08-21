from django.db import transaction

from ..models import (
    RepositoryConfig,
    RepositoryCredential,
)

from .security_service import (
    SecurityService,
    SecurityViolation,
)


# ============================================================
# CREDENTIAL SERVICE
# ============================================================

class CredentialServiceError(Exception):
    """
    Raised when repository credential operations fail.
    """
    pass


class CredentialService:
    """
    Central service for repository credentials.

    Responsibilities:

        - Create credentials
        - Update credentials
        - Retrieve credentials
        - Encrypt PAT before database storage
        - Decrypt PAT only when required
        - Never expose raw PAT through serializers
    """

    # ========================================================
    # CREATE / SAVE CREDENTIAL
    # ========================================================

    @staticmethod
    @transaction.atomic
    def save_credential(
        repository,
        auth_type=RepositoryCredential.AuthType.NONE,
        username="",
        access_token="",
    ):
        """
        Create or update the credential for a repository.

        For NONE:
            No token is stored.

        For PAT:
            access_token is encrypted before storage.

        For SSH:
            Reserved for future SSH implementation.
        """

        if not repository:

            raise CredentialServiceError(
                "Repository is required."
            )

        username = (
            username or ""
        ).strip()

        access_token = (
            access_token or ""
        )

        # ----------------------------------------------------
        # GET OR CREATE
        # ----------------------------------------------------

        credential, created = (
            RepositoryCredential.objects
            .get_or_create(
                repository=repository,
                defaults={
                    "auth_type": auth_type,
                    "username": username,
                    "encrypted_token": "",
                },
            )
        )

        # ----------------------------------------------------
        # AUTH TYPE
        # ----------------------------------------------------

        credential.auth_type = (
            auth_type
        )

        # ----------------------------------------------------
        # NONE
        # ----------------------------------------------------

        if (
            auth_type
            == RepositoryCredential.AuthType.NONE
        ):

            credential.username = ""

            credential.encrypted_token = ""

            credential.save()

            return credential

        # ----------------------------------------------------
        # PAT
        # ----------------------------------------------------

        if (
            auth_type
            == RepositoryCredential.AuthType.PAT
        ):

            if not access_token:

                # If updating and no new token was supplied,
                # keep the existing token.

                if not credential.encrypted_token:

                    raise CredentialServiceError(
                        "Repository authentication is "
                        "configured as PAT but no "
                        "credential was supplied."
                    )

            else:

                try:

                    credential.encrypted_token = (
                        SecurityService.encrypt_secret(
                            access_token
                        )
                    )

                except SecurityViolation as exc:

                    raise CredentialServiceError(
                        "Unable to securely store "
                        "repository credential."
                    ) from exc

            credential.username = (
                username
            )

            credential.save()

            return credential

        # ----------------------------------------------------
        # SSH
        # ----------------------------------------------------

        if (
            auth_type
            == RepositoryCredential.AuthType.SSH
        ):

            credential.username = (
                username
            )

            # SSH support can be implemented later.
            #
            # Do not accidentally treat an SSH credential
            # as a PAT.

            if access_token:

                try:

                    credential.encrypted_token = (
                        SecurityService.encrypt_secret(
                            access_token
                        )
                    )

                except SecurityViolation as exc:

                    raise CredentialServiceError(
                        "Unable to securely store "
                        "SSH credential."
                    ) from exc

            credential.save()

            return credential

        raise CredentialServiceError(
            f"Unsupported authentication type: "
            f"{auth_type}"
        )

    # ========================================================
    # GET CREDENTIAL
    # ========================================================

    @staticmethod
    def get_credential(
        repository,
    ):
        """
        Return the RepositoryCredential object.

        Returns None when no credential exists.
        """

        if not repository:

            return None

        return (
            RepositoryCredential.objects
            .filter(
                repository=repository
            )
            .first()
        )

    # ========================================================
    # GET AUTH TYPE
    # ========================================================

    @staticmethod
    def get_auth_type(
        repository,
    ):
        """
        Return configured authentication type.

        If no credential exists, return NONE.
        """

        credential = (
            CredentialService.get_credential(
                repository
            )
        )

        if not credential:

            return (
                RepositoryCredential.AuthType.NONE
            )

        return credential.auth_type

    # ========================================================
    # GET USERNAME
    # ========================================================

    @staticmethod
    def get_username(
        repository,
    ):
        """
        Return safe username information.
        """

        credential = (
            CredentialService.get_credential(
                repository
            )
        )

        if not credential:

            return ""

        return (
            credential.username
            or ""
        )

    # ========================================================
    # GET DECRYPTED TOKEN
    # ========================================================

    @staticmethod
    def get_access_token(
        repository,
    ):
        """
        Decrypt and return the repository PAT.

        IMPORTANT:

        This method should only be called internally by
        repository services when authentication is actually
        required.

        Never expose this value through an API response.
        """

        credential = (
            CredentialService.get_credential(
                repository
            )
        )

        if not credential:

            raise CredentialServiceError(
                "Repository authentication is configured "
                "but no credential record exists."
            )

        if (
            credential.auth_type
            == RepositoryCredential.AuthType.NONE
        ):

            return ""

        if not credential.encrypted_token:

            raise CredentialServiceError(
                "Repository authentication is configured "
                "but no credential is stored."
            )

        try:

            return (
                SecurityService.decrypt_secret(
                    credential.encrypted_token
                )
            )

        except SecurityViolation as exc:

            raise CredentialServiceError(
                "Unable to decrypt repository credential."
            ) from exc

    # ========================================================
    # GET AUTHENTICATION DATA
    # ========================================================

    @staticmethod
    def get_authentication_data(
        repository,
    ):
        """
        Return authentication information required by
        repository_service.

        Returns:

            {
                "auth_type": "PAT",
                "username": "...",
                "access_token": "..."
            }

        The access_token is only available internally.
        """

        credential = (
            CredentialService.get_credential(
                repository
            )
        )

        if not credential:

            return {
                "auth_type": (
                    RepositoryCredential.AuthType.NONE
                ),

                "username": "",

                "access_token": "",
            }

        auth_type = (
            credential.auth_type
        )

        username = (
            credential.username
            or ""
        )

        access_token = ""

        if (
            auth_type
            != RepositoryCredential.AuthType.NONE
        ):

            access_token = (
                CredentialService.get_access_token(
                    repository
                )
            )

        return {
            "auth_type": auth_type,

            "username": username,

            "access_token": access_token,
        }

    # ========================================================
    # HAS VALID CREDENTIAL
    # ========================================================

    @staticmethod
    def has_valid_credential(
        repository,
    ):
        """
        Check whether the repository has the credential
        required by its authentication configuration.
        """

        credential = (
            CredentialService.get_credential(
                repository
            )
        )

        if not credential:

            return False

        if (
            credential.auth_type
            == RepositoryCredential.AuthType.NONE
        ):

            return True

        return bool(
            credential.encrypted_token
        )

    # ========================================================
    # DELETE CREDENTIAL
    # ========================================================

    @staticmethod
    @transaction.atomic
    def delete_credential(
        repository,
    ):
        """
        Remove repository authentication credentials.
        """

        if not repository:

            return

        RepositoryCredential.objects.filter(
            repository=repository
        ).delete()