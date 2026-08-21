from django.urls import path

from rest_framework_simplejwt.views import (
    TokenRefreshView,
)

from .views import (
    LoginView,
    SignupView,
    LogoutView,
    MeView,
    ForgotPasswordView,
    ResetPasswordView,
    UserManagementListView,
    UserManagementDetailView,
)


urlpatterns = [

    # ============================================================
    # PUBLIC AUTHENTICATION
    # ============================================================

    path(
        "signup/",
        SignupView.as_view(),
        name="signup",
    ),

    path(
        "login/",
        LoginView.as_view(),
        name="login",
    ),

    path(
        "refresh/",
        TokenRefreshView.as_view(),
        name="token-refresh",
    ),

    # ============================================================
    # PASSWORD RESET
    # ============================================================

    path(
        "forgot-password/",
        ForgotPasswordView.as_view(),
        name="forgot-password",
    ),

    path(
        "reset-password/<uid>/<token>/",
        ResetPasswordView.as_view(),
        name="reset-password",
    ),

    # ============================================================
    # AUTHENTICATED USER
    # ============================================================

    path(
        "logout/",
        LogoutView.as_view(),
        name="logout",
    ),

    path(
        "me/",
        MeView.as_view(),
        name="me",
    ),

    # ============================================================
    # ADMIN USER MANAGEMENT
    # ============================================================

    path(
        "users/",
        UserManagementListView.as_view(),
        name="user-management-list",
    ),

    path(
        "users/<int:user_id>/",
        UserManagementDetailView.as_view(),
        name="user-management-detail",
    ),
]