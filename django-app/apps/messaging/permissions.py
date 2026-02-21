from rest_framework import permissions

class IsModeratorOrAdmin(permissions.BasePermission):
    """
    Allows access only to users with 'moderator' or 'admin' roles.
    """

    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.role in ['moderator', 'admin'] or request.user.is_superuser)
        )
