from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.leave_policy import (
    LEAVE_APPLICATION_DETAIL_TEMPLATE_CUSTOM,
    LEAVE_APPLICATION_DETAIL_TEMPLATE_NONE,
    LEAVE_APPLICATION_DETAIL_TEMPLATE_PATERNITY,
    LEAVE_APPLICATION_DETAIL_TEMPLATE_SICK,
    LEAVE_APPLICATION_DETAIL_TEMPLATE_STUDY,
    LEAVE_APPLICATION_DETAIL_TEMPLATE_TRAVEL,
    LEAVE_APPLICATION_DETAIL_TEMPLATE_WOMEN_SURGERY,
    build_leave_application_detail_schema,
    normalize_leave_application_detail_schema,
)

# Create your models here.
class Division(models.Model):
    division_id = models.AutoField(primary_key=True)
    division_name = models.CharField(max_length=100, unique=True)
    division_abbreviation = models.CharField(max_length=10)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)
    
    def __str__(self):
        return self.division_name
    
    
class Position(models.Model):
    position_id = models.AutoField(primary_key=True)
    position_name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    standard_salary_grade = models.ForeignKey(
        "SalaryGrade",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="positions",
    )
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)
    
    def __str__(self):
        return self.position_name
    
class TimeRule(models.Model):
    time_rule_id = models.AutoField(primary_key=True)
    time_rule_name = models.CharField(max_length=100, unique=True)
    earliest_in = models.TimeField()
    latest_in = models.TimeField()
    earliest_out = models.TimeField()
    latest_out = models.TimeField()
    lunch_start = models.TimeField()
    lunch_end = models.TimeField()
    lunch_grace_period = models.IntegerField(help_text="Grace period in minutes")
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)
    
    def __str__(self):
        return self.time_rule_name


class SalaryGrade(models.Model):
    salary_grade_id = models.AutoField(primary_key=True)
    csc_grade = models.PositiveSmallIntegerField(unique=True)
    step_1 = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    step_2 = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    step_3 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    step_4 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    step_5 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    step_6 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    step_7 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    step_8 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ["csc_grade"]

    def __str__(self):
        return f"Salary Grade {self.csc_grade}"


class CSCPlantilla(models.Model):
    class AvailabilityStatus(models.TextChoices):
        VACANT = "vacant", "Vacant"
        FILLED = "filled", "Filled"

    plantilla_id = models.AutoField(primary_key=True)
    item_number = models.CharField(max_length=50, unique=True)
    position = models.ForeignKey(Position, on_delete=models.CASCADE)
    division = models.ForeignKey(Division, on_delete=models.CASCADE)
    salary_grade = models.ForeignKey(SalaryGrade, on_delete=models.CASCADE)
    salary_step = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(8)]
    )
    availability_status = models.CharField(
        max_length=20,
        choices=AvailabilityStatus.choices,
        default=AvailabilityStatus.VACANT,
    )
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ["item_number"]

    def __str__(self):
        return f"{self.item_number} - {self.position}"

    @property
    def monthly_salary_amount(self):
        if not self.salary_grade_id or not self.salary_step:
            return None

        return getattr(self.salary_grade, f"step_{self.salary_step}", None)

    @property
    def annual_salary_amount(self):
        if self.monthly_salary_amount is None:
            return None

        return self.monthly_salary_amount * Decimal("12")

    @property
    def is_vacant(self):
        return self.availability_status == self.AvailabilityStatus.VACANT

    def clean(self):
        super().clean()

        if self.position_id and self.position.standard_salary_grade_id and self.salary_grade_id:
            if self.position.standard_salary_grade_id != self.salary_grade_id:
                raise ValidationError({
                    "salary_grade": (
                        f"{self.position.position_name} is classified at Salary Grade "
                        f"{self.position.standard_salary_grade.csc_grade} under the configured CSC/DBM mapping."
                    ),
                })

        if not self.salary_grade_id or not self.salary_step:
            return

        if self.monthly_salary_amount is None:
            raise ValidationError({
                "salary_step": (
                    f"Salary Grade {self.salary_grade.csc_grade} does not have a published "
                    f"amount for Step {self.salary_step}."
                ),
            })


class LeaveType(models.Model):
    class Category(models.TextChoices):
        CREDIT_BASED = "credit_based", "Credit-based Leave"
        STATUTORY = "statutory", "Statutory Leave"
        SPECIAL = "special", "Special Leave Privilege"
        CONVERSION = "conversion", "Credit Conversion / Separation"
        WELLNESS = "wellness", "Wellness Leave"

    leave_type_id = models.AutoField(primary_key=True)
    leave_code = models.CharField(max_length=30, unique=True)
    leave_name = models.CharField(max_length=150, unique=True)
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.STATUTORY,
    )
    description = models.TextField(blank=True)
    legal_basis = models.CharField(max_length=255, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_system_seed = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ["sort_order", "leave_name"]

    def __str__(self):
        return self.leave_name


class LeaveTypeRule(models.Model):
    class PayStatus(models.TextChoices):
        WITH_PAY = "with_pay", "With Pay"
        WITHOUT_PAY = "without_pay", "Without Pay"
        CHARGEABLE_TO_CREDITS = "chargeable_to_credits", "Chargeable to Leave Credits"
        CONDITIONAL = "conditional", "Conditional / Depends on Rule"

    class CreditDeductionMode(models.TextChoices):
        NONE = "none", "Not Deducted from Leave Credits"
        VACATION = "vacation", "Vacation Leave Credits"
        SICK = "sick", "Sick Leave Credits"
        VACATION_OR_SICK = "vacation_or_sick", "Vacation / Sick Leave Credits"
        SEPARATE = "separate", "Separate Statutory Entitlement"

    class BalanceTrackingMode(models.TextChoices):
        NONE = "none", "Do Not Track Against a Balance Bucket"
        VACATION = "vacation", "Track Against Vacation Leave Credits"
        SICK = "sick", "Track Against Sick Leave Credits"
        VACATION_OR_SICK = "vacation_or_sick", "Track Against Vacation / Sick Leave Credits"
        LEAVE_TYPE = "leave_type", "Track Against the Leave Type's Own Balance Bucket"

    class EntitlementUnit(models.TextChoices):
        WORKING_DAYS = "working_days", "Working Days"
        CALENDAR_DAYS = "calendar_days", "Calendar Days"
        MONTHS = "months", "Months"
        CREDIT_BALANCE = "credit_balance", "Available Leave Credit Balance"

    class EntitlementPeriod(models.TextChoices):
        PER_APPLICATION = "per_application", "Per Application"
        PER_YEAR = "per_year", "Per Year"
        PER_OCCURRENCE = "per_occurrence", "Per Occurrence"
        ON_SEPARATION = "on_separation", "Upon Separation"
        NOT_FIXED = "not_fixed", "Not Fixed"

    class FilingDetailTemplate(models.TextChoices):
        NONE = LEAVE_APPLICATION_DETAIL_TEMPLATE_NONE, "No Special Filing Details"
        TRAVEL = LEAVE_APPLICATION_DETAIL_TEMPLATE_TRAVEL, "Travel Details"
        SICK = LEAVE_APPLICATION_DETAIL_TEMPLATE_SICK, "Sick Leave Details"
        PATERNITY = LEAVE_APPLICATION_DETAIL_TEMPLATE_PATERNITY, "Paternity Leave Details"
        STUDY = LEAVE_APPLICATION_DETAIL_TEMPLATE_STUDY, "Study Leave Details"
        WOMEN_SURGERY = LEAVE_APPLICATION_DETAIL_TEMPLATE_WOMEN_SURGERY, "Women's Surgery Details"
        CUSTOM = LEAVE_APPLICATION_DETAIL_TEMPLATE_CUSTOM, "Custom Structured Filing Details"

    leave_type = models.OneToOneField(
        LeaveType,
        on_delete=models.CASCADE,
        related_name="rule",
    )
    pay_status = models.CharField(
        max_length=30,
        choices=PayStatus.choices,
        default=PayStatus.WITH_PAY,
    )
    credit_deduction_mode = models.CharField(
        max_length=30,
        choices=CreditDeductionMode.choices,
        default=CreditDeductionMode.NONE,
    )
    balance_tracking_mode = models.CharField(
        max_length=30,
        choices=BalanceTrackingMode.choices,
        default=BalanceTrackingMode.NONE,
    )
    entitlement_value = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    entitlement_unit = models.CharField(
        max_length=30,
        choices=EntitlementUnit.choices,
        default=EntitlementUnit.WORKING_DAYS,
    )
    entitlement_period = models.CharField(
        max_length=30,
        choices=EntitlementPeriod.choices,
        default=EntitlementPeriod.PER_APPLICATION,
    )
    min_service_months_required = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    advance_notice_days = models.PositiveSmallIntegerField(null=True, blank=True)
    max_consecutive_days = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    requires_earned_leave_credits = models.BooleanField(default=False)
    allows_intermittent = models.BooleanField(default=False)
    requires_supporting_document = models.BooleanField(default=False)
    supporting_document_notes = models.TextField(blank=True)
    eligibility_notes = models.TextField(blank=True)
    filing_notes = models.TextField(blank=True)
    rule_notes = models.TextField(blank=True)
    filing_detail_template = models.CharField(
        max_length=30,
        choices=FilingDetailTemplate.choices,
        default=FilingDetailTemplate.NONE,
    )
    travel_abroad_notice_days = models.PositiveSmallIntegerField(null=True, blank=True)
    application_detail_schema = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"Rules for {self.leave_type.leave_name}"

    def clean(self):
        super().clean()

        errors = {}
        credit_based_modes = {
            self.CreditDeductionMode.VACATION,
            self.CreditDeductionMode.SICK,
            self.CreditDeductionMode.VACATION_OR_SICK,
        }
        tracked_credit_modes = {
            self.BalanceTrackingMode.VACATION,
            self.BalanceTrackingMode.SICK,
            self.BalanceTrackingMode.VACATION_OR_SICK,
        }

        if self.requires_earned_leave_credits and self.credit_deduction_mode not in credit_based_modes:
            errors["credit_deduction_mode"] = (
                "Leave types that require earned credits must charge against vacation, sick, "
                "or vacation/sick leave credits."
            )

        if not self.requires_earned_leave_credits and self.credit_deduction_mode in credit_based_modes:
            errors["requires_earned_leave_credits"] = (
                "Leave types charged against leave credits must require earned leave credits."
            )

        if self.requires_earned_leave_credits and self.balance_tracking_mode not in tracked_credit_modes:
            errors["balance_tracking_mode"] = (
                "Leave types that require earned leave credits must track against the corresponding credit bucket."
            )

        if self.entitlement_unit == self.EntitlementUnit.CREDIT_BALANCE and self.entitlement_value is not None:
            errors["entitlement_value"] = (
                "Do not set a fixed entitlement value when the rule is based on the available leave credit balance."
            )

        if (
            self.entitlement_value is not None
            and self.max_consecutive_days is not None
            and self.entitlement_unit in {
                self.EntitlementUnit.WORKING_DAYS,
                self.EntitlementUnit.CALENDAR_DAYS,
            }
            and self.max_consecutive_days > self.entitlement_value
        ):
            errors["max_consecutive_days"] = (
                "Maximum consecutive days cannot exceed the configured entitlement value."
            )

        if self.filing_detail_template == self.FilingDetailTemplate.CUSTOM:
            try:
                self.application_detail_schema = normalize_leave_application_detail_schema(
                    self.application_detail_schema
                )
            except ValidationError as exc:
                errors["application_detail_schema"] = exc.messages
            else:
                if not self.application_detail_schema:
                    errors["application_detail_schema"] = (
                        "Provide at least one structured filing field when using the custom filing-detail template."
                    )
        else:
            try:
                self.application_detail_schema = build_leave_application_detail_schema(
                    self.filing_detail_template
                )
            except ValidationError as exc:
                errors["filing_detail_template"] = exc.messages

        if (
            self.travel_abroad_notice_days is not None
            and self.filing_detail_template != self.FilingDetailTemplate.TRAVEL
        ):
            errors["travel_abroad_notice_days"] = (
                "Travel abroad notice days only apply to leave types that collect travel details."
            )

        if (
            self.travel_abroad_notice_days is not None
            and self.advance_notice_days is not None
            and self.travel_abroad_notice_days < self.advance_notice_days
        ):
            errors["travel_abroad_notice_days"] = (
                "Travel-abroad notice days cannot be lower than the general advance filing days."
            )

        if errors:
            raise ValidationError(errors)

    def resolve_balance_bucket(self):
        if self.balance_tracking_mode == self.BalanceTrackingMode.NONE:
            return None

        if self.balance_tracking_mode == self.BalanceTrackingMode.VACATION:
            return {
                "bucket_code": "vacation",
                "bucket_name": "Vacation Leave Credits",
            }

        if self.balance_tracking_mode == self.BalanceTrackingMode.SICK:
            return {
                "bucket_code": "sick",
                "bucket_name": "Sick Leave Credits",
            }

        if self.balance_tracking_mode == self.BalanceTrackingMode.VACATION_OR_SICK:
            return {
                "bucket_code": "vacation_or_sick",
                "bucket_name": "Vacation / Sick Leave Credits",
            }

        return {
            "bucket_code": self.leave_type.leave_code,
            "bucket_name": self.leave_type.leave_name,
        }

    @staticmethod
    def _format_decimal_value(value):
        if value is None:
            return None

        if value == value.to_integral():
            return str(int(value))

        return str(value.normalize())

    def entitlement_summary(self):
        if self.entitlement_unit == self.EntitlementUnit.CREDIT_BALANCE:
            credit_label = self.get_credit_deduction_mode_display()
            if self.entitlement_period == self.EntitlementPeriod.ON_SEPARATION:
                return f"{credit_label} upon separation"
            return credit_label

        if self.entitlement_value is None:
            if self.requires_earned_leave_credits:
                return self.get_credit_deduction_mode_display()
            return self.get_entitlement_period_display()

        summary = (
            f"{self._format_decimal_value(self.entitlement_value)} "
            f"{self.get_entitlement_unit_display()} / {self.get_entitlement_period_display()}"
        )

        if self.max_consecutive_days is not None:
            summary = (
                f"{summary} (max {self._format_decimal_value(self.max_consecutive_days)} consecutive days)"
            )

        return summary


class EmployeeLeaveCredit(models.Model):
    leave_credit_id = models.AutoField(primary_key=True)
    employee = models.ForeignKey(
        "employee_modules.Employee",
        on_delete=models.CASCADE,
        related_name="leave_credits",
    )
    bucket_code = models.CharField(max_length=30)
    bucket_name = models.CharField(max_length=150)
    linked_leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_leave_credits",
    )
    current_balance = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    notes = models.TextField(blank=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ["employee__last_name", "employee__first_name", "bucket_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "bucket_code"],
                name="unique_employee_leave_credit_bucket",
            ),
        ]

    def __str__(self):
        return f"{self.employee} - {self.bucket_name}"

    def clean(self):
        super().clean()

        if self.linked_leave_type_id:
            if self.bucket_code and self.bucket_code != self.linked_leave_type.leave_code:
                raise ValidationError({
                    "bucket_code": "Leave-type-linked balances must use the leave type code as the bucket code.",
                })

            if not self.bucket_name:
                self.bucket_name = self.linked_leave_type.leave_name


class EmployeeLeaveCreditLedger(models.Model):
    class EntryType(models.TextChoices):
        OPENING = "opening", "Opening Balance"
        ACCRUAL = "accrual", "Accrual"
        ADJUSTMENT = "adjustment", "Manual Adjustment"
        DEDUCTION = "deduction", "Leave Deduction"
        REVERSAL = "reversal", "Reversal"

    leave_credit = models.ForeignKey(
        EmployeeLeaveCredit,
        on_delete=models.CASCADE,
        related_name="ledger_entries",
    )
    entry_type = models.CharField(
        max_length=20,
        choices=EntryType.choices,
    )
    units_delta = models.DecimalField(max_digits=8, decimal_places=2)
    balance_after = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    effective_date = models.DateField()
    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-effective_date", "-id"]

    def __str__(self):
        return f"{self.leave_credit} {self.entry_type} {self.units_delta}"


class LeaveApplication(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    leave_application_id = models.AutoField(primary_key=True)
    employee = models.ForeignKey(
        "employee_modules.Employee",
        on_delete=models.CASCADE,
        related_name="leave_applications",
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name="leave_applications",
    )
    start_date = models.DateField()
    end_date = models.DateField()
    requested_units = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUBMITTED,
    )
    reason = models.TextField(blank=True)
    supporting_document_reference = models.CharField(max_length=255, blank=True)
    supporting_document_notes = models.TextField(blank=True)
    balance_bucket_code = models.CharField(max_length=30, blank=True)
    deducted_units = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rule_snapshot = models.JSONField(default=dict, blank=True)
    application_details = models.JSONField(default=dict, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ["-created"]

    def __str__(self):
        return f"{self.employee} - {self.leave_type.leave_name}"

    def clean(self):
        super().clean()

        errors = {}

        if self.end_date and self.start_date and self.end_date < self.start_date:
            errors["end_date"] = "End date cannot be earlier than start date."

        if self.leave_type_id and self.leave_type.category == LeaveType.Category.CONVERSION:
            errors["leave_type"] = (
                "Credit conversion leave types are not filed through the standard leave application workflow."
            )

        if errors:
            raise ValidationError(errors)


class LeaveApplicationApproval(models.Model):
    class ApprovalRole(models.TextChoices):
        IMMEDIATE_SUPERVISOR = "immediate_supervisor", "Immediate Supervisor"
        DIVISION_CHIEF = "division_chief", "Division Chief"
        HR_APPROVER = "hr_approver", "HR Approver"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        SKIPPED = "skipped", "Skipped"

    leave_application_approval_id = models.AutoField(primary_key=True)
    leave_application = models.ForeignKey(
        LeaveApplication,
        on_delete=models.CASCADE,
        related_name="approvals",
    )
    approver_employee = models.ForeignKey(
        "employee_modules.Employee",
        on_delete=models.CASCADE,
        related_name="leave_approval_queue",
    )
    approver_role = models.CharField(
        max_length=30,
        choices=ApprovalRole.choices,
    )
    sequence = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.QUEUED,
    )
    decision_notes = models.TextField(blank=True)
    acted_at = models.DateTimeField(null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["leave_application__created", "sequence", "leave_application_approval_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["leave_application", "approver_role"],
                name="unique_leave_application_approver_role",
            ),
        ]

    def __str__(self):
        return (
            f"{self.leave_application} - "
            f"{self.get_approver_role_display()} - {self.get_status_display()}"
        )
