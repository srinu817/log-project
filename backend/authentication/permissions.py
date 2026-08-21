from rest_framework.permissions import BasePermission


# ============================================================
# ADMIN
# ============================================================

class IsAdmin(BasePermission):
    """
    ADMIN only.
    """

    message = (
        "Administrator access is required."
    )

    def has_permission(
        self,
        request,
        view,
    ):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role
            == request.user.Role.ADMIN
        )


# ============================================================
# ADMIN OR MANAGER
# ============================================================

class IsManagerOrAdmin(BasePermission):
    """
    ADMIN + MANAGER.

    Used for operations such as:
        - user management
        - repository deactivation
        - global repository management
        - global delivery history
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


# ============================================================
# AUTHENTICATED APPLICATION USER
# ============================================================

class IsAuthenticatedUser(BasePermission):
    """
    Any authenticated application user.

    ADMIN
    MANAGER
    USER
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


# ============================================================
# REPOSITORY / DELIVERY OPERATOR
# ============================================================

class IsRepositoryOperator(BasePermission):
    """
    Allows authenticated application users to access
    repository and delivery endpoints.

    IMPORTANT:

    This permission only checks that the user has a valid
    application role.

    Object-level restrictions are handled inside the
    corresponding views.

    ADMIN:
        Full repository and delivery access.

    MANAGER:
        Global repository and delivery access.

    USER:
        Repository and delivery access only for repositories
        created by that user.
    """

    message = (
        "You do not have permission to perform "
        "this repository or delivery operation."
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
            request.user.Role.USER,
        }


# ============================================================
# USER MANAGEMENT
# ============================================================

class IsUserManagementRole(BasePermission):
    """
    ADMIN + MANAGER.

    ADMIN:
        Full user management.

    MANAGER:
        View users
        Create users
        Edit users

    ADMIN-only activation/deactivation must be checked
    separately by the user-management view.
    """

    message = (
        "Administrator or Manager access is required."
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


# ============================================================
# ANY APPLICATION ROLE
# ============================================================

class IsAnyApplicationRole(BasePermission):
    """
    Explicit application-role validation.

    Kept separate from IsAuthenticatedUser for endpoints
    that specifically require one of our application roles.
    """

    message = (
        "A valid application role is required."
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
            request.user.Role.USER,
        }