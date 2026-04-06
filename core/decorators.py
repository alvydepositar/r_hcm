from functools import wraps

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied

from core.rbac import (
    can_access_approval_queue,
    can_access_employee_portal,
    can_access_hr_portal,
    can_access_recruitment,
    can_access_recruitment_requestor,
)


def hr_portal_required(view_func):
    @login_required
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not can_access_hr_portal(request.user):
            raise PermissionDenied("You do not have access to the HR portal.")
        return view_func(request, *args, **kwargs)

    return _wrapped


def employee_portal_required(view_func):
    @login_required
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not can_access_employee_portal(request.user):
            raise PermissionDenied("You do not have access to the employee portal.")
        return view_func(request, *args, **kwargs)

    return _wrapped


def approver_portal_required(view_func):
    @login_required
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not can_access_approval_queue(request.user):
            raise PermissionDenied("You do not have access to the approver queue.")
        return view_func(request, *args, **kwargs)

    return _wrapped


def recruitment_portal_required(view_func):
    @login_required
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not can_access_recruitment(request.user):
            raise PermissionDenied("You do not have access to the recruitment workspace.")
        return view_func(request, *args, **kwargs)

    return _wrapped


def recruitment_requestor_required(view_func):
    @login_required
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not can_access_recruitment_requestor(request.user):
            raise PermissionDenied("You do not have access to the requestor recruitment portal.")
        return view_func(request, *args, **kwargs)

    return _wrapped
