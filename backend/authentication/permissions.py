from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """
    Allows access only to users with ADMIN role.
    """

    message = (
        "Administrator access is required."
    )

    def has_permission(
        self,
        request,
        view,
    ):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role
            == request.user.Role.ADMIN
        )


class IsManagerOrAdmin(BasePermission):
    """
    Allows ADMIN and MANAGER users.
    """

    message = (
        "Manager or Administrator access is required."
    )

    def has_permission(
        self,
        request,
        view,
    ):
        if not (
            request.user
            and request.user.is_authenticated
        ):
            return False

        return request.user.role in {
            request.user.Role.ADMIN,
            request.user.Role.MANAGER,
        }


class IsAuthenticatedUser(BasePermission):
    """
    Allows any authenticated application user.
    """

    def has_permission(
        self,
        request,
        view,
    ):
        return bool(
            request.user
            and request.user.is_authenticated
        )