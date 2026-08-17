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

    targets = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "List of files or directories to collect. "
            "Each target should contain a path and optional "
            "allowed extensions."
        ),
    )

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

    connection_status = models.CharField(
        max_length=30,
        default="UNKNOWN",
    )

    last_connection_check = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.name


class RepositoryCredential(models.Model):

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


# ============================================================
# AUDIT LOG
# ============================================================

class AuditLog(models.Model):
    """
    Immutable application audit record.

    Captures who performed an action, what resource was affected,
    when it happened, the originating IP address, and safe
    contextual metadata.

    Never store passwords, JWTs, repository tokens, SMTP
    credentials, secret keys, or other sensitive credentials
    in metadata.
    """

    user = models.ForeignKey(
        "authentication.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )

    action = models.CharField(
        max_length=100,
    )

    resource = models.CharField(
        max_length=100,
    )

    resource_id = models.CharField(
        max_length=100,
        blank=True,
    )

    timestamp = models.DateTimeField(
        auto_now_add=True,
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    class Meta:
        ordering = [
            "-timestamp",
        ]

        indexes = [
            models.Index(
                fields=[
                    "user",
                    "-timestamp",
                ],
                name="audit_user_time_idx",
            ),
            models.Index(
                fields=[
                    "action",
                    "-timestamp",
                ],
                name="audit_action_time_idx",
            ),
            models.Index(
                fields=[
                    "resource",
                    "-timestamp",
                ],
                name="audit_resource_time_idx",
            ),
        ]

    def __str__(self):
        return (
            f"{self.action} "
            f"on {self.resource} "
            f"{self.resource_id or ''}".strip()
        )