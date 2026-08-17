from rest_framework import serializers

from django.contrib.auth import authenticate

from .models import User


class LoginSerializer(serializers.Serializer):

    username = serializers.CharField()

    password = serializers.CharField(
        write_only=True
    )

    def validate(self, attrs):

        username = attrs.get(
            "username"
        )

        password = attrs.get(
            "password"
        )

        user = authenticate(
            username=username,
            password=password,
        )

        if not user:

            raise serializers.ValidationError(
                "Invalid username or password."
            )

        if not user.is_active:

            raise serializers.ValidationError(
                "This account is inactive."
            )

        attrs["user"] = user

        return attrs


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
# ADMIN USER MANAGEMENT
# ============================================================

class AdminUserCreateSerializer(serializers.ModelSerializer):
    """
    Serializer used by administrators to create application users.

    Unlike public signup, an administrator may assign the
    USER or MANAGER role. ADMIN creation is deliberately blocked
    through this API so the highest-privilege role is not casually
    created from the user-management screen.
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
            User.Role.USER,
            User.Role.MANAGER,
        }

        if value not in allowed_roles:

            raise serializers.ValidationError(
                "Only USER or MANAGER roles can be assigned here."
            )

        return value

    def validate(self, attrs):

        if attrs.get("password") != attrs.get(
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
            User.Role.USER,
            User.Role.MANAGER,
        }

        if value not in allowed_roles:

            raise serializers.ValidationError(
                "Only USER or MANAGER roles can be assigned here."
            )

        return value