from rest_framework.permissions import SAFE_METHODS, BasePermission

from core.rbac import can_access_hr_portal


class IsAuthenticatedAndHR(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and can_access_hr_portal(request.user))


class IsAuthenticatedAndHROrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        return can_access_hr_portal(request.user)
