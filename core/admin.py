from django.contrib import admin

from .models import (
    CSCPlantilla,
    Division,
    EmployeeLeaveCredit,
    EmployeeLeaveCreditLedger,
    HiringRequest,
    HiringRequestApproval,
    JobPosting,
    JobPostingApproval,
    LeaveApplication,
    LeaveApplicationApproval,
    LeaveType,
    LeaveTypeRule,
    Position,
    SalaryGrade,
    TimeRule,
)

# Register your models here.
@admin.register(Division)
class DivisionAdmin(admin.ModelAdmin):
    list_display = ('division_id', 'division_name', 'division_abbreviation')
    search_fields = ('division_name',)
    
@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ('position_id', 'position_name', 'standard_salary_grade', 'description')
    search_fields = ('position_name',)
    
@admin.register(TimeRule)
class TimeRuleAdmin(admin.ModelAdmin):
    list_display = ('time_rule_id', 'time_rule_name', 'earliest_in', 'latest_in', 'earliest_out', 'latest_out', 'lunch_start', 'lunch_end', 'lunch_grace_period')
    search_fields = ('time_rule_name',)


@admin.register(SalaryGrade)
class SalaryGradeAdmin(admin.ModelAdmin):
    list_display = ('salary_grade_id', 'csc_grade', 'step_1', 'step_8')
    search_fields = ('=csc_grade',)


@admin.register(CSCPlantilla)
class CSCPlantillaAdmin(admin.ModelAdmin):
    list_display = (
        'plantilla_id',
        'item_number',
        'position',
        'division',
        'salary_grade',
        'salary_step',
        'availability_status',
    )
    search_fields = ('item_number', 'position__position_name', 'division__division_name')


class LeaveTypeRuleInline(admin.StackedInline):
    model = LeaveTypeRule
    extra = 0
    can_delete = False


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = (
        "leave_type_id",
        "leave_code",
        "leave_name",
        "category",
        "is_active",
        "sort_order",
    )
    list_filter = ("category", "is_active", "is_system_seed")
    search_fields = ("leave_code", "leave_name", "legal_basis")
    inlines = (LeaveTypeRuleInline,)


class EmployeeLeaveCreditLedgerInline(admin.TabularInline):
    model = EmployeeLeaveCreditLedger
    extra = 0
    can_delete = False
    readonly_fields = (
        "entry_type",
        "units_delta",
        "balance_after",
        "effective_date",
        "reference_type",
        "reference_id",
        "notes",
        "created",
    )


class LeaveApplicationApprovalInline(admin.TabularInline):
    model = LeaveApplicationApproval
    extra = 0
    can_delete = False
    readonly_fields = (
        "approver_employee",
        "approver_role",
        "sequence",
        "status",
        "decision_notes",
        "acted_at",
        "created",
        "modified",
    )


class HiringRequestApprovalInline(admin.TabularInline):
    model = HiringRequestApproval
    extra = 0
    can_delete = False
    readonly_fields = (
        "approver_user",
        "approver_role",
        "sequence",
        "status",
        "decision_notes",
        "acted_at",
        "created",
        "modified",
    )


class JobPostingApprovalInline(admin.TabularInline):
    model = JobPostingApproval
    extra = 0
    can_delete = False
    readonly_fields = (
        "approver_user",
        "approver_role",
        "sequence",
        "status",
        "decision_notes",
        "acted_at",
        "created",
        "modified",
    )


@admin.register(EmployeeLeaveCredit)
class EmployeeLeaveCreditAdmin(admin.ModelAdmin):
    list_display = (
        "leave_credit_id",
        "employee",
        "bucket_code",
        "bucket_name",
        "current_balance",
        "linked_leave_type",
    )
    list_filter = ("bucket_code",)
    search_fields = (
        "employee__employee_id",
        "employee__first_name",
        "employee__last_name",
        "bucket_code",
        "bucket_name",
    )
    inlines = (EmployeeLeaveCreditLedgerInline,)


@admin.register(LeaveApplication)
class LeaveApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "leave_application_id",
        "employee",
        "leave_type",
        "start_date",
        "end_date",
        "requested_units",
        "status",
        "balance_bucket_code",
    )
    list_filter = ("status", "leave_type__category")
    search_fields = (
        "employee__employee_id",
        "employee__first_name",
        "employee__last_name",
        "leave_type__leave_name",
        "leave_type__leave_code",
    )
    inlines = (LeaveApplicationApprovalInline,)


@admin.register(LeaveApplicationApproval)
class LeaveApplicationApprovalAdmin(admin.ModelAdmin):
    list_display = (
        "leave_application_approval_id",
        "leave_application",
        "approver_employee",
        "approver_role",
        "sequence",
        "status",
        "acted_at",
    )
    list_filter = ("status", "approver_role")
    search_fields = (
        "leave_application__employee__employee_id",
        "leave_application__employee__first_name",
        "leave_application__employee__last_name",
        "approver_employee__employee_id",
        "approver_employee__first_name",
        "approver_employee__last_name",
    )


@admin.register(HiringRequest)
class HiringRequestAdmin(admin.ModelAdmin):
    list_display = (
        "hiring_request_id",
        "request_no",
        "requestor_user",
        "requestor_role",
        "division",
        "position",
        "headcount_requested",
        "status",
        "current_approval_step",
    )
    list_filter = ("status", "requestor_role", "division")
    search_fields = (
        "request_no",
        "requestor_user__username",
        "division__division_name",
        "position__position_name",
    )
    inlines = (HiringRequestApprovalInline,)


@admin.register(HiringRequestApproval)
class HiringRequestApprovalAdmin(admin.ModelAdmin):
    list_display = (
        "hiring_request_approval_id",
        "hiring_request",
        "approver_user",
        "approver_role",
        "sequence",
        "status",
        "acted_at",
    )
    list_filter = ("status", "approver_role")
    search_fields = (
        "hiring_request__request_no",
        "approver_user__username",
    )


@admin.register(JobPosting)
class JobPostingAdmin(admin.ModelAdmin):
    list_display = (
        "job_posting_id",
        "posting_no",
        "job_title",
        "requestor_user",
        "division",
        "position",
        "status",
        "portal_status",
    )
    list_filter = ("status", "portal_status", "division")
    search_fields = (
        "posting_no",
        "job_title",
        "requestor_user__username",
        "division__division_name",
        "position__position_name",
    )
    inlines = (JobPostingApprovalInline,)


@admin.register(JobPostingApproval)
class JobPostingApprovalAdmin(admin.ModelAdmin):
    list_display = (
        "job_posting_approval_id",
        "job_posting",
        "approver_user",
        "approver_role",
        "sequence",
        "status",
        "acted_at",
    )
    list_filter = ("status", "approver_role")
    search_fields = (
        "job_posting__posting_no",
        "job_posting__job_title",
        "approver_user__username",
    )
