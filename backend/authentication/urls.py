from django.urls import path

from rest_framework_simplejwt.views import (
    TokenRefreshView,
)

from .views import (
    LoginView,
    SignupView,
    LogoutView,
    MeView,
    UserManagementListView,
    UserManagementDetailView,
)


urlpatterns = [

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