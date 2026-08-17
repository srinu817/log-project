from rest_framework import serializers

from .models import (
    RepositoryConfig,
    RepositoryCredential,
    DeliveryJob,
)

from .services.security_service import (
    SecurityService,
)


class RepositorySerializer(
    serializers.ModelSerializer
):
    """
    Serializer for repository configuration.

    Handles:

        - Repository configuration
        - Multiple targets
        - Legacy target configuration
        - PAT authentication
        - Encrypted credential storage

    IMPORTANT:

        access_token is write-only.

        It can be submitted by the frontend,
        but it is NEVER returned in API responses.
    """

    # ==========================================================
    # AUTHENTICATION FIELDS
    # ==========================================================

    auth_type = serializers.ChoiceField(
        choices=RepositoryCredential.AuthType.choices,
        write_only=True,
        required=False,
        default=RepositoryCredential.AuthType.NONE,
    )

    username = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    access_token = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )

    # Safe information returned to frontend.
    authentication_configured = (
        serializers.SerializerMethodField()
    )

    # ==========================================================
    # MULTIPLE TARGET VALIDATION
    # ==========================================================

    def validate_targets(
        self,
        value,
    ):
        """
        Validate multiple repository targets.

        Expected format:

        [
            {
                "path": "backend/requirements.txt",
                "extensions": [".txt"]
            },
            {
                "path": "backend/build.sh",
                "extensions": [".sh"]
            },
            {
                "path": "frontend/package.json",
                "extensions": []
            }
        ]

        Rules:

            - targets must be a list
            - every target must be an object
            - path is required
            - path cannot be empty
            - path must be relative
            - extensions are optional
            - empty extensions means all extensions
        """

        if value is None:
            return []

        if not isinstance(
            value,
            list,
        ):
            raise serializers.ValidationError(
                "Targets must be provided as a list."
            )

        cleaned_targets = []

        seen_paths = set()

        for index, target in enumerate(value):

            # ==================================================
            # TARGET OBJECT
            # ==================================================

            if not isinstance(
                target,
                dict,
            ):
                raise serializers.ValidationError(
                    {
                        "targets": (
                            f"Target #{index + 1} "
                            "must be an object."
                        )
                    }
                )

            # ==================================================
            # PATH
            # ==================================================

            target_path = target.get(
                "path",
                ""
            )

            if target_path is None:
                target_path = ""

            target_path = str(
                target_path
            ).strip()

            if not target_path:

                raise serializers.ValidationError(
                    {
                        "targets": (
                            f"Target #{index + 1} "
                            "path cannot be empty."
                        )
                    }
                )

            # Normalize Windows separators.
            target_path = target_path.replace(
                "\\",
                "/",
            )

            # Remove accidental leading ./.
            while target_path.startswith(
                "./"
            ):
                target_path = target_path[2:]

            # ==================================================
            # SECURITY: RELATIVE PATH ONLY
            # ==================================================

            if (
                target_path.startswith("/")
                or target_path.startswith("\\")
            ):

                raise serializers.ValidationError(
                    {
                        "targets": (
                            f"Target #{index + 1} "
                            "must be a relative path."
                        )
                    }
                )

            path_parts = [
                part
                for part in target_path.split("/")
                if part
            ]

            if ".." in path_parts:

                raise serializers.ValidationError(
                    {
                        "targets": (
                            f"Target #{index + 1} "
                            "cannot contain '..'."
                        )
                    }
                )

            if not target_path:

                raise serializers.ValidationError(
                    {
                        "targets": (
                            f"Target #{index + 1} "
                            "path is invalid."
                        )
                    }
                )

            # ==================================================
            # DUPLICATE TARGET CHECK
            # ==================================================

            normalized_path = (
                target_path.lower()
            )

            if normalized_path in seen_paths:

                raise serializers.ValidationError(
                    {
                        "targets": (
                            f"Duplicate target path: "
                            f"{target_path}"
                        )
                    }
                )

            seen_paths.add(
                normalized_path
            )

            # ==================================================
            # EXTENSIONS
            # ==================================================

            extensions = target.get(
                "extensions",
                [],
            )

            if extensions is None:
                extensions = []

            if not isinstance(
                extensions,
                list,
            ):

                raise serializers.ValidationError(
                    {
                        "targets": (
                            f"Extensions for target "
                            f"'{target_path}' must be "
                            "provided as a list."
                        )
                    }
                )

            cleaned_extensions = []

            for extension in extensions:

                extension = str(
                    extension
                ).strip().lower()

                if not extension:
                    continue

                if not extension.startswith(
                    "."
                ):
                    extension = (
                        "."
                        + extension
                    )

                cleaned_extensions.append(
                    extension
                )

            cleaned_extensions = list(
                dict.fromkeys(
                    cleaned_extensions
                )
            )

            # ==================================================
            # TARGET OBJECT
            # ==================================================

            cleaned_targets.append(
                {
                    "path": target_path,

                    "extensions": (
                        cleaned_extensions
                    ),
                }
            )

        return cleaned_targets

    # ==========================================================
    # META
    # ==========================================================

    class Meta:

        model = RepositoryConfig

        # Explicit allow-list.
        #
        # Do NOT use fields = "__all__" here.
        # RepositoryConfig may gain sensitive fields in the
        # future, and an explicit allow-list prevents a newly
        # added model field from automatically becoming part
        # of the API response.
        fields = [
            "id",
            "name",
            "description",
            "repository_type",
            "repository_url",
            "local_path",
            "branch",
            "target_path",
            "log_directory",
            "extensions",
            "targets",
            "recipients",
            "email_mode",
            "active",
            "connection_status",
            "last_connection_check",
            "created_at",
            "updated_at",

            # Write-only credential inputs.
            "auth_type",
            "username",
            "access_token",

            # Safe credential status.
            "authentication_configured",
        ]

        read_only_fields = [
            "id",
            "connection_status",
            "last_connection_check",
            "created_at",
            "updated_at",
            "authentication_configured",
        ]

    # ==========================================================
    # REPRESENTATION
    # ==========================================================

    def to_representation(
        self,
        instance,
    ):
        """
        Add safe credential information to
        the normal RepositoryConfig response.

        The actual token is NEVER included.
        """

        data = super().to_representation(
            instance
        )

        credential = getattr(
            instance,
            "credential",
            None,
        )

        if credential:

            data["auth_type"] = (
                credential.auth_type
            )

            data["username"] = (
                credential.username
            )

        else:

            data["auth_type"] = (
                RepositoryCredential.AuthType.NONE
            )

            data["username"] = ""

        return data

    # ==========================================================
    # BASIC VALIDATION
    # ==========================================================

    def validate_name(
        self,
        value,
    ):

        value = value.strip()

        if not value:

            raise serializers.ValidationError(
                "Repository name cannot be empty."
            )

        return value

    # ==========================================================
    # BRANCH
    # ==========================================================

    def validate_branch(
        self,
        value,
    ):

        value = value.strip()

        if not value:

            raise serializers.ValidationError(
                "Branch name cannot be empty."
            )

        return value

    # ==========================================================
    # LEGACY TARGET PATH
    # ==========================================================

    def validate_target_path(
        self,
        value,
    ):

        value = value.strip()

        if not value:

            raise serializers.ValidationError(
                "Target path cannot be empty."
            )

        return value

    # ==========================================================
    # LEGACY LOG DIRECTORY
    # ==========================================================

    def validate_log_directory(
        self,
        value,
    ):

        value = value.strip()

        if not value:

            raise serializers.ValidationError(
                "Log directory cannot be empty."
            )

        return value

    # ==========================================================
    # LEGACY EXTENSIONS
    # ==========================================================

    def validate_extensions(
        self,
        value,
    ):
        """
        Validate legacy repository-level extensions.

        This remains for backward compatibility.

        New multi-target configuration uses
        targets[].extensions.
        """

        if not isinstance(
            value,
            list,
        ):

            raise serializers.ValidationError(
                "Extensions must be provided as a list."
            )

        cleaned_extensions = []

        for extension in value:

            extension = str(
                extension
            ).strip().lower()

            if not extension:
                continue

            if not extension.startswith(
                "."
            ):
                extension = (
                    "."
                    + extension
                )

            cleaned_extensions.append(
                extension
            )

        # Keep old behavior for legacy
        # configurations.
        if not cleaned_extensions:

            raise serializers.ValidationError(
                "At least one file extension is required."
            )

        return list(
            dict.fromkeys(
                cleaned_extensions
            )
        )

    # ==========================================================
    # RECIPIENTS
    # ==========================================================

    def validate_recipients(
        self,
        value,
    ):

        if not isinstance(
            value,
            list,
        ):

            raise serializers.ValidationError(
                "Recipients must be provided as a list."
            )

        cleaned_recipients = []

        for recipient in value:

            recipient = str(
                recipient
            ).strip()

            if not recipient:
                continue

            try:

                serializers.EmailField().run_validation(
                    recipient
                )

            except serializers.ValidationError:

                raise serializers.ValidationError(
                    f"Invalid email address: "
                    f"{recipient}"
                )

            cleaned_recipients.append(
                recipient
            )

        return list(
            dict.fromkeys(
                cleaned_recipients
            )
        )

    # ==========================================================
    # REPOSITORY URL
    # ==========================================================

    def validate_repository_url(
        self,
        value,
    ):
        """
        Validate repository URL when supplied.
        """

        if not value:
            return value

        return value.strip()

    # ==========================================================
    # AUTH TYPE
    # ==========================================================

    def validate_auth_type(
        self,
        value,
    ):

        return value

    # ==========================================================
    # OBJECT VALIDATION
    # ==========================================================

    def validate(
        self,
        attrs,
    ):
        """
        Validate repository and authentication configuration.
        """

        repository_type = attrs.get(
            "repository_type",
            getattr(
                self.instance,
                "repository_type",
                RepositoryConfig.RepositoryType.LOCAL,
            ),
        )

        local_path = attrs.get(
            "local_path",
            getattr(
                self.instance,
                "local_path",
                "",
            ),
        )

        repository_url = attrs.get(
            "repository_url",
            getattr(
                self.instance,
                "repository_url",
                "",
            ),
        )

        # ======================================================
        # LOCAL REPOSITORY
        # ======================================================

        if (
            repository_type
            == RepositoryConfig.RepositoryType.LOCAL
        ):

            if not local_path:

                raise serializers.ValidationError(
                    {
                        "local_path": (
                            "Local path is required "
                            "for a local repository."
                        )
                    }
                )

        # ======================================================
        # REMOTE REPOSITORY
        # ======================================================

        else:

            if not repository_url:

                raise serializers.ValidationError(
                    {
                        "repository_url": (
                            "Repository URL is required "
                            "for this repository type."
                        )
                    }
                )

        # ======================================================
        # AUTHENTICATION
        # ======================================================

        auth_type = attrs.get(
            "auth_type",
            RepositoryCredential.AuthType.NONE,
        )

        username = attrs.get(
            "username",
            "",
        )

        access_token = attrs.get(
            "access_token",
            "",
        )

        # ======================================================
        # PAT
        # ======================================================

        if (
            auth_type
            == RepositoryCredential.AuthType.PAT
        ):

            existing_credential = None

            if self.instance:

                existing_credential = getattr(
                    self.instance,
                    "credential",
                    None,
                )

            has_existing_token = bool(
                existing_credential
                and existing_credential.encrypted_token
            )

            # Existing token can be reused.
            if (
                not access_token
                and not has_existing_token
            ):

                raise serializers.ValidationError(
                    {
                        "access_token": (
                            "Access token is required "
                            "for private repository "
                            "authentication."
                        )
                    }
                )

            if not username:

                raise serializers.ValidationError(
                    {
                        "username": (
                            "Username is required "
                            "for PAT authentication."
                        )
                    }
                )

        # ======================================================
        # NONE AUTHENTICATION
        # ======================================================

        elif (
            auth_type
            == RepositoryCredential.AuthType.NONE
        ):

            attrs["username"] = ""

            attrs["access_token"] = ""

        return attrs

    # ==========================================================
    # CREATE
    # ==========================================================

    def create(
        self,
        validated_data,
    ):
        """
        Create RepositoryConfig and
        its credential record.
        """

        auth_type = validated_data.pop(
            "auth_type",
            RepositoryCredential.AuthType.NONE,
        )

        username = validated_data.pop(
            "username",
            "",
        )

        access_token = validated_data.pop(
            "access_token",
            "",
        )

        repository = (
            RepositoryConfig.objects.create(
                **validated_data
            )
        )

        encrypted_token = ""

        if access_token:

            encrypted_token = (
                SecurityService.encrypt_secret(
                    access_token
                )
            )

        RepositoryCredential.objects.create(
            repository=repository,

            auth_type=auth_type,

            username=username,

            encrypted_token=(
                encrypted_token
            ),
        )

        return repository

    # ==========================================================
    # UPDATE
    # ==========================================================

    def update(
        self,
        instance,
        validated_data,
    ):
        """
        Update repository configuration
        and credentials.

        If access_token is omitted,
        the existing token remains unchanged.
        """

        auth_type = validated_data.pop(
            "auth_type",
            None,
        )

        username = validated_data.pop(
            "username",
            None,
        )

        access_token = validated_data.pop(
            "access_token",
            None,
        )

        # ======================================================
        # UPDATE REPOSITORY FIELDS
        # ======================================================

        for attr, value in (
            validated_data.items()
        ):

            setattr(
                instance,
                attr,
                value,
            )

        instance.save()

        # ======================================================
        # CREDENTIAL RECORD
        # ======================================================

        credential, created = (
            RepositoryCredential.objects
            .get_or_create(
                repository=instance,

                defaults={
                    "auth_type": (
                        auth_type
                        or RepositoryCredential.AuthType.NONE
                    ),

                    "username": (
                        username or ""
                    ),
                },
            )
        )

        if auth_type is not None:

            credential.auth_type = (
                auth_type
            )

        if username is not None:

            credential.username = (
                username
            )

        # ======================================================
        # NEW TOKEN
        # ======================================================

        if access_token:

            credential.encrypted_token = (
                SecurityService.encrypt_secret(
                    access_token
                )
            )

        # ======================================================
        # PUBLIC REPOSITORY
        # ======================================================

        if (
            credential.auth_type
            == RepositoryCredential.AuthType.NONE
        ):

            credential.username = ""

            credential.encrypted_token = ""

        credential.save()

        return instance

    # ==========================================================
    # SAFE AUTH STATUS
    # ==========================================================

    def get_authentication_configured(
        self,
        obj,
    ):
        """
        Return only whether authentication exists.

        Never expose the actual token.
        """

        credential = getattr(
            obj,
            "credential",
            None,
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


# ==========================================================
# JOB SERIALIZER
# ==========================================================

class JobSerializer(
    serializers.ModelSerializer
):

    repository_name = serializers.CharField(
        source="repository.name",
        read_only=True,
    )

    repository_type = serializers.CharField(
        source="repository.repository_type",
        read_only=True,
    )

    duration_seconds = serializers.FloatField(
        read_only=True,
    )

    class Meta:

        model = DeliveryJob

        fields = "__all__"

        read_only_fields = [
            "id",
            "job_reference",
            "status",
            "files_count",
            "archive_name",
            "archive_path",
            "archive_size",
            "commit",
            "error",
            "started_at",
            "finished_at",
            "created_at",
        ]
