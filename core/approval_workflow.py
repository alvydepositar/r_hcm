from django.db import transaction
from django.utils import timezone

from core.models import LeaveApplication, LeaveApplicationApproval
from hr_modules.models import Approver


APPROVAL_STEP_DEFINITIONS = (
    (
        LeaveApplicationApproval.ApprovalRole.IMMEDIATE_SUPERVISOR,
        "immediate_supervisor",
        "alt_supervisor",
    ),
    (
        LeaveApplicationApproval.ApprovalRole.DIVISION_CHIEF,
        "division_chief",
        "alt_division_chief",
    ),
    (
        LeaveApplicationApproval.ApprovalRole.HR_APPROVER,
        "hr_approver",
        "alt_hr_approver",
    ),
)


def get_applicable_approver_config(employee):
    if employee is None:
        return None

    return (
        Approver.objects.select_related(
            "division_id",
            "employee_id",
            "immediate_supervisor",
            "alt_supervisor",
            "division_chief",
            "alt_division_chief",
            "hr_approver",
            "alt_hr_approver",
        )
        .filter(approval_type=Approver.ApprovalType.EMPLOYEE, employee_id=employee)
        .first()
        or Approver.objects.select_related(
            "division_id",
            "employee_id",
            "immediate_supervisor",
            "alt_supervisor",
            "division_chief",
            "alt_division_chief",
            "hr_approver",
            "alt_hr_approver",
        )
        .filter(approval_type=Approver.ApprovalType.DIVISION, division_id=employee.division)
        .first()
    )


def build_leave_approval_plan(employee):
    config = get_applicable_approver_config(employee)
    if config is None:
        return []

    plan = []
    for sequence, (role_code, primary_attr, alternate_attr) in enumerate(APPROVAL_STEP_DEFINITIONS, start=1):
        approver_employee = getattr(config, primary_attr) or getattr(config, alternate_attr)
        if approver_employee is None:
            continue

        plan.append(
            {
                "sequence": sequence,
                "approver_role": role_code,
                "approver_employee": approver_employee,
            }
        )

    return plan


def ensure_leave_approval_queue(application):
    if application.status != LeaveApplication.Status.SUBMITTED:
        return

    if application.approvals.exists():
        return

    plan = build_leave_approval_plan(application.employee)
    approvals = []
    for index, step in enumerate(plan):
        approvals.append(
            LeaveApplicationApproval(
                leave_application=application,
                approver_employee=step["approver_employee"],
                approver_role=step["approver_role"],
                sequence=step["sequence"],
                status=(
                    LeaveApplicationApproval.Status.PENDING
                    if index == 0
                    else LeaveApplicationApproval.Status.QUEUED
                ),
            )
        )

    if approvals:
        LeaveApplicationApproval.objects.bulk_create(approvals)


def sync_leave_approval_queue(application):
    if application.status == LeaveApplication.Status.SUBMITTED:
        ensure_leave_approval_queue(application)
        return

    application.approvals.filter(
        status__in=[
            LeaveApplicationApproval.Status.QUEUED,
            LeaveApplicationApproval.Status.PENDING,
        ]
    ).update(status=LeaveApplicationApproval.Status.SKIPPED, modified=timezone.now())


def _set_application_status(application, status_value):
    from core.serializers import LeaveApplicationSerializer

    serializer = LeaveApplicationSerializer(
        instance=application,
        data={"status": status_value},
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()


def approve_leave_approval(approval, decision_notes=""):
    if approval.status != LeaveApplicationApproval.Status.PENDING:
        return approval

    with transaction.atomic():
        approval.status = LeaveApplicationApproval.Status.APPROVED
        approval.decision_notes = decision_notes
        approval.acted_at = timezone.now()
        approval.save(update_fields=["status", "decision_notes", "acted_at", "modified"])

        next_approval = (
            approval.leave_application.approvals.filter(status=LeaveApplicationApproval.Status.QUEUED)
            .order_by("sequence")
            .first()
        )

        if next_approval is not None:
            next_approval.status = LeaveApplicationApproval.Status.PENDING
            next_approval.save(update_fields=["status", "modified"])
        else:
            _set_application_status(approval.leave_application, LeaveApplication.Status.APPROVED)

    approval.refresh_from_db()
    return approval


def reject_leave_approval(approval, decision_notes=""):
    if approval.status != LeaveApplicationApproval.Status.PENDING:
        return approval

    with transaction.atomic():
        approval.status = LeaveApplicationApproval.Status.REJECTED
        approval.decision_notes = decision_notes
        approval.acted_at = timezone.now()
        approval.save(update_fields=["status", "decision_notes", "acted_at", "modified"])

        approval.leave_application.approvals.filter(
            status__in=[
                LeaveApplicationApproval.Status.QUEUED,
                LeaveApplicationApproval.Status.PENDING,
            ]
        ).exclude(pk=approval.pk).update(
            status=LeaveApplicationApproval.Status.SKIPPED,
            modified=timezone.now(),
        )

        _set_application_status(approval.leave_application, LeaveApplication.Status.REJECTED)

    approval.refresh_from_db()
    return approval
