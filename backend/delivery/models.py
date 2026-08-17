from django.db import models


class RepositoryConfig(models.Model):

    class RepositoryType(models.TextChoices):
        LOCAL = "LOCAL", "Local Git"
        GITHUB = "GITHUB", "GitHub"
        GITLAB = "GITLAB", "GitLab"
        AZURE_DEVOPS = "AZURE_DEVOPS", "Azure DevOps"
        INTERNAL_GIT = "INTERNAL_GIT", "Internal Git"

    class EmailMode(models.TextChoices):
        SIMULATION = "SIMULATION", "Simulation"
        SMTP = "SMTP"

    name = models.CharField(
        max_length=120,
        unique=True,
    )

    description = models.TextField(
        blank=True,
    )

    repository_type = models.CharField(
        max_length=30,
        choices=RepositoryType.choices,
        default=RepositoryType.LOCAL,
    )

    repository_url = models.URLField(
        max_length=500,
        blank=True,
    )

    local_path = models.CharField(
        max_length=500,
        blank=True,
    )

    branch = models.CharField(
        max_length=120,
        default="main",
    )

    # ==========================================================
    # LEGACY / BACKWARD COMPATIBILITY
    # ==========================================================

    # Existing single target configuration.
    #
    # Examples:
    #
    # build.sh
    # logs/
    # backend/logs/
    #
    # This is kept so existing repositories continue to work.

    target_path = models.CharField(
        max_length=500,
        default="logs",
    )

    log_directory = models.CharField(
        max_length=255,
        default="logs",
    )

    extensions = models.JSONField(
        default=list,
    )

    # ==========================================================
    # MULTIPLE TARGETS
    # ==========================================================

    targets = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "List of files or directories to collect. "
            "Each target should contain a path and optional "
            "allowed extensions."
        ),
    )

    # Example:
    #
    # [
    #     {
    #         "path": "backend/requirements.txt",
    #         "extensions": [".txt"]
    #     },
    #     {
    #         "path": "backend/build.sh",
    #         "extensions": [".sh"]
    #     },
    #     {
    #         "path": "frontend/package.json",
    #         "extensions": [".json"]
    #     }
    # ]

    # ==========================================================
    # DELIVERY CONFIGURATION
    # ==========================================================

    recipients = models.JSONField(
        default=list,
    )

    email_mode = models.CharField(
        max_length=30,
        choices=EmailMode.choices,
        default=EmailMode.SIMULATION,
    )

    active = models.BooleanField(
        default=True,
    )

    # ==========================================================
    # CONNECTION STATUS
    # ==========================================================

    connection_status = models.CharField(
        max_length=30,
        default="UNKNOWN",
    )

    last_connection_check = models.DateTimeField(
        null=True,
        blank=True,
    )

    # ==========================================================
    # TIMESTAMPS
    # ==========================================================

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.name


class RepositoryCredential(models.Model):
    """
    Stores authentication information for a repository.

    IMPORTANT:
    The actual access token must be stored encrypted.

    Never return encrypted_token through an API serializer.
    """

    class AuthType(models.TextChoices):
        NONE = "NONE", "Public / No Authentication"
        PAT = "PAT", "Personal Access Token"
        SSH = "SSH", "SSH Key"

    repository = models.OneToOneField(
        RepositoryConfig,
        on_delete=models.CASCADE,
        related_name="credential",
    )

    auth_type = models.CharField(
        max_length=20,
        choices=AuthType.choices,
        default=AuthType.NONE,
    )

    username = models.CharField(
        max_length=255,
        blank=True,
    )

    # NEVER store the raw GitHub token here.
    # This field contains the encrypted value.
    encrypted_token = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return (
            f"Credential for "
            f"{self.repository.name}"
        )


class DeliveryJob(models.Model):

    class Status(models.TextChoices):
        QUEUED = "QUEUED", "Queued"
        RUNNING = "RUNNING", "Running"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"
        DRY_RUN = "DRY_RUN", "Dry Run"

    job_reference = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
        editable=False,
    )

    repository = models.ForeignKey(
        RepositoryConfig,
        on_delete=models.PROTECT,
        related_name="jobs",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.QUEUED,
    )

    is_dry_run = models.BooleanField(
        default=False,
    )

    files_count = models.PositiveIntegerField(
        default=0,
    )

    archive_name = models.CharField(
        max_length=255,
        blank=True,
    )

    archive_path = models.CharField(
        max_length=500,
        blank=True,
    )

    archive_size = models.PositiveBigIntegerField(
        default=0,
    )

    recipients = models.JSONField(
        default=list,
    )

    commit = models.CharField(
        max_length=64,
        blank=True,
    )

    error = models.TextField(
        blank=True,
    )

    started_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    finished_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    # ==========================================================
    # DURATION
    # ==========================================================

    @property
    def duration_seconds(self):

        if (
            not self.started_at
            or not self.finished_at
        ):
            return None

        return (
            self.finished_at
            - self.started_at
        ).total_seconds()

    def __str__(self):
        return (
            self.job_reference
            or f"Job {self.pk}"
        )