from core.rbac import (
    can_access_approval_queue,
    can_access_employee_portal,
    can_access_hr_portal,
    can_access_recruitment,
    can_access_recruitment_requestor,
    get_role_names,
    get_user_employee,
    resolve_portal_mode,
)


def portal_access(request):
    user = request.user
    employee = get_user_employee(user)
    portal_mode = resolve_portal_mode(request) if getattr(user, "is_authenticated", False) else None
    resolver_match = getattr(request, "resolver_match", None)
    current_route_name = getattr(resolver_match, "url_name", "") if resolver_match else ""
    is_recruitment_portal = current_route_name in {
        "recruitment_management",
        "recruitment_requestor_portal",
    }

    employee_data = None
    if employee is not None:
        employee_data = {
            "id": employee.pk,
            "employee_id": employee.employee_id,
            "first_name": employee.first_name,
            "last_name": employee.last_name,
            "middle_name": employee.middle_name or "",
            "name_extension": employee.name_extension or "",
            "position_name": getattr(employee.position, "position_name", ""),
            "division_name": getattr(employee.division, "division_name", ""),
        }

    return {
        "portal_mode": portal_mode,
        "is_recruitment_portal": is_recruitment_portal,
        "can_access_hr_portal": can_access_hr_portal(user),
        "can_access_employee_portal": can_access_employee_portal(user),
        "can_access_approval_queue": can_access_approval_queue(user),
        "can_access_recruitment": can_access_recruitment(user),
        "can_access_recruitment_requestor": can_access_recruitment_requestor(user),
        "current_employee": employee,
        "portal_role_names": get_role_names(user),
        "portal_context_data": {
            "portal_mode": portal_mode,
            "is_recruitment_portal": is_recruitment_portal,
            "can_access_hr_portal": can_access_hr_portal(user),
            "can_access_employee_portal": can_access_employee_portal(user),
            "can_access_approval_queue": can_access_approval_queue(user),
            "can_access_recruitment": can_access_recruitment(user),
            "can_access_recruitment_requestor": can_access_recruitment_requestor(user),
            "employee": employee_data,
            "roles": get_role_names(user),
            "username": getattr(user, "username", ""),
        },
    }
