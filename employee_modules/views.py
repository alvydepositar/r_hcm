from django.shortcuts import render

from core.approval_workflow import build_leave_approval_plan
from core.decorators import approver_portal_required, employee_portal_required
from core.models import LeaveApplicationApproval
from core.rbac import get_user_employee


def _serialize_leave_approver_plan(employee):
    if employee is None:
        return []

    serialized_plan = []
    for step in build_leave_approval_plan(employee):
        approver = step["approver_employee"]
        role = LeaveApplicationApproval.ApprovalRole(step["approver_role"])
        serialized_plan.append(
            {
                "role_code": role.value,
                "role_label": role.label,
                "employee_id": approver.employee_id,
                "full_name": f"{approver.first_name} {approver.last_name}",
                "position_name": getattr(approver.position, "position_name", "") or "Position not set",
                "division_name": getattr(approver.division, "division_name", "") or "Division not set",
            }
        )

    return serialized_plan


@employee_portal_required
def employee_leave_portal(request):
    employee = get_user_employee(request.user)
    return render(
        request,
        "employee_portal/leave_portal.html",
        {
            "portal_approvers": _serialize_leave_approver_plan(employee),
        },
    )


@employee_portal_required
def employee_leave_history(request):
    return render(request, "employee_portal/leave_history.html")


@approver_portal_required
def employee_leave_approval_queue(request):
    return render(request, "employee_portal/leave_approval_queue.html")
