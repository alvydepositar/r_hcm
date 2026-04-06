from django.db import transaction
from django.utils import timezone

from core.models import (
    HiringRequest,
    HiringRequestApproval,
    JobPosting,
    JobPostingApproval,
)
from core.rbac import (
    get_user_employee,
    has_recruitment_access,
    is_division_chief_approver_user,
)
from hr_modules.models import Approver


def _resolve_division_approver_config(division):
    if division is None:
        return None

    return (
        Approver.objects.select_related(
            "division_id",
            "division_chief__user",
            "alt_division_chief__user",
            "hr_approver__user",
            "alt_hr_approver__user",
        )
        .filter(approval_type=Approver.ApprovalType.DIVISION, division_id=division)
        .first()
    )


def _resolve_config_user(config, primary_attr, alternate_attr=None):
    primary_employee = getattr(config, primary_attr, None)
    if primary_employee and primary_employee.user_id:
        return primary_employee.user

    if alternate_attr:
        alternate_employee = getattr(config, alternate_attr, None)
        if alternate_employee and alternate_employee.user_id:
            return alternate_employee.user

    return None


def resolve_hiring_requestor_role(user, requested_role=None):
    available_roles = []

    if user.is_superuser:
        available_roles = [
            HiringRequest.RequestorRole.IT_MANAGER,
            HiringRequest.RequestorRole.DIVISION_CHIEF,
        ]
    elif has_recruitment_access(user):
        if is_division_chief_approver_user(user):
            available_roles.append(HiringRequest.RequestorRole.DIVISION_CHIEF)
        else:
            available_roles.append(HiringRequest.RequestorRole.IT_MANAGER)

    if requested_role:
        if requested_role not in available_roles:
            raise ValueError("The current user does not have the requested recruitment role.")
        return requested_role

    if len(available_roles) == 1:
        return available_roles[0]

    if not available_roles:
        raise ValueError("The current user is not allowed to create hiring requests.")

    raise ValueError("Specify the recruitment requestor role explicitly for this account.")


def validate_hiring_request_route(*, user, requestor_role, division):
    config = _resolve_division_approver_config(division)
    if config is None:
        raise ValueError("No division approval route is configured for the selected division.")

    division_chief_user = _resolve_config_user(config, "division_chief", "alt_division_chief")
    hr_user = _resolve_config_user(config, "hr_approver", "alt_hr_approver")

    if hr_user is None:
        raise ValueError("No HR approver user is linked to the selected division.")

    if requestor_role == HiringRequest.RequestorRole.IT_MANAGER:
        if division_chief_user is None:
            raise ValueError("No division chief user is linked to the selected division.")
        return

    requestor_employee = get_user_employee(user)
    valid_division_chief_ids = {
        employee.pk
        for employee in [config.division_chief, config.alt_division_chief]
        if employee is not None
    }
    if requestor_employee is None or requestor_employee.pk not in valid_division_chief_ids:
        raise ValueError("Only the configured division chief for the selected division can file this request.")


def build_hiring_request_approval_plan(hiring_request):
    config = _resolve_division_approver_config(hiring_request.division)
    if config is None:
        return []

    plan = []
    if hiring_request.requestor_role == HiringRequest.RequestorRole.IT_MANAGER:
        division_chief_user = _resolve_config_user(config, "division_chief", "alt_division_chief")
        if division_chief_user is None:
            return []
        plan.append(
            {
                "sequence": 1,
                "approver_role": HiringRequestApproval.ApprovalRole.DIVISION_CHIEF,
                "approver_user": division_chief_user,
            }
        )

    hr_user = _resolve_config_user(config, "hr_approver", "alt_hr_approver")
    if hr_user is None:
        return []

    plan.append(
        {
            "sequence": len(plan) + 1,
            "approver_role": HiringRequestApproval.ApprovalRole.HR_APPROVER,
            "approver_user": hr_user,
        }
    )
    return plan


def _create_default_job_posting(hiring_request):
    return JobPosting.objects.create(
        hiring_request=hiring_request,
        requestor_role=hiring_request.requestor_role,
        requestor_user=hiring_request.requestor_user,
        division=hiring_request.division,
        position=hiring_request.position,
        plantilla_item=hiring_request.plantilla_item,
        job_title=hiring_request.position.position_name,
        employment_type=hiring_request.employment_type,
        open_slots=hiring_request.headcount_requested,
        job_summary=hiring_request.hiring_reason,
        portal_status=JobPosting.PortalStatus.HIDDEN,
        created_by=hiring_request.modified_by or hiring_request.created_by,
        modified_by=hiring_request.modified_by or hiring_request.created_by,
    )


def submit_hiring_request(hiring_request):
    plan = build_hiring_request_approval_plan(hiring_request)
    if not plan:
        raise ValueError("No recruitment approval plan could be generated for this request.")

    with transaction.atomic():
        hiring_request.approvals.all().delete()
        approvals = []
        for index, step in enumerate(plan):
            approvals.append(
                HiringRequestApproval(
                    hiring_request=hiring_request,
                    approver_role=step["approver_role"],
                    approver_user=step["approver_user"],
                    sequence=step["sequence"],
                    status=(
                        HiringRequestApproval.Status.PENDING
                        if index == 0
                        else HiringRequestApproval.Status.QUEUED
                    ),
                )
            )

        HiringRequestApproval.objects.bulk_create(approvals)

        hiring_request.status = (
            HiringRequest.Status.PENDING_DIVISION_CHIEF
            if plan[0]["approver_role"] == HiringRequestApproval.ApprovalRole.DIVISION_CHIEF
            else HiringRequest.Status.PENDING_HR
        )
        hiring_request.current_approval_step = plan[0]["approver_role"]
        hiring_request.save(update_fields=["status", "current_approval_step", "modified"])

    hiring_request.refresh_from_db()
    return hiring_request


def cancel_hiring_request(hiring_request):
    with transaction.atomic():
        hiring_request.approvals.filter(
            status__in=[
                HiringRequestApproval.Status.QUEUED,
                HiringRequestApproval.Status.PENDING,
            ]
        ).update(status=HiringRequestApproval.Status.SKIPPED, modified=timezone.now())
        hiring_request.status = HiringRequest.Status.CANCELLED
        hiring_request.current_approval_step = ""
        hiring_request.save(update_fields=["status", "current_approval_step", "modified"])

    hiring_request.refresh_from_db()
    return hiring_request


def approve_hiring_request_approval(approval, decision_notes=""):
    if approval.status != HiringRequestApproval.Status.PENDING:
        return approval

    with transaction.atomic():
        approval.status = HiringRequestApproval.Status.APPROVED
        approval.decision_notes = decision_notes
        approval.acted_at = timezone.now()
        approval.save(update_fields=["status", "decision_notes", "acted_at", "modified"])

        next_approval = (
            approval.hiring_request.approvals.filter(status=HiringRequestApproval.Status.QUEUED)
            .order_by("sequence")
            .first()
        )

        if next_approval is not None:
            next_approval.status = HiringRequestApproval.Status.PENDING
            next_approval.save(update_fields=["status", "modified"])
            approval.hiring_request.status = (
                HiringRequest.Status.PENDING_DIVISION_CHIEF
                if next_approval.approver_role == HiringRequestApproval.ApprovalRole.DIVISION_CHIEF
                else HiringRequest.Status.PENDING_HR
            )
            approval.hiring_request.current_approval_step = next_approval.approver_role
            approval.hiring_request.save(update_fields=["status", "current_approval_step", "modified"])
        else:
            approval.hiring_request.status = HiringRequest.Status.APPROVED
            approval.hiring_request.current_approval_step = ""
            approval.hiring_request.save(update_fields=["status", "current_approval_step", "modified"])

            if not hasattr(approval.hiring_request, "job_posting"):
                _create_default_job_posting(approval.hiring_request)

    approval.refresh_from_db()
    return approval


def reject_hiring_request_approval(approval, decision_notes=""):
    if approval.status != HiringRequestApproval.Status.PENDING:
        return approval

    with transaction.atomic():
        approval.status = HiringRequestApproval.Status.REJECTED
        approval.decision_notes = decision_notes
        approval.acted_at = timezone.now()
        approval.save(update_fields=["status", "decision_notes", "acted_at", "modified"])

        approval.hiring_request.approvals.filter(
            status__in=[
                HiringRequestApproval.Status.QUEUED,
                HiringRequestApproval.Status.PENDING,
            ]
        ).exclude(pk=approval.pk).update(
            status=HiringRequestApproval.Status.SKIPPED,
            modified=timezone.now(),
        )
        approval.hiring_request.status = HiringRequest.Status.REJECTED
        approval.hiring_request.current_approval_step = ""
        approval.hiring_request.save(update_fields=["status", "current_approval_step", "modified"])

    approval.refresh_from_db()
    return approval


def build_job_posting_approval_plan(job_posting):
    config = _resolve_division_approver_config(job_posting.division)
    if config is None:
        return []

    hr_user = _resolve_config_user(config, "hr_approver", "alt_hr_approver")
    if hr_user is None:
        return []

    return [
        {
            "sequence": 1,
            "approver_role": JobPostingApproval.ApprovalRole.REQUESTOR,
            "approver_user": job_posting.requestor_user,
        },
        {
            "sequence": 2,
            "approver_role": JobPostingApproval.ApprovalRole.HR_PUBLISHER,
            "approver_user": hr_user,
        },
    ]


def submit_job_posting_for_requestor_approval(job_posting, acting_hr_user):
    plan = build_job_posting_approval_plan(job_posting)
    if not plan:
        raise ValueError("No job posting approval plan could be generated.")

    with transaction.atomic():
        job_posting.approvals.all().delete()
        approvals = []
        for index, step in enumerate(plan):
            approvals.append(
                JobPostingApproval(
                    job_posting=job_posting,
                    approver_role=step["approver_role"],
                    approver_user=step["approver_user"],
                    sequence=step["sequence"],
                    status=(
                        JobPostingApproval.Status.PENDING
                        if index == 0
                        else JobPostingApproval.Status.QUEUED
                    ),
                )
            )

        JobPostingApproval.objects.bulk_create(approvals)

        job_posting.prepared_by_hr_user = acting_hr_user
        job_posting.status = JobPosting.Status.PENDING_REQUESTOR_APPROVAL
        job_posting.portal_status = JobPosting.PortalStatus.HIDDEN
        job_posting.save(
            update_fields=["prepared_by_hr_user", "status", "portal_status", "modified"]
        )

    job_posting.refresh_from_db()
    return job_posting


def revert_job_posting_to_draft(job_posting):
    with transaction.atomic():
        job_posting.approvals.filter(
            status__in=[
                JobPostingApproval.Status.QUEUED,
                JobPostingApproval.Status.PENDING,
                JobPostingApproval.Status.APPROVED,
            ]
        ).update(status=JobPostingApproval.Status.SKIPPED, modified=timezone.now())
        job_posting.status = JobPosting.Status.DRAFT
        job_posting.portal_status = JobPosting.PortalStatus.HIDDEN
        job_posting.save(update_fields=["status", "portal_status", "modified"])

    job_posting.refresh_from_db()
    return job_posting


def approve_job_posting_approval(approval, decision_notes=""):
    if approval.status != JobPostingApproval.Status.PENDING:
        return approval

    with transaction.atomic():
        approval.status = JobPostingApproval.Status.APPROVED
        approval.decision_notes = decision_notes
        approval.acted_at = timezone.now()
        approval.save(update_fields=["status", "decision_notes", "acted_at", "modified"])

        next_approval = (
            approval.job_posting.approvals.filter(status=JobPostingApproval.Status.QUEUED)
            .order_by("sequence")
            .first()
        )

        if next_approval is not None:
            next_approval.status = JobPostingApproval.Status.PENDING
            next_approval.save(update_fields=["status", "modified"])
            approval.job_posting.status = JobPosting.Status.PENDING_HR_PUBLISH_APPROVAL
            approval.job_posting.save(update_fields=["status", "modified"])
        else:
            approval.job_posting.status = JobPosting.Status.PUBLISHED
            approval.job_posting.portal_status = JobPosting.PortalStatus.PUBLISHED
            if approval.job_posting.publish_start is None:
                approval.job_posting.publish_start = timezone.now()
            approval.job_posting.published_at = timezone.now()
            approval.job_posting.save(
                update_fields=["status", "portal_status", "publish_start", "published_at", "modified"]
            )

    approval.refresh_from_db()
    return approval


def reject_job_posting_approval(approval, decision_notes=""):
    if approval.status != JobPostingApproval.Status.PENDING:
        return approval

    with transaction.atomic():
        approval.status = JobPostingApproval.Status.REJECTED
        approval.decision_notes = decision_notes
        approval.acted_at = timezone.now()
        approval.save(update_fields=["status", "decision_notes", "acted_at", "modified"])

        approval.job_posting.approvals.filter(
            status__in=[
                JobPostingApproval.Status.QUEUED,
                JobPostingApproval.Status.PENDING,
            ]
        ).exclude(pk=approval.pk).update(
            status=JobPostingApproval.Status.SKIPPED,
            modified=timezone.now(),
        )
        approval.job_posting.status = JobPosting.Status.REJECTED
        approval.job_posting.portal_status = JobPosting.PortalStatus.HIDDEN
        approval.job_posting.save(update_fields=["status", "portal_status", "modified"])

    approval.refresh_from_db()
    return approval
