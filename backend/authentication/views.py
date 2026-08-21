from django.contrib.auth.tokens import (
    default_token_generator,
)

from django.core.mail import send_mail

from django.utils.encoding import (
    force_bytes,
)

from django.utils.http import (
    urlsafe_base64_encode,
    urlsafe_base64_decode,
)

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

from .permissions import (
    IsAdmin,
    IsUserManagementRole,
)

from .models import User

from .serializers import (
    LoginSerializer,
    SignupSerializer,
    PasswordResetSerializer,
    UserSerializer,
    AdminUserCreateSerializer,
    AdminUserUpdateSerializer,
)


# ============================================================
# LOGIN
# ============================================================

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

        # ------------------------------------------------------
        # DJANGO SUPERUSER -> APPLICATION ADMIN
        #
        # Django's is_superuser flag and our custom `role`
        # field are separate.
        #
        # If an existing Django superuser accidentally has:
        #
        #     role = USER
        #
        # we automatically synchronize it to:
        #
        #     role = ADMIN
        #
        # This prevents a Django superuser from being treated
        # like a normal application USER.
        # ------------------------------------------------------

        if user.is_superuser:

            if user.role != User.Role.ADMIN:

                user.role = User.Role.ADMIN

                user.is_staff = True

                user.is_active = True

                user.save(
                    update_fields=[
                        "role",
                        "is_staff",
                        "is_active",
                        "updated_at",
                    ]
                )

        # ------------------------------------------------------
        # CREATE JWT
        # ------------------------------------------------------

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


# ============================================================
# CURRENT USER
# ============================================================

class MeView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
    ):

        user = request.user

        # ------------------------------------------------------
        # KEEP SUPERUSER ROLE SYNCHRONIZED
        # ------------------------------------------------------

        if (
            user.is_superuser
            and user.role
            != User.Role.ADMIN
        ):

            user.role = User.Role.ADMIN

            user.is_staff = True

            user.is_active = True

            user.save(
                update_fields=[
                    "role",
                    "is_staff",
                    "is_active",
                    "updated_at",
                ]
            )

        return Response(
            {
                "user": UserSerializer(
                    user
                ).data
            },

            status=status.HTTP_200_OK,
        )


# ============================================================
# SIGNUP
# ============================================================

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

        # ------------------------------------------------------
        # PUBLIC SIGNUP
        #
        # SignupSerializer always creates USER.
        #
        # A public signup can NEVER create ADMIN/MANAGER.
        # ------------------------------------------------------

        user = serializer.save()

        # ------------------------------------------------------
        # WELCOME EMAIL
        # ------------------------------------------------------

        try:

            send_mail(
                subject=(
                    "Welcome to Log Delivery Management"
                ),

                message=(
                    f"Hello "
                    f"{user.first_name or user.username},\n\n"

                    "Welcome to Log Delivery Management.\n\n"

                    "Your account has been created "
                    "successfully.\n\n"

                    f"Username: {user.username}\n"
                    f"Email: {user.email}\n"
                    "Role: USER\n\n"

                    "You can now sign in to the application "
                    "using your registered credentials.\n\n"

                    "If you did not create this account, "
                    "please contact your administrator.\n\n"

                    "Regards,\n"
                    "Log Delivery Management Team"
                ),

                from_email=None,

                recipient_list=[
                    user.email
                ],

                fail_silently=False,
            )

        except Exception as exc:

            # --------------------------------------------------
            # IMPORTANT
            #
            # Account creation must NOT fail just because
            # SMTP/email delivery failed.
            #
            # The exception is logged to the server console,
            # while the API still returns successful signup.
            # --------------------------------------------------

            print(
                "[SIGNUP EMAIL ERROR]",
                exc,
            )

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


# ============================================================
# LOGOUT
# ============================================================

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
# FORGOT PASSWORD
# ============================================================

class ForgotPasswordView(APIView):
    """
    Starts the password-reset process.

    User provides an email address.

    For security, the API returns the same response whether
    the email exists or not.
    """

    permission_classes = [
        AllowAny
    ]

    def post(
        self,
        request,
    ):

        email = request.data.get(
            "email",
            "",
        )

        email = email.strip().lower()

        if not email:

            return Response(
                {
                    "error": (
                        "Email address is required."
                    )
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(
            email__iexact=email
        ).first()

        # ------------------------------------------------------
        # DO NOT REVEAL WHETHER ACCOUNT EXISTS
        # ------------------------------------------------------

        if user is not None:

            if user.is_active:

                token = (
                    default_token_generator.make_token(
                        user
                    )
                )

                uid = (
                    urlsafe_base64_encode(
                        force_bytes(
                            user.pk
                        )
                    )
                )

                # --------------------------------------------------
                # RESET URL
                # --------------------------------------------------

                reset_link = (
                    "http://localhost:5173/"
                    f"reset-password/{uid}/{token}"
                )

                try:

                    send_mail(
                        subject=(
                            "Log Delivery Management "
                            "Password Reset"
                        ),

                        message=(
                            "Hello,\n\n"

                            "We received a request to reset "
                            "your Log Delivery Management "
                            "password.\n\n"

                            "Use the following link to reset "
                            "your password:\n\n"

                            f"{reset_link}\n\n"

                            "If you did not request this, "
                            "you can safely ignore this email."
                        ),

                        from_email=None,

                        recipient_list=[
                            user.email
                        ],

                        fail_silently=False,
                    )

                except Exception as exc:

                    print(
                        "[PASSWORD RESET EMAIL ERROR]",
                        exc,
                    )

        return Response(
            {
                "message": (
                    "If an account exists for that "
                    "email, password reset instructions "
                    "have been sent."
                )
            },

            status=status.HTTP_200_OK,
        )


# ============================================================
# RESET PASSWORD
# ============================================================

class ResetPasswordView(APIView):
    """
    Completes the password reset process.

    Expected URL:

        /reset-password/<uid>/<token>/

    Expected body:

        {
            "password": "...",
            "password_confirm": "..."
        }

    After a successful reset:

        1. Password is changed.
        2. Fresh JWT tokens are created.
        3. User information is returned.

    This allows the frontend to immediately redirect to
    the Dashboard.
    """

    permission_classes = [
        AllowAny
    ]

    def post(
        self,
        request,
        uid,
        token,
    ):

        # ------------------------------------------------------
        # VALIDATE PASSWORD
        # ------------------------------------------------------

        serializer = PasswordResetSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        password = serializer.validated_data[
            "password"
        ]

        # ------------------------------------------------------
        # DECODE USER ID
        # ------------------------------------------------------

        try:

            user_id = (
                urlsafe_base64_decode(
                    uid
                ).decode()
            )

            user = User.objects.get(
                pk=user_id
            )

        except (
            ValueError,
            TypeError,
            OverflowError,
            UnicodeDecodeError,
            User.DoesNotExist,
        ):

            return Response(
                {
                    "error": (
                        "Invalid password reset link."
                    )
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        # ------------------------------------------------------
        # ACCOUNT STATUS
        # ------------------------------------------------------

        if not user.is_active:

            return Response(
                {
                    "error": (
                        "This account is inactive."
                    )
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        # ------------------------------------------------------
        # TOKEN VALIDATION
        # ------------------------------------------------------

        if not default_token_generator.check_token(
            user,
            token,
        ):

            return Response(
                {
                    "error": (
                        "This password reset link "
                        "is invalid or has expired."
                    )
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        # ------------------------------------------------------
        # UPDATE PASSWORD
        # ------------------------------------------------------

        user.set_password(
            password
        )

        user.save(
            update_fields=[
                "password",
                "updated_at",
            ]
        )

        # ------------------------------------------------------
        # CREATE NEW JWT SESSION
        # ------------------------------------------------------

        refresh = RefreshToken.for_user(
            user
        )

        return Response(
            {
                "message": (
                    "Password reset successfully. "
                    "Signing you in..."
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


# ============================================================
# USER MANAGEMENT
# ============================================================

class UserManagementListView(APIView):
    """
    ADMIN + MANAGER user management.

    GET:
        ADMIN + MANAGER can see all users.

    POST:
        ADMIN + MANAGER can create users.

    ADMIN:
        Can create ADMIN, MANAGER and USER.

    MANAGER:
        Can create MANAGER and USER.

        Cannot create ADMIN.

    Public signup remains separate and always creates USER.
    """

    permission_classes = [
        IsUserManagementRole
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

        # ------------------------------------------------------
        # NORMALIZE INPUT
        # ------------------------------------------------------

        username = str(
            request.data.get(
                "username",
                "",
            )
            or ""
        ).strip()

        email = str(
            request.data.get(
                "email",
                "",
            )
            or ""
        ).strip().lower()

        # ------------------------------------------------------
        # DUPLICATE USERNAME
        # ------------------------------------------------------

        if username and User.objects.filter(
            username__iexact=username
        ).exists():

            return Response(
                {
                    "error": (
                        "Username already exists."
                    ),
                    "field": "username",
                    "code": "USERNAME_EXISTS",
                },
                status=status.HTTP_409_CONFLICT,
            )

        # ------------------------------------------------------
        # DUPLICATE EMAIL
        # ------------------------------------------------------

        if email and User.objects.filter(
            email__iexact=email
        ).exists():

            return Response(
                {
                    "error": (
                        "Email already exists."
                    ),
                    "field": "email",
                    "code": "EMAIL_EXISTS",
                },
                status=status.HTTP_409_CONFLICT,
            )

        # ------------------------------------------------------
        # CREATE USER
        # ------------------------------------------------------

        serializer = AdminUserCreateSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        user = serializer.save()

        # ------------------------------------------------------
        # WELCOME EMAIL
        # ------------------------------------------------------

        try:

            role_label = (
                user.get_role_display()
            )

            send_mail(
                subject=(
                    "Your Log Delivery Management "
                    "Account"
                ),

                message=(
                    f"Hello "
                    f"{user.first_name or user.username},\n\n"

                    "Your Log Delivery Management account "
                    "has been created successfully.\n\n"

                    f"Username: {user.username}\n"
                    f"Email: {user.email}\n"
                    f"Role: {role_label}\n\n"

                    "You can now sign in using your "
                    "registered credentials.\n\n"

                    "If you believe this account was "
                    "created by mistake, please contact "
                    "your administrator.\n\n"

                    "Regards,\n"
                    "Log Delivery Management Team"
                ),

                from_email=None,

                recipient_list=[
                    user.email
                ],

                fail_silently=True,
            )

        except Exception as exc:

            print(
                "[USER CREATION EMAIL ERROR]",
                exc,
            )

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


# ============================================================
# USER MANAGEMENT DETAIL
# ============================================================

class UserManagementDetailView(APIView):
    """
    ADMIN + MANAGER management of existing users.

    ADMIN:
        Can edit profile, role and activation state.

    MANAGER:
        Can edit profile and role.

        Cannot activate/deactivate.

        Cannot assign ADMIN role.

    USER:
        No access.
    """

    permission_classes = [
        IsUserManagementRole
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

        # ------------------------------------------------------
        # MANAGER RESTRICTIONS
        # ------------------------------------------------------

        if (
            request.user.role
            == User.Role.MANAGER
        ):

            # Managers cannot activate/deactivate.

            if "is_active" in request.data:

                return Response(
                    {
                        "error": (
                            "Managers cannot "
                            "activate or deactivate users."
                        )
                    },

                    status=status.HTTP_403_FORBIDDEN,
                )

            # Managers cannot assign ADMIN.

            if (
                "role" in request.data
                and request.data["role"]
                == User.Role.ADMIN
            ):

                return Response(
                    {
                        "error": (
                            "Managers cannot assign "
                            "the Administrator role."
                        )
                    },

                    status=status.HTTP_403_FORBIDDEN,
                )

        # ------------------------------------------------------
        # ADMIN SELF-PROTECTION
        # ------------------------------------------------------

        if (
            request.user.role
            == User.Role.ADMIN
            and user.id
            == request.user.id
        ):

            # Cannot deactivate yourself.

            if (
                "is_active" in request.data
                and not request.data[
                    "is_active"
                ]
            ):

                return Response(
                    {
                        "error": (
                            "You cannot deactivate "
                            "your own account."
                        )
                    },

                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Cannot remove own ADMIN role.

            if (
                "role" in request.data
                and request.data["role"]
                != User.Role.ADMIN
            ):

                return Response(
                    {
                        "error": (
                            "You cannot remove your "
                            "own administrator role."
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

    # ----------------------------------------------------------
    # DELETE
    # ----------------------------------------------------------

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