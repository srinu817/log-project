from rest_framework import serializers

from django.contrib.auth import authenticate

from .models import User


# ============================================================
# LOGIN
# ============================================================

class LoginSerializer(serializers.Serializer):

    username = serializers.CharField(
        help_text=(
            "Username or email address."
        )
    )

    password = serializers.CharField(
        write_only=True
    )

    def validate(self, attrs):

        identifier = attrs.get(
            "username"
        )

        password = attrs.get(
            "password"
        )

        identifier = identifier.strip()

        if not identifier:

            raise serializers.ValidationError(
                "Username or email is required."
            )

        if not password:

            raise serializers.ValidationError(
                "Password is required."
            )

        # ------------------------------------------------------
        # FIND USER BY USERNAME OR EMAIL
        # ------------------------------------------------------

        user = None

        user = User.objects.filter(
            username__iexact=identifier
        ).first()

        if user is None:

            user = User.objects.filter(
                email__iexact=identifier
            ).first()

        # ------------------------------------------------------
        # AUTHENTICATE PASSWORD
        # ------------------------------------------------------

        if user is not None:

            authenticated_user = authenticate(
                username=user.username,
                password=password,
            )

        else:

            authenticated_user = None

        if not authenticated_user:

            raise serializers.ValidationError(
                "Invalid username/email or password."
            )

        # ------------------------------------------------------
        # CHECK ACCOUNT STATUS
        # ------------------------------------------------------

        if not authenticated_user.is_active:

            raise serializers.ValidationError(
                "This account is inactive."
            )

        attrs["user"] = authenticated_user

        return attrs


# ============================================================
# USER
# ============================================================

class UserSerializer(serializers.ModelSerializer):

    class Meta:

        model = User

        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "role",
            "is_active",
            "created_at",
        ]


# ============================================================
# PUBLIC SIGNUP
# ============================================================

class SignupSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    password_confirm = serializers.CharField(
        write_only=True,
    )

    class Meta:

        model = User

        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "password_confirm",
        ]

    def validate(self, attrs):

        password = attrs.get(
            "password"
        )

        password_confirm = attrs.get(
            "password_confirm"
        )

        if password != password_confirm:

            raise serializers.ValidationError(
                {
                    "password": (
                        "Passwords do not match."
                    )
                }
            )

        return attrs

    def validate_username(self, value):

        value = value.strip()

        if not value:

            raise serializers.ValidationError(
                "Username is required."
            )

        if User.objects.filter(
            username__iexact=value
        ).exists():

            raise serializers.ValidationError(
                "Username already exists."
            )

        return value

    def validate_email(self, value):

        value = value.strip().lower()

        if User.objects.filter(
            email__iexact=value
        ).exists():

            raise serializers.ValidationError(
                "Email already exists."
            )

        return value

    def create(self, validated_data):

        validated_data.pop(
            "password_confirm"
        )

        password = validated_data.pop(
            "password"
        )

        user = User.objects.create_user(
            password=password,
            role=User.Role.USER,
            **validated_data,
        )

        return user


# ============================================================
# PASSWORD RESET
# ============================================================

class PasswordResetSerializer(serializers.Serializer):
    """
    Validates the new password used by the password-reset
    endpoint.

    The uid/token validation remains in ResetPasswordView
    because those values are URL parameters.
    """

    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    password_confirm = serializers.CharField(
        write_only=True,
    )

    def validate(self, attrs):

        password = attrs.get(
            "password"
        )

        password_confirm = attrs.get(
            "password_confirm"
        )

        if password != password_confirm:

            raise serializers.ValidationError(
                {
                    "password": (
                        "Passwords do not match."
                    )
                }
            )

        return attrs


# ============================================================
# ADMIN USER MANAGEMENT
# ============================================================

class AdminUserCreateSerializer(serializers.ModelSerializer):
    """
    Serializer used by administrators to create application users.

    Administrators may assign the USER, MANAGER or ADMIN role.

    Public signup remains separate and always creates a USER.
    """

    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    password_confirm = serializers.CharField(
        write_only=True,
    )

    class Meta:

        model = User

        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "password_confirm",
            "role",
        ]

    def validate_username(self, value):

        value = value.strip()

        if not value:

            raise serializers.ValidationError(
                "Username is required."
            )

        if User.objects.filter(
            username__iexact=value
        ).exists():

            raise serializers.ValidationError(
                "Username already exists."
            )

        return value

    def validate_email(self, value):

        value = value.strip().lower()

        if User.objects.filter(
            email__iexact=value
        ).exists():

            raise serializers.ValidationError(
                "Email already exists."
            )

        return value

    def validate_role(self, value):

        allowed_roles = {
            User.Role.ADMIN,
            User.Role.MANAGER,
            User.Role.USER,
        }

        if value not in allowed_roles:

            raise serializers.ValidationError(
                "Only ADMIN, MANAGER or USER "
                "roles can be assigned here."
            )

        return value

    def validate(self, attrs):

        if attrs.get(
            "password"
        ) != attrs.get(
            "password_confirm"
        ):

            raise serializers.ValidationError(
                {
                    "password": (
                        "Passwords do not match."
                    )
                }
            )

        return attrs

    def create(self, validated_data):

        validated_data.pop(
            "password_confirm"
        )

        password = validated_data.pop(
            "password"
        )

        return User.objects.create_user(
            password=password,
            **validated_data,
        )


# ============================================================
# ADMIN USER UPDATE
# ============================================================

class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer used by administrators to update role,
    profile information and account activation state.

    Password changes are intentionally handled separately
    rather than accepting raw passwords in a general PATCH.
    """

    class Meta:

        model = User

        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
        ]

    def validate_username(self, value):

        value = value.strip()

        if not value:

            raise serializers.ValidationError(
                "Username is required."
            )

        queryset = User.objects.filter(
            username__iexact=value
        ).exclude(
            pk=self.instance.pk
        )

        if queryset.exists():

            raise serializers.ValidationError(
                "Username already exists."
            )

        return value

    def validate_email(self, value):

        value = value.strip().lower()

        queryset = User.objects.filter(
            email__iexact=value
        ).exclude(
            pk=self.instance.pk
        )

        if queryset.exists():

            raise serializers.ValidationError(
                "Email already exists."
            )

        return value

    def validate_role(self, value):

        allowed_roles = {
            User.Role.ADMIN,
            User.Role.MANAGER,
            User.Role.USER,
        }

        if value not in allowed_roles:

            raise serializers.ValidationError(
                "Only ADMIN, MANAGER or USER "
                "roles can be assigned here."
            )

        return value