from django.db.models import Q

from hr_modules.models import Approver


ROLE_HR = "HR"
ROLE_EMPLOYEE = "Employee"
ROLE_APPROVER = "Approver"

PORTAL_HR = "hr"
PORTAL_EMPLOYEE = "employee"
PORTAL_SESSION_KEY = "hcm_portal_mode"


def get_user_employee(user):
    if not getattr(user, "is_authenticated", False):
        return None

    return getattr(user, "employee_profile", None)


def is_hr_user(user):
    return bool(
        getattr(user, "is_authenticated", False)
        and (user.is_superuser or user.groups.filter(name=ROLE_HR).exists())
    )


def is_employee_user(user):
    return get_user_employee(user) is not None


def is_approver_employee(employee):
    if employee is None:
        return False

    return Approver.objects.filter(
        Q(immediate_supervisor=employee)
        | Q(alt_supervisor=employee)
        | Q(division_chief=employee)
        | Q(alt_division_chief=employee)
        | Q(hr_approver=employee)
        | Q(alt_hr_approver=employee)
    ).exists()


def is_approver_user(user):
    return is_approver_employee(get_user_employee(user))


def can_access_hr_portal(user):
    return is_hr_user(user)


def can_access_employee_portal(user):
    return is_employee_user(user)


def can_access_approval_queue(user):
    return is_approver_user(user)


def get_role_names(user):
    roles = []

    if is_hr_user(user):
        roles.append(ROLE_HR)

    if is_employee_user(user):
        roles.append(ROLE_EMPLOYEE)

    if is_approver_user(user):
        roles.append(ROLE_APPROVER)

    return roles


def _get_requested_portal_mode(request):
    requested_portal = request.GET.get("portal")
    if requested_portal in {PORTAL_HR, PORTAL_EMPLOYEE}:
        return requested_portal

    request_path = (
        getattr(request, "path_info", None)
        or getattr(request, "path", "")
        or ""
    ).lower()

    if request_path.startswith("/employee/"):
        return PORTAL_EMPLOYEE

    if request_path.startswith("/hr/"):
        return PORTAL_HR

    session = getattr(request, "session", None)
    if session is not None:
        stored_portal = session.get(PORTAL_SESSION_KEY)
        if stored_portal in {PORTAL_HR, PORTAL_EMPLOYEE}:
            return stored_portal

    return None


def resolve_portal_mode(request):
    user = request.user
    requested_portal = _get_requested_portal_mode(request)

    resolved_portal = PORTAL_HR

    if can_access_hr_portal(user):
        if requested_portal == PORTAL_EMPLOYEE and can_access_employee_portal(user):
            resolved_portal = PORTAL_EMPLOYEE
        else:
            resolved_portal = PORTAL_HR
    elif can_access_employee_portal(user):
        resolved_portal = PORTAL_EMPLOYEE

    session = getattr(request, "session", None)
    if session is not None and session.get(PORTAL_SESSION_KEY) != resolved_portal:
        session[PORTAL_SESSION_KEY] = resolved_portal

    return resolved_portal
