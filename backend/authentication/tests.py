from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


class SignOutAllSessionsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="session-user",
            email="session-user@example.com",
            password="secure-password-123",
        )
        self.client.force_authenticate(self.user)

    def test_sign_out_all_sessions_blacklists_each_refresh_token(self):
        RefreshToken.for_user(self.user)
        RefreshToken.for_user(self.user)

        response = self.client.post(
            reverse("signout-all-sessions")
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["revoked_refresh_tokens"],
            2,
        )
        self.assertEqual(
            BlacklistedToken.objects.filter(
                token__user=self.user
            ).count(),
            2,
        )

    def test_sign_out_all_sessions_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            reverse("signout-all-sessions")
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
