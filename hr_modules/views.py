from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import render

from core.decorators import hr_portal_required, recruitment_requestor_required
from core.models import (
    CSCPlantilla,
    Division,
    EmployeeLeaveCredit,
    HiringRequest,
    HiringRequestApproval,
    JobPosting,
    JobPostingApproval,
    LeaveApplication,
    Position,
)
from core.rbac import (
    ROLE_HR,
    can_access_hr_portal,
    has_recruitment_access,
    is_division_chief_approver_user,
)
from employee_modules.models import Employee

User = get_user_model()

# Dashboard Views
@hr_portal_required
def employee_management(request):
    total_employees = Employee.objects.count()
    division_groups = Division.objects.count()
    
    context = {
        'total_employees': total_employees,
        'division_groups': division_groups,
    }
    return render(request, 'employee_management.html', context)

@hr_portal_required
def leave_management(request):
    total_leave_requests = LeaveApplication.objects.count()
    approved_leaves = LeaveApplication.objects.filter(status=LeaveApplication.Status.APPROVED).count()
    pending_leaves = LeaveApplication.objects.filter(status=LeaveApplication.Status.SUBMITTED).count()
    leave_credit_records = EmployeeLeaveCredit.objects.count()

    context = {
        'total_leave_requests': total_leave_requests,
        'approved_leaves': approved_leaves,
        'pending_leaves': pending_leaves,
        'leave_credit_records': leave_credit_records,
    }
    return render(request, 'leave_management.html', context)


def _get_recruitment_scope(user):
    hiring_requests = HiringRequest.objects.all()
    hiring_request_approvals = HiringRequestApproval.objects.all()
    job_postings = JobPosting.objects.all()
    job_posting_approvals = JobPostingApproval.objects.all()

    if can_access_hr_portal(user):
        return (
            hiring_requests,
            hiring_request_approvals,
            job_postings,
            job_posting_approvals,
        )

    return (
        hiring_requests.filter(
            Q(requestor_user=user) | Q(approvals__approver_user=user)
        ).distinct(),
        hiring_request_approvals.filter(approver_user=user),
        job_postings.filter(
            Q(requestor_user=user) | Q(approvals__approver_user=user)
        ).distinct(),
        job_posting_approvals.filter(approver_user=user),
    )


def _get_available_recruitment_requestor_roles(user):
    if user.is_superuser:
        return [
            {
                "id": HiringRequest.RequestorRole.IT_MANAGER,
                "label": HiringRequest.RequestorRole.IT_MANAGER.label,
            },
            {
                "id": HiringRequest.RequestorRole.DIVISION_CHIEF,
                "label": HiringRequest.RequestorRole.DIVISION_CHIEF.label,
            },
        ]

    if not has_recruitment_access(user):
        return []

    if is_division_chief_approver_user(user):
        return [
            {
                "id": HiringRequest.RequestorRole.DIVISION_CHIEF,
                "label": HiringRequest.RequestorRole.DIVISION_CHIEF.label,
            },
        ]

    return [
        {
            "id": HiringRequest.RequestorRole.IT_MANAGER,
            "label": HiringRequest.RequestorRole.IT_MANAGER.label,
        },
    ]


def _build_recruitment_lookup_options():
    divisions = Division.objects.order_by("division_name")
    positions = Position.objects.select_related("standard_salary_grade").order_by("position_name")
    plantilla_items = CSCPlantilla.objects.select_related("division", "position").order_by("item_number")

    return {
        "divisions": [
            {
                "id": division.division_id,
                "name": division.division_name,
                "abbreviation": division.division_abbreviation or "",
            }
            for division in divisions
        ],
        "positions": [
            {
                "id": position.position_id,
                "name": position.position_name,
                "salary_grade": (
                    position.standard_salary_grade.csc_grade
                    if position.standard_salary_grade_id
                    else None
                ),
            }
            for position in positions
        ],
        "plantilla_items": [
            {
                "id": plantilla_item.plantilla_id,
                "item_number": plantilla_item.item_number,
                "position_id": plantilla_item.position_id,
                "position_name": plantilla_item.position.position_name,
                "division_id": plantilla_item.division_id,
                "division_name": plantilla_item.division.division_name,
                "availability_status": plantilla_item.availability_status,
                "availability_label": plantilla_item.get_availability_status_display(),
            }
            for plantilla_item in plantilla_items
        ],
    }


@hr_portal_required
def recruitment_management(request):
    hiring_requests, hiring_request_approvals, job_postings, job_posting_approvals = _get_recruitment_scope(
        request.user
    )
    available_requestor_roles = _get_available_recruitment_requestor_roles(request.user)

    context = {
        "total_hiring_requests": hiring_requests.count(),
        "pending_hiring_approvals": hiring_request_approvals.filter(
            status=HiringRequestApproval.Status.PENDING
        ).count(),
        "total_job_postings": job_postings.count(),
        "live_job_postings": job_postings.filter(status=JobPosting.Status.PUBLISHED).count(),
        "can_create_hiring_requests": bool(available_requestor_roles),
        "can_manage_job_postings": can_access_hr_portal(request.user),
        "recruitment_permissions": {
            "username": request.user.username,
            "is_hr": can_access_hr_portal(request.user),
            "can_create_hiring_requests": bool(available_requestor_roles),
            "can_manage_job_postings": can_access_hr_portal(request.user),
            "available_requestor_roles": available_requestor_roles,
        },
        "recruitment_options": _build_recruitment_lookup_options(),
    }

    return render(request, "recruitment_management.html", context)


@recruitment_requestor_required
def recruitment_requestor_portal(request):
    available_requestor_roles = _get_available_recruitment_requestor_roles(request.user)

    my_hiring_requests = HiringRequest.objects.filter(requestor_user=request.user)
    my_hiring_request_approvals = HiringRequestApproval.objects.filter(approver_user=request.user)
    my_job_postings = JobPosting.objects.filter(requestor_user=request.user)
    my_job_posting_approvals = JobPostingApproval.objects.filter(approver_user=request.user)

    context = {
        "my_hiring_request_count": my_hiring_requests.count(),
        "pending_hiring_request_approval_count": my_hiring_request_approvals.filter(
            status=HiringRequestApproval.Status.PENDING
        ).count(),
        "my_job_posting_count": my_job_postings.count(),
        "pending_job_posting_review_count": my_job_posting_approvals.filter(
            status=JobPostingApproval.Status.PENDING
        ).count(),
        "requestor_recruitment_permissions": {
            "username": request.user.username,
            "can_create_hiring_requests": bool(available_requestor_roles),
            "available_requestor_roles": available_requestor_roles,
        },
        "recruitment_options": _build_recruitment_lookup_options(),
    }

    return render(request, "employee_portal/recruitment_portal.html", context)


@hr_portal_required
def access_rights(request):
    context = {
        "account_count": User.objects.count(),
        "hr_account_count": User.objects.filter(
            Q(is_superuser=True) | Q(groups__name=ROLE_HR)
        ).distinct().count(),
        "employee_account_count": Employee.objects.exclude(user=None).count(),
        "active_account_count": User.objects.filter(is_active=True).count(),
    }
    return render(request, 'security/access_rights.html', context)

@hr_portal_required
def oba_management(request):
    return render(request, 'oba_management.html')

@hr_portal_required
def cc_management(request):
    return render(request, 'cc_management.html')

# Employee Views
@hr_portal_required
def employee_info(request):
    return render(request, 'employee/employee_info.html')

@hr_portal_required
def personal_data_sheet(request):
    return render(request, 'employee/personal_data_sheet.html')


@hr_portal_required
def leave_types(request):
    return render(request, 'leave/leave_types.html')


@hr_portal_required
def employee_leave_credits(request):
    return render(request, 'leave/employee_leave_credits.html')


@hr_portal_required
def leave_applications(request):
    return render(request, 'leave/leave_applications.html')

# Core Views
@hr_portal_required
def divisions(request):
    return render(request, 'employee/divisions.html')

@hr_portal_required
def positions(request):
    return render(request, 'employee/positions.html')

@hr_portal_required
def time_rules(request):
    return render(request, 'employee/time_rules.html')

@hr_portal_required
def salary_grades(request):
    return render(request, 'employee/salary_grades.html')

@hr_portal_required
def csc_plantilla(request):
    return render(request, 'employee/csc_plantilla.html')

@hr_portal_required
def approvers(request):
    context = {
        'divisions': Division.objects.order_by('division_name'),
        'employees': Employee.objects.order_by('first_name', 'last_name'),
    }
    return render(request, 'employee/approvers.html', context)
