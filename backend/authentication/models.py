from django.contrib.auth.models import (
    AbstractUser,
    UserManager,
)

from django.db import models


# ============================================================
# USER MANAGER
# ============================================================

class UserManager(UserManager):
    """
    Custom user manager.

    Important:
    Django's createsuperuser command creates a Django
    superuser, but it does not automatically know about
    our application's custom `role` field.

    Therefore create_superuser() explicitly assigns:

        role = ADMIN
    """

    def create_superuser(
        self,
        username,
        email=None,
        password=None,
        **extra_fields,
    ):

        extra_fields.setdefault(
            "is_staff",
            True,
        )

        extra_fields.setdefault(
            "is_superuser",
            True,
        )

        extra_fields.setdefault(
            "is_active",
            True,
        )

        # ----------------------------------------------------
        # IMPORTANT
        # Django superuser = application ADMIN
        # ----------------------------------------------------

        extra_fields["role"] = (
            self.model.Role.ADMIN
        )

        if extra_fields.get(
            "is_staff"
        ) is not True:

            raise ValueError(
                "Superuser must have "
                "is_staff=True."
            )

        if extra_fields.get(
            "is_superuser"
        ) is not True:

            raise ValueError(
                "Superuser must have "
                "is_superuser=True."
            )

        return self.create_user(
            username=username,
            email=email,
            password=password,
            **extra_fields,
        )


# ============================================================
# USER
# ============================================================

class User(AbstractUser):

    class Role(models.TextChoices):

        ADMIN = (
            "ADMIN",
            "Administrator",
        )

        MANAGER = (
            "MANAGER",
            "Manager",
        )

        USER = (
            "USER",
            "User",
        )

    email = models.EmailField(
        unique=True,
    )

    role = models.CharField(
        max_length=20,

        choices=Role.choices,

        default=Role.USER,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    # --------------------------------------------------------
    # CUSTOM MANAGER
    # --------------------------------------------------------

    objects = UserManager()

    def __str__(self):

        return (
            f"{self.username} "
            f"({self.role})"
        )


# ============================================================
# USER SETTINGS
# ============================================================

class UserSettings(models.Model):
    """
    Stores application preferences for an individual user.

    Settings are kept separate from the User model so that
    authentication/profile information and application
    preferences remain independent.

    Each user has exactly one settings record.
    """

    class Theme(models.TextChoices):

        SYSTEM = (
            "System default",
            "System default",
        )

        LIGHT = (
            "Light",
            "Light",
        )

        DARK = (
            "Dark",
            "Dark",
        )

    class Font(models.TextChoices):

        INTER = (
            "Inter",
            "Inter",
        )

        NOTO_SANS = (
            "Noto Sans",
            "Noto Sans",
        )

        POPPINS = (
            "Poppins",
            "Poppins",
        )

    class Language(models.TextChoices):

        ENGLISH = (
            "English",
            "English",
        )

        TELUGU = (
            "Telugu",
            "Telugu",
        )

        HINDI = (
            "Hindi",
            "Hindi",
        )

    class DeliveryMode(models.TextChoices):

        LIVE = (
            "Live",
            "Live",
        )

        DRY_RUN = (
            "Dry run",
            "Dry run",
        )

        PREVIEW = (
            "Preview",
            "Preview",
        )

    # ========================================================
    # USER
    # ========================================================

    user = models.OneToOneField(
        "authentication.User",
        on_delete=models.CASCADE,
        related_name="settings",
    )

    # ========================================================
    # APPEARANCE
    # ========================================================

    theme = models.CharField(
        max_length=30,
        choices=Theme.choices,
        default=Theme.SYSTEM,
    )

    font = models.CharField(
        max_length=30,
        choices=Font.choices,
        default=Font.INTER,
    )

    language = models.CharField(
        max_length=30,
        choices=Language.choices,
        default=Language.ENGLISH,
    )

    # ========================================================
    # APPLICATION PREFERENCES
    # ========================================================

    default_repository = models.ForeignKey(
        "delivery.RepositoryConfig",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="default_for_users",
    )

    default_delivery_mode = models.CharField(
        max_length=30,
        choices=DeliveryMode.choices,
        default=DeliveryMode.LIVE,
    )

    items_per_page = models.PositiveIntegerField(
        default=10,
    )

    confirm_before_delivery = models.BooleanField(
        default=True,
    )

    auto_refresh_dashboard = models.BooleanField(
        default=True,
    )

    auto_refresh_interval = models.PositiveIntegerField(
        default=5,
        help_text=(
            "Dashboard auto-refresh interval in minutes."
        ),
    )

    # ========================================================
    # NOTIFICATIONS
    # ========================================================

    successful_deliveries = models.BooleanField(
        default=True,
    )

    failed_deliveries = models.BooleanField(
        default=True,
    )

    dry_run_completions = models.BooleanField(
        default=True,
    )

    repository_connection_failures = models.BooleanField(
        default=True,
    )

    notification_recipients = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "Email addresses that receive application "
            "notification messages."
        ),
    )

    # ========================================================
    # TIMESTAMPS
    # ========================================================

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):

        return (
            f"Settings for "
            f"{self.user.username}"
        )