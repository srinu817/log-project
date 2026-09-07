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

from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
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

from .models import (
    User,
    UserSettings,
)

from .serializers import (
    LoginSerializer,
    SignupSerializer,
    PasswordResetSerializer,
    UserSerializer,
    UserSettingsSerializer,
    AdminUserCreateSerializer,
    AdminUserUpdateSerializer,
)

# ============================================================
# AUDIT LOGGING
# ============================================================

from delivery.models import (
    AuditLog,
)

from delivery.audit_service import (
    AuditService,
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

        # ------------------------------------------------------
        # AUDIT LOGIN
        # ------------------------------------------------------

        try:

            AuditService.log(
                request=request,
                user=user,
                action="USER_LOGIN",
                resource="authentication",
                resource_id=str(
                    user.id
                ),
                metadata={
                    "username": user.username,
                    "role": user.role,
                },
            )

        except Exception as exc:

            # Audit failure must never prevent
            # successful authentication.

            print(
                "[AUDIT LOGIN ERROR]",
                exc,
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
# CURRENT USER / PROFILE
# ============================================================

class MeView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    # ----------------------------------------------------------
    # GET PROFILE
    # ----------------------------------------------------------

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

    # ----------------------------------------------------------
    # EDIT OWN PROFILE
    # ----------------------------------------------------------

    def patch(
        self,
        request,
    ):

        user = request.user

        # ------------------------------------------------------
        # PROFILE FIELDS ONLY
        #
        # role and is_active are read-only in UserSerializer.
        #
        # Password is deliberately NOT handled here.
        # ------------------------------------------------------

        allowed_fields = {
            "username",
            "email",
            "first_name",
            "last_name",
        }

        submitted_fields = set(
            request.data.keys()
        )

        forbidden_fields = (
            submitted_fields
            - allowed_fields
        )

        if forbidden_fields:

            return Response(
                {
                    "error": (
                        "The following fields cannot "
                        "be changed from your profile: "
                        + ", ".join(
                            sorted(
                                forbidden_fields
                            )
                        )
                    ),
                    "fields": sorted(
                        forbidden_fields
                    ),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        # ------------------------------------------------------
        # DUPLICATE USERNAME
        # ------------------------------------------------------

        if "username" in request.data:

            username = str(
                request.data.get(
                    "username",
                    "",
                )
                or ""
            ).strip()

            if not username:

                return Response(
                    {
                        "error": (
                            "Username is required."
                        ),
                        "field": "username",
                    },

                    status=status.HTTP_400_BAD_REQUEST,
                )

            duplicate_username = (
                User.objects
                .filter(
                    username__iexact=username
                )
                .exclude(
                    pk=user.pk
                )
                .exists()
            )

            if duplicate_username:

                return Response(
                    {
                        "error": (
                            "Username already exists."
                        ),
                        "field": "username",
                        "code": (
                            "USERNAME_EXISTS"
                        ),
                    },

                    status=status.HTTP_409_CONFLICT,
                )

            request.data._mutable = True

            request.data[
                "username"
            ] = username

        # ------------------------------------------------------
        # DUPLICATE EMAIL
        # ------------------------------------------------------

        if "email" in request.data:

            email = str(
                request.data.get(
                    "email",
                    "",
                )
                or ""
            ).strip().lower()

            if not email:

                return Response(
                    {
                        "error": (
                            "Email address is required."
                        ),
                        "field": "email",
                    },

                    status=status.HTTP_400_BAD_REQUEST,
                )

            duplicate_email = (
                User.objects
                .filter(
                    email__iexact=email
                )
                .exclude(
                    pk=user.pk
                )
                .exists()
            )

            if duplicate_email:

                return Response(
                    {
                        "error": (
                            "Email already exists."
                        ),
                        "field": "email",
                        "code": (
                            "EMAIL_EXISTS"
                        ),
                    },

                    status=status.HTTP_409_CONFLICT,
                )

            request.data[
                "email"
            ] = email

        # ------------------------------------------------------
        # CAPTURE ORIGINAL VALUES
        # ------------------------------------------------------

        original_values = {
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }

        # ------------------------------------------------------
        # UPDATE PROFILE
        # ------------------------------------------------------

        serializer = UserSerializer(
            user,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        updated_user = serializer.save()

        # ------------------------------------------------------
        # DETERMINE ACTUAL CHANGES
        # ------------------------------------------------------

        changed_fields = []

        for field in allowed_fields:

            old_value = original_values.get(
                field
            )

            new_value = getattr(
                updated_user,
                field,
            )

            if old_value != new_value:

                changed_fields.append(
                    field
                )

        # ------------------------------------------------------
        # AUDIT PROFILE CHANGE
        # ------------------------------------------------------

        if changed_fields:

            try:

                AuditService.log(
                    request=request,
                    user=updated_user,
                    action="PROFILE_UPDATED",
                    resource="user",
                    resource_id=str(
                        updated_user.id
                    ),
                    metadata={
                        "changed_fields": (
                            changed_fields
                        ),
                    },
                )

            except Exception as exc:

                print(
                    "[AUDIT PROFILE UPDATE ERROR]",
                    exc,
                )

        return Response(
            {
                "message": (
                    "Profile updated successfully."
                ),

                "user": UserSerializer(
                    updated_user
                ).data,
            },

            status=status.HTTP_200_OK,
        )


# ============================================================
# USER SETTINGS
# ============================================================

class SettingsView(APIView):
    """
    Get and update application settings for the authenticated
    user.

    Each user has one UserSettings record.

    GET:
        Returns the current user's application settings.

    PATCH:
        Updates only the submitted settings fields.

    Settings are separate from the user's profile so that
    authentication/profile information and application
    preferences remain independent.
    """

    permission_classes = [
        IsAuthenticated
    ]

    # ----------------------------------------------------------
    # GET SETTINGS
    # ----------------------------------------------------------

    def get(
        self,
        request,
    ):

        settings, created = (
            UserSettings.objects.get_or_create(
                user=request.user
            )
        )

        serializer = UserSettingsSerializer(
            settings
        )

        return Response(
            {
                "settings": serializer.data
            },

            status=status.HTTP_200_OK,
        )

    # ----------------------------------------------------------
    # UPDATE SETTINGS
    # ----------------------------------------------------------

    def patch(
        self,
        request,
    ):

        settings, created = (
            UserSettings.objects.get_or_create(
                user=request.user
            )
        )

        # ------------------------------------------------------
        # CAPTURE ORIGINAL VALUES
        #
        # These are used only for audit information.
        # Notification recipients are intentionally not
        # included in audit metadata.
        # ------------------------------------------------------

        original_values = {
            "theme": settings.theme,
            "font": settings.font,
            "language": settings.language,
            "default_repository": (
                settings.default_repository_id
            ),
            "default_delivery_mode": (
                settings.default_delivery_mode
            ),
            "items_per_page": (
                settings.items_per_page
            ),
            "confirm_before_delivery": (
                settings.confirm_before_delivery
            ),
            "auto_refresh_dashboard": (
                settings.auto_refresh_dashboard
            ),
            "auto_refresh_interval": (
                settings.auto_refresh_interval
            ),
            "successful_deliveries": (
                settings.successful_deliveries
            ),
            "failed_deliveries": (
                settings.failed_deliveries
            ),
            "dry_run_completions": (
                settings.dry_run_completions
            ),
            "repository_connection_failures": (
                settings.repository_connection_failures
            ),
            "notification_recipients": (
                list(
                    settings.notification_recipients
                    or []
                )
            ),
        }

        # ------------------------------------------------------
        # UPDATE SETTINGS
        # ------------------------------------------------------

        serializer = UserSettingsSerializer(
            settings,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        updated_settings = serializer.save()

        # ------------------------------------------------------
        # DETERMINE ACTUAL CHANGES
        # ------------------------------------------------------

        changed_fields = []

        for field in original_values:

            if field == "default_repository":

                old_value = original_values[
                    field
                ]

                new_value = (
                    updated_settings
                    .default_repository_id
                )

            elif field == "notification_recipients":

                old_value = original_values[
                    field
                ]

                new_value = list(
                    updated_settings
                    .notification_recipients
                    or []
                )

            else:

                old_value = original_values[
                    field
                ]

                new_value = getattr(
                    updated_settings,
                    field,
                )

            if old_value != new_value:

                changed_fields.append(
                    field
                )

        # ------------------------------------------------------
        # AUDIT SETTINGS CHANGE
        # ------------------------------------------------------

        if changed_fields:

            try:

                AuditService.log(
                    request=request,
                    user=request.user,
                    action="SETTINGS_UPDATED",
                    resource="user_settings",
                    resource_id=str(
                        updated_settings.id
                    ),
                    metadata={
                        "changed_fields": (
                            changed_fields
                        ),
                    },
                )

            except Exception as exc:

                print(
                    "[AUDIT SETTINGS UPDATE ERROR]",
                    exc,
                )

        return Response(
            {
                "message": (
                    "Settings updated successfully."
                ),

                "settings": UserSettingsSerializer(
                    updated_settings
                ).data,
            },

            status=status.HTTP_200_OK,
        )


# ============================================================
# AUDIT LOGS
# ============================================================

class AuditLogListView(APIView):
    """
    ADMIN + MANAGER can view application audit logs.

    USER cannot access audit logs.

    Optional query parameters:

        ?action=PROFILE_UPDATED

        ?resource=user

        ?user_id=1
    """

    permission_classes = [
        IsUserManagementRole
    ]

    def get(
        self,
        request,
    ):

        queryset = (
            AuditLog.objects
            .select_related("user")
            .order_by("-timestamp")
        )

        # ------------------------------------------------------
        # FILTER BY ACTION
        # ------------------------------------------------------

        action = (
            request.query_params
            .get(
                "action"
            )
        )

        if action:

            queryset = queryset.filter(
                action=action.strip()
            )

        # ------------------------------------------------------
        # FILTER BY RESOURCE
        # ------------------------------------------------------

        resource = (
            request.query_params
            .get(
                "resource"
            )
        )

        if resource:

            queryset = queryset.filter(
                resource=resource.strip()
            )

        # ------------------------------------------------------
        # FILTER BY USER
        # ------------------------------------------------------

        user_id = (
            request.query_params
            .get(
                "user_id"
            )
        )

        if user_id:

            try:

                queryset = queryset.filter(
                    user_id=int(
                        user_id
                    )
                )

            except (
                TypeError,
                ValueError,
            ):

                return Response(
                    {
                        "error": (
                            "user_id must be a valid "
                            "integer."
                        )
                    },

                    status=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                )

        # ------------------------------------------------------
        # LIMIT RESULT SIZE
        #
        # This keeps the first version lightweight.
        # Pagination can be added later.
        # ------------------------------------------------------

        try:

            limit = int(
                request.query_params.get(
                    "limit",
                    100,
                )
            )

        except (
            TypeError,
            ValueError,
        ):

            limit = 100

        limit = max(
            1,
            min(
                limit,
                500,
            )
        )

        logs = queryset[:limit]

        # ------------------------------------------------------
        # SAFE RESPONSE
        # ------------------------------------------------------

        data = []

        for log in logs:

            data.append(
                {
                    "id": log.id,

                    "action": (
                        log.action
                    ),

                    "resource": (
                        log.resource
                    ),

                    "resource_id": (
                        log.resource_id
                    ),

                    "timestamp": (
                        log.timestamp
                    ),

                    "ip_address": (
                        log.ip_address
                    ),

                    "user": (
                        {
                            "id": (
                                log.user.id
                                if log.user
                                else None
                            ),

                            "username": (
                                log.user.username
                                if log.user
                                else None
                            ),

                            "role": (
                                log.user.role
                                if log.user
                                else None
                            ),
                        }
                    ),

                    "metadata": (
                        AuditService.sanitize_metadata(
                            log.metadata
                            or {}
                        )
                    ),
                }
            )

        return Response(
            data,
            status=status.HTTP_200_OK,
        )

    # ----------------------------------------------------------
    # DELETE AUDIT LOG
    #
    # ADMIN ONLY
    #
    # Example:
    #
    # DELETE /api/auth/audit-logs/?id=123
    #
    # MANAGER can view audit logs but cannot delete them.
    # USER cannot access audit logs at all.
    # ----------------------------------------------------------

    def delete(
        self,
        request,
    ):

        # ------------------------------------------------------
        # ADMIN ONLY
        # ------------------------------------------------------

        if (
            request.user.role
            != User.Role.ADMIN
        ):

            return Response(
                {
                    "error": (
                        "Only administrators can "
                        "delete audit logs."
                    ),
                    "code": (
                        "AUDIT_DELETE_FORBIDDEN"
                    ),
                },

                status=status.HTTP_403_FORBIDDEN,
            )

        # ------------------------------------------------------
        # GET AUDIT LOG ID
        # ------------------------------------------------------

        audit_log_id = (
            request.query_params
            .get("id")
        )

        if not audit_log_id:

            return Response(
                {
                    "error": (
                        "Audit log id is required."
                    ),
                    "field": "id",
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        # ------------------------------------------------------
        # VALIDATE ID
        # ------------------------------------------------------

        try:

            audit_log_id = int(
                audit_log_id
            )

        except (
            TypeError,
            ValueError,
        ):

            return Response(
                {
                    "error": (
                        "Audit log id must be "
                        "a valid integer."
                    ),
                    "field": "id",
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        # ------------------------------------------------------
        # FIND AUDIT LOG
        # ------------------------------------------------------

        try:

            audit_log = AuditLog.objects.get(
                pk=audit_log_id
            )

        except AuditLog.DoesNotExist:

            return Response(
                {
                    "error": (
                        "Audit log not found."
                    ),
                    "code": (
                        "AUDIT_LOG_NOT_FOUND"
                    ),
                },

                status=status.HTTP_404_NOT_FOUND,
            )

        # ------------------------------------------------------
        # DELETE
        #
        # IMPORTANT:
        # We intentionally do NOT create another audit entry
        # for deleting an audit entry. Otherwise the audit trail
        # could become self-referential and confusing.
        # ------------------------------------------------------

        deleted_id = audit_log.id

        audit_log.delete()

        return Response(
            {
                "message": (
                    "Audit log deleted successfully."
                ),
                "deleted_id": deleted_id,
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
        # AUDIT SIGNUP
        # ------------------------------------------------------

        try:

            AuditService.log(
                request=request,
                user=user,
                action="USER_SIGNUP",
                resource="user",
                resource_id=str(
                    user.id
                ),
                metadata={
                    "username": user.username,
                    "role": user.role,
                },
            )

        except Exception as exc:

            print(
                "[AUDIT SIGNUP ERROR]",
                exc,
            )

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

            # --------------------------------------------------
            # AUDIT LOGOUT
            # --------------------------------------------------

            try:

                AuditService.log(
                    request=request,
                    user=request.user,
                    action="USER_LOGOUT",
                    resource="authentication",
                    resource_id=str(
                        request.user.id
                    ),
                    metadata={
                        "username": (
                            request.user.username
                        ),
                    },
                )

            except Exception as exc:

                print(
                    "[AUDIT LOGOUT ERROR]",
                    exc,
                )

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
# SIGN OUT ALL SESSIONS
# ============================================================

class SignOutAllSessionsView(APIView):
    """Invalidate every refresh token owned by the authenticated user.

    Access tokens remain valid only until their short configured expiry.  The
    client clears its local credentials immediately after this endpoint
    succeeds, while all other devices lose the ability to refresh sessions.
    """

    permission_classes = [
        IsAuthenticated
    ]

    def post(
        self,
        request,
    ):
        revoked = 0

        for token in OutstandingToken.objects.filter(
            user=request.user
        ):
            _, created = BlacklistedToken.objects.get_or_create(
                token=token
            )

            if created:
                revoked += 1

        try:
            AuditService.log(
                request=request,
                user=request.user,
                action="USER_SESSIONS_REVOKED",
                resource="authentication",
                resource_id=str(request.user.id),
                metadata={
                    "revoked_refresh_tokens": revoked,
                },
            )
        except Exception as exc:
            print(
                "[AUDIT SESSION REVOKE ERROR]",
                exc,
            )

        return Response(
            {
                "message": "All active sessions were signed out.",
                "revoked_refresh_tokens": revoked,
            },
            status=status.HTTP_200_OK,
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
        # AUDIT PASSWORD RESET
        # ------------------------------------------------------

        try:

            AuditService.log(
                request=request,
                user=user,
                action="PASSWORD_RESET",
                resource="user",
                resource_id=str(
                    user.id
                ),
                metadata={},
            )

        except Exception as exc:

            print(
                "[AUDIT PASSWORD RESET ERROR]",
                exc,
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
        # AUDIT USER CREATION
        # ------------------------------------------------------

        try:

            AuditService.log(
                request=request,
                user=request.user,
                action="USER_CREATED",
                resource="user",
                resource_id=str(
                    user.id
                ),
                metadata={
                    "created_username": (
                        user.username
                    ),
                    "created_role": (
                        user.role
                    ),
                },
            )

        except Exception as exc:

            print(
                "[AUDIT USER CREATE ERROR]",
                exc,
            )

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

        # ------------------------------------------------------
        # CAPTURE ORIGINAL VALUES
        # ------------------------------------------------------

        original_values = {
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "is_active": user.is_active,
        }

        serializer = AdminUserUpdateSerializer(
            user,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        updated_user = serializer.save()

        # ------------------------------------------------------
        # DETERMINE CHANGES
        # ------------------------------------------------------

        changed_fields = []

        for field in original_values:

            old_value = original_values.get(
                field
            )

            new_value = getattr(
                updated_user,
                field,
            )

            if old_value != new_value:

                changed_fields.append(
                    field
                )

        # ------------------------------------------------------
        # AUDIT USER UPDATE
        # ------------------------------------------------------

        if changed_fields:

            try:

                AuditService.log(
                    request=request,
                    user=request.user,
                    action="USER_UPDATED",
                    resource="user",
                    resource_id=str(
                        updated_user.id
                    ),
                    metadata={
                        "changed_fields": (
                            changed_fields
                        ),
                    },
                )

            except Exception as exc:

                print(
                    "[AUDIT USER UPDATE ERROR]",
                    exc,
                )

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