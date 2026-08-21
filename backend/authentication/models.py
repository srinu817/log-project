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