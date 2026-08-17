from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import (
    LoginSerializer,
    SignupSerializer,
    UserSerializer,
)
from rest_framework_simplejwt.tokens import (
    RefreshToken,
)

from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)

from rest_framework_simplejwt.tokens import (
    RefreshToken,
)

from .serializers import (
    LoginSerializer,
    UserSerializer,
)


class LoginView(APIView):

    permission_classes = [
        AllowAny
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