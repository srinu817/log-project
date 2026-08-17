from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from rest_framework_simplejwt.tokens import (
    RefreshToken,
)
from .throttles import (
    LoginRateThrottle,
    SignupRateThrottle,
)
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)

from .permissions import IsAdmin

from .models import User

from .serializers import (
    LoginSerializer,
    SignupSerializer,
    UserSerializer,
    AdminUserCreateSerializer,
    AdminUserUpdateSerializer,
)


class LoginView(APIView):

    permission_classes = [
        AllowAny
    ]
    throttle_classes = [
        LoginRateThrottle
    ]

    def post(
        self,
        request,
    ):

        serializer = LoginSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        user = serializer.validated_data[
            "user"
        ]

        refresh = RefreshToken.for_user(
            user
        )

        return Response(
            {
                "message": (
                    "Login successful."
                ),

                "access": str(
                    refresh.access_token
                ),

                "refresh": str(
                    refresh
                ),

                "user": UserSerializer(
                    user
                ).data,
            },

            status=status.HTTP_200_OK,
        )


class MeView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
    ):

        return Response(
            {
                "user": UserSerializer(
                    request.user
                ).data
            }
        )


class SignupView(APIView):

    permission_classes = [
        AllowAny
    ]
    throttle_classes = [
        SignupRateThrottle
    ]
    def post(
        self,
        request,
    ):

        serializer = SignupSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        user = serializer.save()

        return Response(
            {
                "message": (
                    "Account created successfully."
                ),

                "user": UserSerializer(
                    user
                ).data,
            },

            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def post(
        self,
        request,
    ):

        refresh_token = request.data.get(
            "refresh"
        )

        if not refresh_token:

            return Response(
                {
                    "error": (
                        "Refresh token is required."
                    )
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            token = RefreshToken(
                refresh_token
            )

            token.blacklist()

            return Response(
                {
                    "message": (
                        "Logout successful."
                    )
                },

                status=status.HTTP_200_OK,
            )

        except Exception:

            return Response(
                {
                    "error": (
                        "Invalid or expired "
                        "refresh token."
                    )
                },

                status=status.HTTP_400_BAD_REQUEST,
            )


# ============================================================
# ADMIN USER MANAGEMENT
# ============================================================

class UserManagementListView(APIView):
    """
    ADMIN-only user management.

    GET:
        List application users.

    POST:
        Create a USER or MANAGER account.

    Public signup remains separate and always creates USER.
    """

    permission_classes = [
        IsAdmin
    ]

    def get(
        self,
        request,
    ):

        users = User.objects.all().order_by(
            "-created_at"
        )

        serializer = UserSerializer(
            users,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def post(
        self,
        request,
    ):

        serializer = AdminUserCreateSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        user = serializer.save()

        return Response(
            {
                "message": (
                    "User created successfully."
                ),
                "user": UserSerializer(
                    user
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class UserManagementDetailView(APIView):
    """
    ADMIN-only management of an existing application user.

    PATCH:
        Update profile, role or active state.

    DELETE:
        Deliberately disabled. Accounts should be deactivated
        rather than deleted so historical/audit records remain
        meaningful.
    """

    permission_classes = [
        IsAdmin
    ]

    def get_user(
        self,
        user_id,
    ):

        try:

            return User.objects.get(
                pk=user_id
            )

        except User.DoesNotExist:

            return None

    def patch(
        self,
        request,
        user_id,
    ):

        user = self.get_user(
            user_id
        )

        if user is None:

            return Response(
                {
                    "error": (
                        "User not found."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevent an administrator from accidentally
        # locking themselves out or removing their own
        # highest privilege through this endpoint.
        if user.id == request.user.id:

            if (
                "is_active" in request.data
                and not request.data["is_active"]
            ):

                return Response(
                    {
                        "error": (
                            "You cannot deactivate your own account."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if (
                "role" in request.data
                and request.data["role"]
                != User.Role.ADMIN
            ):

                return Response(
                    {
                        "error": (
                            "You cannot remove your own administrator role."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = AdminUserUpdateSerializer(
            user,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        updated_user = serializer.save()

        return Response(
            {
                "message": (
                    "User updated successfully."
                ),
                "user": UserSerializer(
                    updated_user
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    def delete(
        self,
        request,
        user_id,
    ):

        return Response(
            {
                "error": (
                    "User deletion is disabled. "
                    "Deactivate the account instead."
                )
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )