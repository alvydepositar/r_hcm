from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from core.approval_workflow import (
    approve_leave_approval,
    reject_leave_approval,
    sync_leave_approval_queue,
)
from core.leave_policy import (
    infer_leave_application_detail_template,
    format_leave_application_detail_summary,
    normalize_leave_application_details,
    normalize_leave_application_detail_schema,
)
from core.recruitment_workflow import (
    approve_hiring_request_approval,
    approve_job_posting_approval,
    cancel_hiring_request,
    reject_hiring_request_approval,
    reject_job_posting_approval,
    resolve_hiring_requestor_role,
    revert_job_posting_to_draft,
    submit_hiring_request,
    submit_job_posting_for_requestor_approval,
    validate_hiring_request_route,
)
from employee_modules.models import Employee, EmployeePersonalDataSheet
from core.models import (
    CSCPlantilla,
    Division,
    EmployeeLeaveCredit,
    EmployeeLeaveCreditLedger,
    HiringRequest,
    HiringRequestApproval,
    JobPosting,
    JobPostingApproval,
    LeaveApplicationApproval,
    LeaveType,
    LeaveApplication,
    LeaveTypeRule,
    Position,
    SalaryGrade,
    TimeRule,
)
from core.rbac import (
    ROLE_HR,
    ROLE_RECRUITMENT,
    can_access_hr_portal,
    get_user_employee,
    has_recruitment_access,
)
from hr_modules.models import Approver

User = get_user_model()

class EmployeeSerializer(serializers.ModelSerializer):
    division_name = serializers.CharField(source='division.division_name', read_only=True)
    position_name = serializers.CharField(source='position.position_name', read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    
    class Meta:
        model = Employee
        fields = ['id','employee_id','first_name','last_name','middle_name',
                  'name_extension','position','division','division_name', 'position_name', 'username']


class EmployeePersonalDataSheetSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField(read_only=True)
    employee_number = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_position_name = serializers.CharField(source='employee.position.position_name', read_only=True)
    employee_division_name = serializers.CharField(source='employee.division.division_name', read_only=True)

    class Meta:
        model = EmployeePersonalDataSheet
        fields = [
            'pds_id',
            'employee',
            'employee_name',
            'employee_number',
            'employee_position_name',
            'employee_division_name',
            'surname',
            'first_name',
            'middle_name',
            'name_extension',
            'date_of_birth',
            'place_of_birth',
            'sex',
            'civil_status',
            'civil_status_other',
            'citizenship',
            'citizenship_basis',
            'dual_citizenship_country',
            'height_m',
            'weight_kg',
            'blood_type',
            'gsis_id_no',
            'pagibig_id_no',
            'philhealth_no',
            'sss_no',
            'tin_no',
            'agency_employee_no',
            'residential_address',
            'permanent_address',
            'telephone_no',
            'mobile_no',
            'email_address',
            'spouse_information',
            'father_information',
            'mother_information',
            'children',
            'educational_background',
            'civil_service_eligibilities',
            'work_experiences',
            'voluntary_works',
            'learning_and_development',
            'special_skills',
            'recognitions',
            'memberships',
            'questionnaire',
            'references',
            'government_id_type',
            'government_id_number',
            'government_id_date_of_issue',
            'government_id_place_of_issue',
            'date_accomplished',
            'created',
            'modified',
            'created_by',
            'modified_by',
        ]

    LIST_FIELDS = (
        'children',
        'civil_service_eligibilities',
        'work_experiences',
        'voluntary_works',
        'learning_and_development',
        'special_skills',
        'recognitions',
        'memberships',
        'references',
    )
    DICT_FIELDS = (
        'residential_address',
        'permanent_address',
        'spouse_information',
        'father_information',
        'mother_information',
        'educational_background',
        'questionnaire',
    )
    QUESTIONNAIRE_DETAIL_KEYS = (
        'q34a',
        'q34b',
        'q35a',
        'q35b',
        'q36',
        'q37',
        'q38a',
        'q38b',
        'q39',
        'q40a',
        'q40b',
        'q40c',
    )

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}"

    def validate(self, attrs):
        errors = {}

        for field in self.LIST_FIELDS:
            if field in attrs and not isinstance(attrs[field], list):
                errors[field] = ['Must be a list.']

        for field in self.DICT_FIELDS:
            if field in attrs and not isinstance(attrs[field], dict):
                errors[field] = ['Must be an object.']

        employee = attrs.get('employee')
        if employee and self.instance is None and EmployeePersonalDataSheet.objects.filter(employee=employee).exists():
            errors['employee'] = ['A personal data sheet already exists for this employee.']

        if 'references' in attrs and len(attrs['references']) > 3:
            errors['references'] = ['No more than three references may be stored for one personal data sheet.']

        if 'questionnaire' in attrs:
            questionnaire_errors = {}
            for key in self.QUESTIONNAIRE_DETAIL_KEYS:
                question_value = attrs['questionnaire'].get(key, {}) or {}
                answer = str(question_value.get('answer', '')).strip().lower()
                details = str(question_value.get('details', '')).strip()
                if answer == 'yes' and not details:
                    questionnaire_errors[key] = ['Details are required when the answer is yes.']

            if questionnaire_errors:
                errors['questionnaire'] = questionnaire_errors

        if errors:
            raise serializers.ValidationError(errors)

        return attrs


class AccessRightsSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(max_length=150)
    employee = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.select_related("division", "position").all(),
        allow_null=True,
        required=False,
    )
    employee_name = serializers.CharField(read_only=True)
    employee_number = serializers.CharField(read_only=True)
    division_name = serializers.CharField(read_only=True)
    position_name = serializers.CharField(read_only=True)
    has_hr_access = serializers.BooleanField(required=False)
    has_recruitment_access = serializers.BooleanField(required=False)
    has_employee_access = serializers.BooleanField(read_only=True)
    has_approver_access = serializers.BooleanField(read_only=True)
    role_names = serializers.ListField(child=serializers.CharField(), read_only=True)
    is_active = serializers.BooleanField(required=False)
    is_current_user = serializers.BooleanField(read_only=True)
    last_login = serializers.DateTimeField(read_only=True, allow_null=True)
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False,
        trim_whitespace=False,
        style={"input_type": "password"},
    )

    default_error_messages = {
        "self_hr_access": "You cannot remove your own HR access.",
        "self_active": "You cannot deactivate your own account.",
        "superuser_hr_access": "Superuser accounts must retain HR access.",
        "employee_in_use": "This employee is already linked to another user account.",
        "password_required": "A temporary password is required when creating a user account.",
    }

    def _user_has_hr_access(self, user):
        return bool(user.is_superuser or any(group.name == ROLE_HR for group in user.groups.all()))

    def _user_has_recruitment_access(self, user):
        return has_recruitment_access(user)

    def _get_approver_employee_ids(self):
        cached = self.context.get("_access_rights_approver_employee_ids")
        if cached is not None:
            return cached

        approver_ids = set()
        approver_fields = (
            "immediate_supervisor_id",
            "alt_supervisor_id",
            "division_chief_id",
            "alt_division_chief_id",
            "hr_approver_id",
            "alt_hr_approver_id",
        )

        for record in Approver.objects.values(*approver_fields):
            for field in approver_fields:
                value = record.get(field)
                if value:
                    approver_ids.add(value)

        self.context["_access_rights_approver_employee_ids"] = approver_ids
        return approver_ids

    def _serialize_instance(self, instance):
        employee = get_user_employee(instance)
        has_hr_access = self._user_has_hr_access(instance)
        has_recruitment_access = self._user_has_recruitment_access(instance)
        approver_employee_ids = self._get_approver_employee_ids()
        has_approver_access = bool(employee and employee.pk in approver_employee_ids)
        request = self.context.get("request")
        role_names = []

        if has_hr_access:
            role_names.append(ROLE_HR)
        if employee:
            role_names.append("Employee")
        if has_approver_access:
            role_names.append("Approver")
        if has_recruitment_access:
            role_names.append(ROLE_RECRUITMENT)

        return {
            "id": instance.pk,
            "username": instance.username,
            "employee": employee.pk if employee else None,
            "employee_name": str(employee) if employee else "",
            "employee_number": employee.employee_id if employee else "",
            "division_name": employee.division.division_name if employee and employee.division_id else "",
            "position_name": employee.position.position_name if employee and employee.position_id else "",
            "has_hr_access": has_hr_access,
            "has_recruitment_access": has_recruitment_access,
            "has_employee_access": bool(employee),
            "has_approver_access": has_approver_access,
            "role_names": role_names,
            "is_active": instance.is_active,
            "is_current_user": bool(request and request.user.is_authenticated and request.user.pk == instance.pk),
            "last_login": instance.last_login,
        }

    def to_representation(self, instance):
        return self._serialize_instance(instance)

    def validate_username(self, value):
        queryset = User.objects.filter(username=value)
        instance = getattr(self, "instance", None)
        if instance is not None:
            queryset = queryset.exclude(pk=instance.pk)

        if queryset.exists():
            raise serializers.ValidationError("A user with this username already exists.")

        return value

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        request = self.context.get("request")
        employee = attrs.get("employee", get_user_employee(instance) if instance else None)
        has_hr_access = attrs.get("has_hr_access", self._user_has_hr_access(instance) if instance else False)
        is_active = attrs.get("is_active", instance.is_active if instance else True)
        password = attrs.get("password")

        if instance is None and not password:
            raise serializers.ValidationError({"password": [self.error_messages["password_required"]]})

        if employee and employee.user_id and (instance is None or employee.user_id != instance.pk):
            raise serializers.ValidationError({"employee": [self.error_messages["employee_in_use"]]})

        if instance is not None and instance.is_superuser and "has_hr_access" in attrs and not has_hr_access:
            raise serializers.ValidationError({"has_hr_access": [self.error_messages["superuser_hr_access"]]})

        if request and request.user.is_authenticated and instance is not None and request.user.pk == instance.pk:
            if "has_hr_access" in attrs and not has_hr_access:
                raise serializers.ValidationError({"has_hr_access": [self.error_messages["self_hr_access"]]})

            if "is_active" in attrs and not is_active:
                raise serializers.ValidationError({"is_active": [self.error_messages["self_active"]]})

        return attrs

    def _apply_access_changes(
        self,
        user,
        employee,
        has_hr_access,
        has_recruitment_access=False,
    ):
        hr_group, _ = Group.objects.get_or_create(name=ROLE_HR)
        recruitment_group, _ = Group.objects.get_or_create(name=ROLE_RECRUITMENT)
        legacy_it_group, _ = Group.objects.get_or_create(name="IT Manager")
        legacy_division_chief_group, _ = Group.objects.get_or_create(name="Division Chief")

        if has_hr_access or user.is_superuser:
            user.groups.add(hr_group)
        else:
            user.groups.remove(hr_group)

        if has_recruitment_access or user.is_superuser:
            user.groups.add(recruitment_group)
        else:
            user.groups.remove(recruitment_group)

        user.groups.remove(legacy_it_group, legacy_division_chief_group)

        current_employee = get_user_employee(user)
        if current_employee and (employee is None or current_employee.pk != employee.pk):
            current_employee.user = None
            current_employee.save(update_fields=["user"])

        if employee and employee.user_id != user.pk:
            employee.user = user
            employee.save(update_fields=["user"])

    def create(self, validated_data):
        employee = validated_data.pop("employee", None)
        has_hr_access = validated_data.pop("has_hr_access", False)
        has_recruitment_access = validated_data.pop("has_recruitment_access", False)
        password = validated_data.pop("password")
        is_active = validated_data.pop("is_active", True)

        with transaction.atomic():
            user = User(
                username=validated_data["username"],
                is_active=is_active,
            )
            user.set_password(password)
            user.save()
            self._apply_access_changes(
                user,
                employee,
                has_hr_access,
                has_recruitment_access,
            )

        return user

    def update(self, instance, validated_data):
        employee = validated_data.pop("employee", get_user_employee(instance))
        has_hr_access = validated_data.pop("has_hr_access", self._user_has_hr_access(instance))
        has_recruitment_access = validated_data.pop(
            "has_recruitment_access",
            self._user_has_recruitment_access(instance),
        )
        password = validated_data.pop("password", None)
        instance.username = validated_data.get("username", instance.username)
        instance.is_active = validated_data.get("is_active", instance.is_active)

        if password:
            instance.set_password(password)

        with transaction.atomic():
            instance.save()
            self._apply_access_changes(
                instance,
                employee,
                has_hr_access,
                has_recruitment_access,
            )

        return instance

class DivisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Division
        fields = "__all__"

class PositionSerializer(serializers.ModelSerializer):
    standard_csc_grade = serializers.IntegerField(source="standard_salary_grade.csc_grade", read_only=True)

    class Meta:
        model = Position
        fields = [
            "position_id",
            "position_name",
            "description",
            "standard_salary_grade",
            "standard_csc_grade",
            "created",
            "modified",
            "created_by",
            "modified_by",
        ]
        
class TimeRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeRule
        fields = "__all__"


class SalaryGradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalaryGrade
        fields = [
            "salary_grade_id",
            "csc_grade",
            "step_1",
            "step_2",
            "step_3",
            "step_4",
            "step_5",
            "step_6",
            "step_7",
            "step_8",
            "created",
            "modified",
            "created_by",
            "modified_by",
        ]


class CSCPlantillaSerializer(serializers.ModelSerializer):
    position_name = serializers.CharField(source="position.position_name", read_only=True)
    position_standard_salary_grade = serializers.PrimaryKeyRelatedField(source="position.standard_salary_grade", read_only=True)
    position_standard_csc_grade = serializers.IntegerField(source="position.standard_salary_grade.csc_grade", read_only=True)
    division_name = serializers.CharField(source="division.division_name", read_only=True)
    csc_grade = serializers.IntegerField(source="salary_grade.csc_grade", read_only=True)
    monthly_salary = serializers.DecimalField(
        source="monthly_salary_amount",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    annual_salary = serializers.DecimalField(
        source="annual_salary_amount",
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )
    is_vacant = serializers.BooleanField(read_only=True)

    class Meta:
        model = CSCPlantilla
        fields = [
            "plantilla_id",
            "item_number",
            "position",
            "position_name",
            "position_standard_salary_grade",
            "position_standard_csc_grade",
            "division",
            "division_name",
            "salary_grade",
            "csc_grade",
            "salary_step",
            "availability_status",
            "is_vacant",
            "monthly_salary",
            "annual_salary",
            "created",
            "modified",
            "created_by",
            "modified_by",
        ]

    def validate(self, attrs):
        position = attrs["position"] if "position" in attrs else getattr(self.instance, "position", None)
        salary_grade = attrs["salary_grade"] if "salary_grade" in attrs else getattr(self.instance, "salary_grade", None)
        salary_step = attrs["salary_step"] if "salary_step" in attrs else getattr(self.instance, "salary_step", None)

        if position and position.standard_salary_grade_id and salary_grade:
            if position.standard_salary_grade_id != salary_grade.pk:
                raise serializers.ValidationError({
                    "salary_grade": [
                        f"{position.position_name} is mapped to Salary Grade "
                        f"{position.standard_salary_grade.csc_grade} and plantilla items for that position "
                        "must use the same grade."
                    ]
                })

        if salary_grade and salary_step:
            selected_amount = getattr(salary_grade, f"step_{salary_step}", None)
            if selected_amount is None:
                raise serializers.ValidationError({
                    "salary_step": [
                        f"Salary Grade {salary_grade.csc_grade} does not have a published "
                        f"amount for Step {salary_step}."
                    ]
                })

        return attrs


class LeaveTypeSerializer(serializers.ModelSerializer):
    category_label = serializers.ReadOnlyField(source="get_category_display")
    pay_status = serializers.ChoiceField(
        source="rule.pay_status",
        choices=LeaveTypeRule.PayStatus.choices,
        required=False,
    )
    pay_status_label = serializers.ReadOnlyField(source="rule.get_pay_status_display")
    credit_deduction_mode = serializers.ChoiceField(
        source="rule.credit_deduction_mode",
        choices=LeaveTypeRule.CreditDeductionMode.choices,
        required=False,
    )
    credit_deduction_mode_label = serializers.ReadOnlyField(
        source="rule.get_credit_deduction_mode_display"
    )
    balance_tracking_mode = serializers.ChoiceField(
        source="rule.balance_tracking_mode",
        choices=LeaveTypeRule.BalanceTrackingMode.choices,
        required=False,
    )
    balance_tracking_mode_label = serializers.ReadOnlyField(
        source="rule.get_balance_tracking_mode_display"
    )
    entitlement_value = serializers.DecimalField(
        source="rule.entitlement_value",
        max_digits=6,
        decimal_places=2,
        allow_null=True,
        required=False,
    )
    entitlement_unit = serializers.ChoiceField(
        source="rule.entitlement_unit",
        choices=LeaveTypeRule.EntitlementUnit.choices,
        required=False,
    )
    entitlement_unit_label = serializers.ReadOnlyField(source="rule.get_entitlement_unit_display")
    entitlement_period = serializers.ChoiceField(
        source="rule.entitlement_period",
        choices=LeaveTypeRule.EntitlementPeriod.choices,
        required=False,
    )
    entitlement_period_label = serializers.ReadOnlyField(source="rule.get_entitlement_period_display")
    entitlement_summary = serializers.SerializerMethodField(read_only=True)
    min_service_months_required = serializers.DecimalField(
        source="rule.min_service_months_required",
        max_digits=6,
        decimal_places=2,
        allow_null=True,
        required=False,
    )
    advance_notice_days = serializers.IntegerField(
        source="rule.advance_notice_days",
        allow_null=True,
        required=False,
        min_value=0,
    )
    max_consecutive_days = serializers.DecimalField(
        source="rule.max_consecutive_days",
        max_digits=6,
        decimal_places=2,
        allow_null=True,
        required=False,
    )
    requires_earned_leave_credits = serializers.BooleanField(
        source="rule.requires_earned_leave_credits",
        required=False,
    )
    allows_intermittent = serializers.BooleanField(
        source="rule.allows_intermittent",
        required=False,
    )
    requires_supporting_document = serializers.BooleanField(
        source="rule.requires_supporting_document",
        required=False,
    )
    supporting_document_notes = serializers.CharField(
        source="rule.supporting_document_notes",
        allow_blank=True,
        required=False,
    )
    eligibility_notes = serializers.CharField(
        source="rule.eligibility_notes",
        allow_blank=True,
        required=False,
    )
    filing_notes = serializers.CharField(
        source="rule.filing_notes",
        allow_blank=True,
        required=False,
    )
    rule_notes = serializers.CharField(
        source="rule.rule_notes",
        allow_blank=True,
        required=False,
    )
    filing_detail_template = serializers.ChoiceField(
        source="rule.filing_detail_template",
        choices=LeaveTypeRule.FilingDetailTemplate.choices,
        required=False,
    )
    filing_detail_template_label = serializers.ReadOnlyField(
        source="rule.get_filing_detail_template_display"
    )
    travel_abroad_notice_days = serializers.IntegerField(
        source="rule.travel_abroad_notice_days",
        allow_null=True,
        required=False,
        min_value=0,
    )
    application_detail_schema = serializers.JSONField(
        source="rule.application_detail_schema",
        required=False,
    )

    class Meta:
        model = LeaveType
        fields = [
            "leave_type_id",
            "leave_code",
            "leave_name",
            "category",
            "category_label",
            "description",
            "legal_basis",
            "sort_order",
            "is_active",
            "is_system_seed",
            "pay_status",
            "pay_status_label",
            "credit_deduction_mode",
            "credit_deduction_mode_label",
            "balance_tracking_mode",
            "balance_tracking_mode_label",
            "entitlement_value",
            "entitlement_unit",
            "entitlement_unit_label",
            "entitlement_period",
            "entitlement_period_label",
            "entitlement_summary",
            "min_service_months_required",
            "advance_notice_days",
            "max_consecutive_days",
            "requires_earned_leave_credits",
            "allows_intermittent",
            "requires_supporting_document",
            "supporting_document_notes",
            "eligibility_notes",
            "filing_notes",
            "rule_notes",
            "filing_detail_template",
            "filing_detail_template_label",
            "travel_abroad_notice_days",
            "application_detail_schema",
            "created",
            "modified",
            "created_by",
            "modified_by",
        ]
        read_only_fields = ["is_system_seed", "created", "modified"]

    def get_entitlement_summary(self, obj):
        if getattr(obj, "rule", None) is None:
            return ""

        return obj.rule.entitlement_summary()

    def _candidate_instances(self, attrs):
        leave_attrs = {key: value for key, value in attrs.items() if key != "rule"}
        rule_attrs = attrs.get("rule", {})

        if self.instance is None:
            leave_type = LeaveType(**leave_attrs)
            rule = LeaveTypeRule(leave_type=leave_type, **rule_attrs)
            return leave_type, rule

        leave_type = self.instance
        for key, value in leave_attrs.items():
            setattr(leave_type, key, value)

        rule = LeaveTypeRule.objects.filter(leave_type=self.instance).first()
        if rule is None:
            rule = LeaveTypeRule(leave_type=self.instance)

        for key, value in rule_attrs.items():
            setattr(rule, key, value)

        return leave_type, rule

    def _apply_default_balance_tracking(self, attrs):
        rule_attrs = attrs.setdefault("rule", {})

        if "balance_tracking_mode" in rule_attrs:
            return

        credit_mode = rule_attrs.get("credit_deduction_mode")
        auto_map = {
            LeaveTypeRule.CreditDeductionMode.VACATION: LeaveTypeRule.BalanceTrackingMode.VACATION,
            LeaveTypeRule.CreditDeductionMode.SICK: LeaveTypeRule.BalanceTrackingMode.SICK,
            LeaveTypeRule.CreditDeductionMode.VACATION_OR_SICK: LeaveTypeRule.BalanceTrackingMode.VACATION_OR_SICK,
        }

        if credit_mode in auto_map:
            rule_attrs["balance_tracking_mode"] = auto_map[credit_mode]

    def validate(self, attrs):
        self._apply_default_balance_tracking(attrs)
        rule_attrs = attrs.setdefault("rule", {})

        if "filing_detail_template" not in rule_attrs and "application_detail_schema" in rule_attrs:
            try:
                rule_attrs["filing_detail_template"] = infer_leave_application_detail_template(
                    rule_attrs["application_detail_schema"]
                )
            except DjangoValidationError as exc:
                raise serializers.ValidationError({
                    "application_detail_schema": exc.messages,
                }) from exc

        leave_type, rule = self._candidate_instances(attrs)
        errors = {}

        try:
            leave_type.full_clean()
        except DjangoValidationError as exc:
            errors.update(exc.message_dict)

        try:
            rule.full_clean(exclude=["leave_type"])
        except DjangoValidationError as exc:
            errors.update(exc.message_dict)

        if errors:
            raise serializers.ValidationError(errors)

        attrs.setdefault("rule", {})["application_detail_schema"] = rule.application_detail_schema
        attrs.setdefault("rule", {})["filing_detail_template"] = rule.filing_detail_template
        return attrs

    def create(self, validated_data):
        rule_data = validated_data.pop("rule", {})
        leave_type = LeaveType.objects.create(**validated_data)
        LeaveTypeRule.objects.create(leave_type=leave_type, **rule_data)
        return leave_type

    def update(self, instance, validated_data):
        rule_data = validated_data.pop("rule", {})

        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()

        rule, _ = LeaveTypeRule.objects.get_or_create(leave_type=instance)
        for key, value in rule_data.items():
            setattr(rule, key, value)
        rule.save()

        return LeaveType.objects.get(pk=instance.pk)


class EmployeeLeaveCreditSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField(read_only=True)
    employee_number = serializers.CharField(source="employee.employee_id", read_only=True)
    linked_leave_type_name = serializers.CharField(
        source="linked_leave_type.leave_name",
        read_only=True,
    )

    class Meta:
        model = EmployeeLeaveCredit
        fields = [
            "leave_credit_id",
            "employee",
            "employee_name",
            "employee_number",
            "bucket_code",
            "bucket_name",
            "linked_leave_type",
            "linked_leave_type_name",
            "current_balance",
            "notes",
            "created",
            "modified",
            "created_by",
            "modified_by",
        ]
        read_only_fields = ["created", "modified"]

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}"

    def validate(self, attrs):
        if self.instance is None:
            credit = EmployeeLeaveCredit(**attrs)
        else:
            credit = self.instance
            for key, value in attrs.items():
                setattr(credit, key, value)

        if credit.linked_leave_type_id:
            credit.bucket_code = credit.linked_leave_type.leave_code
            credit.bucket_name = credit.linked_leave_type.leave_name

        errors = {}

        try:
            credit.full_clean()
        except DjangoValidationError as exc:
            errors.update(exc.message_dict)

        if errors:
            raise serializers.ValidationError(errors)

        attrs["bucket_code"] = credit.bucket_code
        attrs["bucket_name"] = credit.bucket_name
        return attrs


class EmployeeLeaveCreditLedgerSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(
        source="leave_credit.employee.employee_id",
        read_only=True,
    )
    employee_name = serializers.SerializerMethodField(read_only=True)
    bucket_code = serializers.CharField(source="leave_credit.bucket_code", read_only=True)
    bucket_name = serializers.CharField(source="leave_credit.bucket_name", read_only=True)

    class Meta:
        model = EmployeeLeaveCreditLedger
        fields = [
            "id",
            "leave_credit",
            "employee_id",
            "employee_name",
            "bucket_code",
            "bucket_name",
            "entry_type",
            "units_delta",
            "balance_after",
            "effective_date",
            "reference_type",
            "reference_id",
            "notes",
            "created",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj):
        employee = obj.leave_credit.employee
        return f"{employee.first_name} {employee.last_name}"


class LeaveApplicationSerializer(serializers.ModelSerializer):
    STATUS_MUTABLE_FIELDS = {
        "employee",
        "leave_type",
        "start_date",
        "end_date",
        "requested_units",
        "status",
        "reason",
        "supporting_document_reference",
        "supporting_document_notes",
        "application_details",
    }

    employee_name = serializers.SerializerMethodField(read_only=True)
    employee_number = serializers.CharField(source="employee.employee_id", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.leave_name", read_only=True)
    leave_code = serializers.CharField(source="leave_type.leave_code", read_only=True)
    category = serializers.CharField(source="leave_type.category", read_only=True)
    category_label = serializers.CharField(source="leave_type.get_category_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    available_balance = serializers.SerializerMethodField(read_only=True)
    entitlement_summary = serializers.SerializerMethodField(read_only=True)
    current_approval_role = serializers.SerializerMethodField(read_only=True)
    current_approval_role_label = serializers.SerializerMethodField(read_only=True)
    current_approver_name = serializers.SerializerMethodField(read_only=True)
    approval_progress = serializers.SerializerMethodField(read_only=True)
    application_detail_summary = serializers.SerializerMethodField(read_only=True)
    requested_units = serializers.DecimalField(
        max_digits=8,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    application_details = serializers.JSONField(required=False)

    class Meta:
        model = LeaveApplication
        fields = [
            "leave_application_id",
            "employee",
            "employee_name",
            "employee_number",
            "leave_type",
            "leave_type_name",
            "leave_code",
            "category",
            "category_label",
            "start_date",
            "end_date",
            "requested_units",
            "status",
            "status_label",
            "reason",
            "supporting_document_reference",
            "supporting_document_notes",
            "application_details",
            "application_detail_summary",
            "balance_bucket_code",
            "deducted_units",
            "available_balance",
            "entitlement_summary",
            "current_approval_role",
            "current_approval_role_label",
            "current_approver_name",
            "approval_progress",
            "approved_at",
            "rule_snapshot",
            "created",
            "modified",
            "created_by",
            "modified_by",
        ]
        read_only_fields = [
            "balance_bucket_code",
            "deducted_units",
            "approved_at",
            "rule_snapshot",
            "created",
            "modified",
        ]

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}"

    def get_available_balance(self, obj):
        if not obj.balance_bucket_code:
            return None

        credit = EmployeeLeaveCredit.objects.filter(
            employee=obj.employee,
            bucket_code=obj.balance_bucket_code,
        ).first()
        return str(credit.current_balance) if credit else None

    def get_entitlement_summary(self, obj):
        rule = getattr(obj.leave_type, "rule", None)
        return rule.entitlement_summary() if rule else ""

    def _get_application_detail_schema(self, leave_type, instance=None):
        if instance and isinstance(instance.rule_snapshot, dict):
            snapshot_schema = instance.rule_snapshot.get("application_detail_schema")
            if snapshot_schema not in (None, ""):
                return snapshot_schema

        return getattr(leave_type.rule, "application_detail_schema", [])

    def get_application_detail_summary(self, obj):
        schema = self._get_application_detail_schema(obj.leave_type, instance=obj)
        return format_leave_application_detail_summary(schema, obj.application_details)

    def _get_pending_approval(self, obj):
        return obj.approvals.filter(status=LeaveApplicationApproval.Status.PENDING).order_by("sequence").first()

    def get_current_approval_role(self, obj):
        pending_approval = self._get_pending_approval(obj)
        return pending_approval.approver_role if pending_approval else ""

    def get_current_approval_role_label(self, obj):
        pending_approval = self._get_pending_approval(obj)
        return pending_approval.get_approver_role_display() if pending_approval else ""

    def get_current_approver_name(self, obj):
        pending_approval = self._get_pending_approval(obj)
        if pending_approval is None:
            return ""

        approver = pending_approval.approver_employee
        return f"{approver.first_name} {approver.last_name}"

    def get_approval_progress(self, obj):
        total_steps = obj.approvals.count()
        if total_steps == 0:
            return "No approver route configured"

        approved_steps = obj.approvals.filter(status=LeaveApplicationApproval.Status.APPROVED).count()
        return f"{approved_steps} of {total_steps} approval step(s) completed"

    def _resolve_requested_units(self, leave_type, start_date, end_date, requested_units):
        rule = leave_type.rule
        current = start_date
        working_days = Decimal("0.00")
        calendar_days = Decimal("0.00")

        while current <= end_date:
            calendar_days += Decimal("1.00")
            if current.weekday() < 5:
                working_days += Decimal("1.00")
            current += timedelta(days=1)

        if rule.entitlement_unit == LeaveTypeRule.EntitlementUnit.CALENDAR_DAYS:
            return calendar_days

        if rule.entitlement_unit in {
            LeaveTypeRule.EntitlementUnit.WORKING_DAYS,
            LeaveTypeRule.EntitlementUnit.CREDIT_BALANCE,
        }:
            return working_days

        if requested_units in (None, "", Decimal("0.00")):
            raise serializers.ValidationError({
                "requested_units": [
                    "Enter the requested units for leave types measured in months or custom units."
                ]
            })

        return requested_units

    def _build_rule_snapshot(self, leave_type):
        rule = leave_type.rule
        bucket = rule.resolve_balance_bucket() or {}
        return {
            "leave_code": leave_type.leave_code,
            "leave_name": leave_type.leave_name,
            "category": leave_type.category,
            "category_label": leave_type.get_category_display(),
            "pay_status": rule.pay_status,
            "pay_status_label": rule.get_pay_status_display(),
            "credit_deduction_mode": rule.credit_deduction_mode,
            "credit_deduction_mode_label": rule.get_credit_deduction_mode_display(),
            "balance_tracking_mode": rule.balance_tracking_mode,
            "balance_tracking_mode_label": rule.get_balance_tracking_mode_display(),
            "entitlement_value": str(rule.entitlement_value) if rule.entitlement_value is not None else None,
            "entitlement_unit": rule.entitlement_unit,
            "entitlement_unit_label": rule.get_entitlement_unit_display(),
            "entitlement_period": rule.entitlement_period,
            "entitlement_period_label": rule.get_entitlement_period_display(),
            "entitlement_summary": rule.entitlement_summary(),
            "advance_notice_days": rule.advance_notice_days,
            "travel_abroad_notice_days": rule.travel_abroad_notice_days,
            "max_consecutive_days": str(rule.max_consecutive_days) if rule.max_consecutive_days is not None else None,
            "requires_supporting_document": rule.requires_supporting_document,
            "supporting_document_notes": rule.supporting_document_notes,
            "balance_bucket_code": bucket.get("bucket_code"),
            "balance_bucket_name": bucket.get("bucket_name"),
            "filing_detail_template": rule.filing_detail_template,
            "filing_detail_template_label": rule.get_filing_detail_template_display(),
            "application_detail_schema": normalize_leave_application_detail_schema(
                rule.application_detail_schema
            ),
        }

    def _get_effective_balance(self, *, employee, bucket_code, instance=None):
        credit = EmployeeLeaveCredit.objects.filter(
            employee=employee,
            bucket_code=bucket_code,
        ).first()

        effective_balance = credit.current_balance if credit else None

        if (
            instance is not None
            and instance.status == LeaveApplication.Status.APPROVED
            and instance.balance_bucket_code == bucket_code
            and instance.deducted_units
            and effective_balance is not None
        ):
            effective_balance += instance.deducted_units

        return credit, effective_balance

    def validate(self, attrs):
        employee = attrs.get("employee", getattr(self.instance, "employee", None))
        leave_type = attrs.get("leave_type", getattr(self.instance, "leave_type", None))
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        requested_units = attrs.get("requested_units", getattr(self.instance, "requested_units", None))
        status = attrs.get("status", getattr(self.instance, "status", LeaveApplication.Status.SUBMITTED))
        reference = attrs.get(
            "supporting_document_reference",
            getattr(self.instance, "supporting_document_reference", ""),
        )
        supporting_notes = attrs.get(
            "supporting_document_notes",
            getattr(self.instance, "supporting_document_notes", ""),
        )
        application_details = attrs.get(
            "application_details",
            getattr(self.instance, "application_details", {}),
        )

        if not employee or not leave_type or not start_date or not end_date:
            return attrs

        if not hasattr(leave_type, "rule"):
            raise serializers.ValidationError({
                "leave_type": ["The selected leave type does not have a leave rule configuration."],
            })

        candidate = LeaveApplication(
            employee=employee,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            requested_units=requested_units or Decimal("0.01"),
            status=status,
            reason=attrs.get("reason", getattr(self.instance, "reason", "")),
            supporting_document_reference=reference,
            supporting_document_notes=supporting_notes,
        )

        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict)

        rule = leave_type.rule
        detail_schema = (
            leave_type.rule.application_detail_schema
            if "leave_type" in attrs
            else self._get_application_detail_schema(leave_type, instance=self.instance)
        )
        calculated_units = self._resolve_requested_units(
            leave_type,
            start_date,
            end_date,
            requested_units,
        )
        attrs["requested_units"] = calculated_units

        try:
            attrs["application_details"] = normalize_leave_application_details(
                detail_schema,
                application_details,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError({
                "application_details": exc.messages,
            })

        errors = {}
        today = timezone.localdate()
        is_finalizing_existing_submission = (
            self.instance is not None
            and self.instance.status == LeaveApplication.Status.SUBMITTED
            and status in {
                LeaveApplication.Status.APPROVED,
                LeaveApplication.Status.REJECTED,
                LeaveApplication.Status.CANCELLED,
            }
            and self.instance.start_date == start_date
            and self.instance.end_date == end_date
        )

        if (
            rule.advance_notice_days is not None
            and status in {LeaveApplication.Status.SUBMITTED, LeaveApplication.Status.APPROVED}
            and not is_finalizing_existing_submission
            and start_date < today + timedelta(days=rule.advance_notice_days)
        ):
            errors["start_date"] = [
                f"This leave type should be filed at least {rule.advance_notice_days} day(s) before the start date."
            ]

        travel_scope = str(attrs["application_details"].get("travel_scope", "")).strip().lower()
        if (
            rule.filing_detail_template == LeaveTypeRule.FilingDetailTemplate.TRAVEL
            and travel_scope == "abroad"
            and rule.travel_abroad_notice_days is not None
            and status in {LeaveApplication.Status.SUBMITTED, LeaveApplication.Status.APPROVED}
            and not is_finalizing_existing_submission
            and start_date < today + timedelta(days=rule.travel_abroad_notice_days)
        ):
            errors["start_date"] = [
                (
                    "Travel abroad requests for this leave type should be filed at least "
                    f"{rule.travel_abroad_notice_days} day(s) before the start date."
                )
            ]

        if (
            rule.max_consecutive_days is not None
            and calculated_units > rule.max_consecutive_days
        ):
            errors["requested_units"] = [
                f"The requested leave exceeds the maximum of {rule.max_consecutive_days} unit(s) allowed in one application."
            ]

        if rule.requires_supporting_document and not str(reference).strip() and not str(supporting_notes).strip():
            errors["supporting_document_reference"] = [
                "Provide a supporting document reference or note for this leave type."
            ]

        bucket = rule.resolve_balance_bucket()
        bucket_code = bucket["bucket_code"] if bucket else ""
        attrs["balance_bucket_code"] = bucket_code
        attrs["deducted_units"] = calculated_units if bucket_code else None
        attrs["rule_snapshot"] = self._build_rule_snapshot(leave_type)

        if bucket_code and status in {LeaveApplication.Status.SUBMITTED, LeaveApplication.Status.APPROVED}:
            credit, effective_balance = self._get_effective_balance(
                employee=employee,
                bucket_code=bucket_code,
                instance=self.instance,
            )

            if credit is None:
                errors["leave_type"] = [
                    f"{employee.first_name} {employee.last_name} does not yet have an available balance bucket for {bucket['bucket_name']}."
                ]
            elif effective_balance is not None and effective_balance < calculated_units:
                errors["requested_units"] = [
                    f"Requested units exceed the available balance of {effective_balance} in {bucket['bucket_name']}."
                ]
            else:
                attrs["_credit_record"] = credit

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def _apply_ledger_entry(self, *, credit, application, entry_type, units_delta, effective_date, notes):
        new_balance = credit.current_balance + units_delta

        if new_balance < Decimal("0.00"):
            raise serializers.ValidationError({
                "requested_units": [
                    f"Insufficient balance in {credit.bucket_name}."
                ]
            })

        credit.current_balance = new_balance
        credit.save(update_fields=["current_balance", "modified"])

        EmployeeLeaveCreditLedger.objects.create(
            leave_credit=credit,
            entry_type=entry_type,
            units_delta=units_delta,
            balance_after=new_balance,
            effective_date=effective_date,
            reference_type="leave_application",
            reference_id=str(application.leave_application_id),
            notes=notes,
        )

    def create(self, validated_data):
        credit_record = validated_data.pop("_credit_record", None)

        with transaction.atomic():
            if validated_data.get("status") == LeaveApplication.Status.APPROVED:
                validated_data["approved_at"] = timezone.now()

            application = LeaveApplication.objects.create(**validated_data)

            if (
                application.status == LeaveApplication.Status.APPROVED
                and application.balance_bucket_code
                and application.deducted_units
            ):
                credit_record = credit_record or EmployeeLeaveCredit.objects.get(
                    employee=application.employee,
                    bucket_code=application.balance_bucket_code,
                )
                self._apply_ledger_entry(
                    credit=credit_record,
                    application=application,
                    entry_type=EmployeeLeaveCreditLedger.EntryType.DEDUCTION,
                    units_delta=-application.deducted_units,
                    effective_date=application.start_date,
                    notes=f"Approved {application.leave_type.leave_name} application.",
                )

            sync_leave_approval_queue(application)

            return application

    def update(self, instance, validated_data):
        credit_record = validated_data.pop("_credit_record", None)
        old_status = instance.status
        old_employee = instance.employee
        old_bucket_code = instance.balance_bucket_code
        old_deducted_units = instance.deducted_units or Decimal("0.00")

        with transaction.atomic():
            for key, value in validated_data.items():
                setattr(instance, key, value)

            if instance.status == LeaveApplication.Status.APPROVED:
                if old_status != LeaveApplication.Status.APPROVED:
                    instance.approved_at = timezone.now()
            elif old_status == LeaveApplication.Status.APPROVED:
                instance.approved_at = None

            instance.save()

            old_requires_deduction = (
                old_status == LeaveApplication.Status.APPROVED
                and bool(old_bucket_code)
                and old_deducted_units > Decimal("0.00")
            )
            new_requires_deduction = (
                instance.status == LeaveApplication.Status.APPROVED
                and bool(instance.balance_bucket_code)
                and (instance.deducted_units or Decimal("0.00")) > Decimal("0.00")
            )
            deduction_changed = (
                old_employee.pk != instance.employee.pk
                or old_bucket_code != instance.balance_bucket_code
                or old_deducted_units != (instance.deducted_units or Decimal("0.00"))
            )

            if old_requires_deduction and (not new_requires_deduction or deduction_changed):
                old_credit = EmployeeLeaveCredit.objects.get(
                    employee=old_employee,
                    bucket_code=old_bucket_code,
                )
                self._apply_ledger_entry(
                    credit=old_credit,
                    application=instance,
                    entry_type=EmployeeLeaveCreditLedger.EntryType.REVERSAL,
                    units_delta=old_deducted_units,
                    effective_date=timezone.localdate(),
                    notes=f"Reversal for {instance.leave_type.leave_name} application update.",
                )

            if new_requires_deduction and (not old_requires_deduction or deduction_changed):
                new_credit = credit_record or EmployeeLeaveCredit.objects.get(
                    employee=instance.employee,
                    bucket_code=instance.balance_bucket_code,
                )
                self._apply_ledger_entry(
                    credit=new_credit,
                    application=instance,
                    entry_type=EmployeeLeaveCreditLedger.EntryType.DEDUCTION,
                    units_delta=-(instance.deducted_units or Decimal("0.00")),
                    effective_date=instance.start_date,
                    notes=f"Approved {instance.leave_type.leave_name} application.",
                )

            sync_leave_approval_queue(instance)
            return instance


class LeaveApplicationApprovalSerializer(serializers.ModelSerializer):
    approver_name = serializers.SerializerMethodField(read_only=True)
    approver_role_label = serializers.CharField(source="get_approver_role_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    application_status = serializers.CharField(source="leave_application.status", read_only=True)
    application_status_label = serializers.CharField(source="leave_application.get_status_display", read_only=True)
    employee = serializers.IntegerField(source="leave_application.employee.pk", read_only=True)
    employee_name = serializers.SerializerMethodField(read_only=True)
    employee_number = serializers.CharField(source="leave_application.employee.employee_id", read_only=True)
    leave_type = serializers.IntegerField(source="leave_application.leave_type.pk", read_only=True)
    leave_type_name = serializers.CharField(source="leave_application.leave_type.leave_name", read_only=True)
    leave_code = serializers.CharField(source="leave_application.leave_type.leave_code", read_only=True)
    start_date = serializers.DateField(source="leave_application.start_date", read_only=True)
    end_date = serializers.DateField(source="leave_application.end_date", read_only=True)
    requested_units = serializers.DecimalField(
        source="leave_application.requested_units",
        max_digits=8,
        decimal_places=2,
        read_only=True,
    )
    reason = serializers.CharField(source="leave_application.reason", read_only=True)
    supporting_document_reference = serializers.CharField(
        source="leave_application.supporting_document_reference",
        read_only=True,
    )
    supporting_document_notes = serializers.CharField(
        source="leave_application.supporting_document_notes",
        read_only=True,
    )
    application_details = serializers.JSONField(
        source="leave_application.application_details",
        read_only=True,
    )
    application_detail_summary = serializers.SerializerMethodField(read_only=True)
    approval_progress = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LeaveApplicationApproval
        fields = [
            "leave_application_approval_id",
            "leave_application",
            "approver_employee",
            "approver_name",
            "approver_role",
            "approver_role_label",
            "sequence",
            "status",
            "status_label",
            "decision_notes",
            "acted_at",
            "application_status",
            "application_status_label",
            "employee",
            "employee_name",
            "employee_number",
            "leave_type",
            "leave_type_name",
            "leave_code",
            "start_date",
            "end_date",
            "requested_units",
            "reason",
            "supporting_document_reference",
            "supporting_document_notes",
            "application_details",
            "application_detail_summary",
            "approval_progress",
            "created",
            "modified",
        ]
        read_only_fields = [
            "leave_application",
            "approver_employee",
            "approver_name",
            "approver_role_label",
            "status_label",
            "acted_at",
            "application_status",
            "application_status_label",
            "employee",
            "employee_name",
            "employee_number",
            "leave_type",
            "leave_type_name",
            "leave_code",
            "start_date",
            "end_date",
            "requested_units",
            "reason",
            "supporting_document_reference",
            "supporting_document_notes",
            "approval_progress",
            "created",
            "modified",
        ]

    def get_approver_name(self, obj):
        approver = obj.approver_employee
        return f"{approver.first_name} {approver.last_name}"

    def get_employee_name(self, obj):
        employee = obj.leave_application.employee
        return f"{employee.first_name} {employee.last_name}"

    def get_application_detail_summary(self, obj):
        snapshot_schema = []
        if isinstance(obj.leave_application.rule_snapshot, dict):
            snapshot_schema = obj.leave_application.rule_snapshot.get("application_detail_schema") or []

        return format_leave_application_detail_summary(
            snapshot_schema or getattr(obj.leave_application.leave_type.rule, "application_detail_schema", []),
            obj.leave_application.application_details,
        )

    def get_approval_progress(self, obj):
        approvals = obj.leave_application.approvals.all()
        approved_steps = approvals.filter(status=LeaveApplicationApproval.Status.APPROVED).count()
        return f"{approved_steps} of {approvals.count()} approval step(s) completed"

    def validate(self, attrs):
        request = self.context.get("request")
        target_status = attrs.get("status")

        if target_status not in {
            LeaveApplicationApproval.Status.APPROVED,
            LeaveApplicationApproval.Status.REJECTED,
        }:
            raise serializers.ValidationError({
                "status": ["Approver decisions must be either approved or rejected."],
            })

        if self.instance.status != LeaveApplicationApproval.Status.PENDING:
            raise serializers.ValidationError({
                "status": ["Only pending approval steps can be acted on."],
            })

        if request is None or not request.user.is_authenticated:
            raise serializers.ValidationError({
                "non_field_errors": ["Authentication is required to approve filings."],
            })

        user_employee = get_user_employee(request.user)
        if not can_access_hr_portal(request.user) and user_employee != self.instance.approver_employee:
            raise serializers.ValidationError({
                "non_field_errors": ["This approval step is not assigned to your account."],
            })

        return attrs

    def update(self, instance, validated_data):
        decision_notes = validated_data.get("decision_notes", "")
        target_status = validated_data.get("status")

        if target_status == LeaveApplicationApproval.Status.APPROVED:
            return approve_leave_approval(instance, decision_notes)

        return reject_leave_approval(instance, decision_notes)
        
class ApproverSerializer(serializers.ModelSerializer):
    approval_type = serializers.ChoiceField(choices=Approver.ApprovalType.choices)
    employee_name = serializers.SerializerMethodField(read_only=True)
    division_name = serializers.CharField(source='division_id.division_name', read_only=True, allow_null=True)
    immediate_supervisor_name = serializers.SerializerMethodField(read_only=True)
    alt_supervisor_name = serializers.SerializerMethodField(read_only=True)
    division_chief_name = serializers.SerializerMethodField(read_only=True)
    alt_division_chief_name = serializers.SerializerMethodField(read_only=True)
    hr_approver_name = serializers.SerializerMethodField(read_only=True)
    alt_hr_approver_name = serializers.SerializerMethodField(read_only=True)

    def get_employee_name(self, obj):
        if obj.employee_id:
            return f"{obj.employee_id.first_name} {obj.employee_id.last_name}"
        return None

    def get_immediate_supervisor_name(self, obj):
        if obj.immediate_supervisor:
            return f"{obj.immediate_supervisor.first_name} {obj.immediate_supervisor.last_name}"
        return None

    def get_alt_supervisor_name(self, obj):
        if obj.alt_supervisor:
            return f"{obj.alt_supervisor.first_name} {obj.alt_supervisor.last_name}"
        return None

    def get_division_chief_name(self, obj):
        if obj.division_chief:
            return f"{obj.division_chief.first_name} {obj.division_chief.last_name}"
        return None

    def get_alt_division_chief_name(self, obj):
        if obj.alt_division_chief:
            return f"{obj.alt_division_chief.first_name} {obj.alt_division_chief.last_name}"
        return None

    def get_hr_approver_name(self, obj):
        if obj.hr_approver:
            return f"{obj.hr_approver.first_name} {obj.hr_approver.last_name}"
        return None

    def get_alt_hr_approver_name(self, obj):
        if obj.alt_hr_approver:
            return f"{obj.alt_hr_approver.first_name} {obj.alt_hr_approver.last_name}"
        return None

    class Meta:
        model = Approver
        fields = ['approver_id','approval_type',
                  'employee_id', 'employee_name', 
                  'division_id', 'division_name',
                  'immediate_supervisor', 'immediate_supervisor_name',
                  'alt_supervisor', 'alt_supervisor_name',
                  'division_chief', 'division_chief_name',
                  'alt_division_chief', 'alt_division_chief_name',
                  'hr_approver', 'hr_approver_name',
                  'alt_hr_approver', 'alt_hr_approver_name']
        
    def validate(self, data):
        def resolve(field_name):
            if field_name in data:
                return data[field_name]
            if self.instance is not None:
                return getattr(self.instance, field_name)
            return None

        approval_type = resolve('approval_type')
        division = resolve('division_id')
        employee = resolve('employee_id')

        immediate = resolve('immediate_supervisor')
        alt_supervisor = resolve('alt_supervisor')
        division_chief = resolve('division_chief')
        alt_division_chief = resolve('alt_division_chief')
        hr = resolve('hr_approver')
        alt_hr = resolve('alt_hr_approver')

        errors = {}

        if division and employee:
            errors.setdefault('non_field_errors', []).append(
                "Select either a division or an employee, not both."
            )

        if not division and not employee:
            errors.setdefault('non_field_errors', []).append(
                "Either division or employee must be provided."
            )

        if approval_type == Approver.ApprovalType.DIVISION and not division:
            errors['division_id'] = ["Approval type 'division' requires a division."]

        if approval_type == Approver.ApprovalType.EMPLOYEE and not employee:
            errors['employee_id'] = ["Approval type 'employee' requires an employee."]

        if not immediate:
            errors['immediate_supervisor'] = ["Immediate supervisor is required."]

        if not division_chief:
            errors['division_chief'] = ["Division chief is required."]

        if not hr:
            errors['hr_approver'] = ["HR approver is required."]

        approvers = [
            immediate,
            alt_supervisor,
            division_chief,
            alt_division_chief,
            hr,
            alt_hr,
        ]

        approver_ids = [
            approver.pk if hasattr(approver, 'pk') else approver
            for approver in approvers
            if approver is not None
        ]

        if len(approver_ids) != len(set(approver_ids)):
            errors.setdefault('non_field_errors', []).append(
                "The same employee cannot be assigned to multiple approver roles."
            )

        queryset = Approver.objects.all()
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        if approval_type == Approver.ApprovalType.DIVISION and division and queryset.filter(
            approval_type=approval_type,
            division_id=division,
        ).exists():
            errors.setdefault('division_id', []).append(
                "An approver record already exists for this division."
            )

        if approval_type == Approver.ApprovalType.EMPLOYEE and employee and queryset.filter(
            approval_type=approval_type,
            employee_id=employee,
        ).exists():
            errors.setdefault('employee_id', []).append(
                "An approver record already exists for this employee."
            )

        if errors:
            raise serializers.ValidationError(errors)

        return data


class HiringRequestSerializer(serializers.ModelSerializer):
    requestor_username = serializers.CharField(source="requestor_user.username", read_only=True)
    requestor_name = serializers.SerializerMethodField(read_only=True)
    requestor_role_label = serializers.CharField(source="get_requestor_role_display", read_only=True)
    division_name = serializers.CharField(source="division.division_name", read_only=True)
    position_name = serializers.CharField(source="position.position_name", read_only=True)
    plantilla_item_number = serializers.CharField(source="plantilla_item.item_number", read_only=True)
    approval_progress = serializers.SerializerMethodField(read_only=True)
    current_approval_role_label = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = HiringRequest
        fields = [
            "hiring_request_id",
            "request_no",
            "requestor_role",
            "requestor_role_label",
            "requestor_user",
            "requestor_username",
            "requestor_name",
            "division",
            "division_name",
            "position",
            "position_name",
            "plantilla_item",
            "plantilla_item_number",
            "headcount_requested",
            "employment_type",
            "hiring_reason",
            "target_start_date",
            "justification",
            "status",
            "current_approval_step",
            "current_approval_role_label",
            "approval_progress",
            "created",
            "modified",
            "created_by",
            "modified_by",
        ]
        read_only_fields = [
            "request_no",
            "requestor_user",
            "requestor_username",
            "requestor_name",
            "requestor_role_label",
            "current_approval_step",
            "current_approval_role_label",
            "approval_progress",
            "created",
            "modified",
        ]

    def get_requestor_name(self, obj):
        employee = get_user_employee(obj.requestor_user)
        if employee is None:
            return obj.requestor_user.username
        return f"{employee.first_name} {employee.last_name}"

    def get_approval_progress(self, obj):
        total = obj.approvals.count()
        if total == 0:
            return "No approval actions yet"
        approved = obj.approvals.filter(status=HiringRequestApproval.Status.APPROVED).count()
        return f"{approved} of {total} approval step(s) completed"

    def get_current_approval_role_label(self, obj):
        if not obj.current_approval_step:
            return ""
        return dict(HiringRequestApproval.ApprovalRole.choices).get(obj.current_approval_step, "")

    def validate(self, attrs):
        request = self.context.get("request")
        instance = getattr(self, "instance", None)
        current_status = instance.status if instance is not None else HiringRequest.Status.DRAFT

        requestor_role = attrs.get("requestor_role", getattr(instance, "requestor_role", None))
        division = attrs.get("division", getattr(instance, "division", None))
        position = attrs.get("position", getattr(instance, "position", None))
        plantilla_item = attrs.get("plantilla_item", getattr(instance, "plantilla_item", None))
        target_status = attrs.get("status", current_status)

        if request is None or not request.user.is_authenticated:
            raise serializers.ValidationError({
                "non_field_errors": ["Authentication is required to manage hiring requests."],
            })

        if instance is not None and "requestor_role" in attrs:
            raise serializers.ValidationError({
                "requestor_role": ["Requestor role cannot be changed after the request is created."],
            })

        if instance is None:
            try:
                requestor_role = resolve_hiring_requestor_role(request.user, requestor_role)
            except ValueError as exc:
                raise serializers.ValidationError({"requestor_role": [str(exc)]}) from exc
            attrs["requestor_role"] = requestor_role
            attrs["requestor_user"] = request.user
        else:
            if not can_access_hr_portal(request.user) and instance.requestor_user_id != request.user.pk:
                raise serializers.ValidationError({
                    "non_field_errors": ["Only the request owner or HR can update this hiring request."],
                })

        candidate = instance if instance is not None else HiringRequest(requestor_user=request.user)
        for key, value in attrs.items():
            setattr(candidate, key, value)

        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        if target_status == HiringRequest.Status.SUBMITTED:
            try:
                validate_hiring_request_route(
                    user=(instance.requestor_user if instance is not None else request.user),
                    requestor_role=candidate.requestor_role,
                    division=division,
                )
            except ValueError as exc:
                raise serializers.ValidationError({"status": [str(exc)]}) from exc

        if target_status == HiringRequest.Status.CANCELLED and current_status == HiringRequest.Status.APPROVED:
            raise serializers.ValidationError({
                "status": ["Approved hiring requests cannot be cancelled."],
            })

        if target_status == HiringRequest.Status.APPROVED and not can_access_hr_portal(request.user):
            raise serializers.ValidationError({
                "status": ["Hiring request approvals must be completed through the approval queue."],
            })

        if position is None:
            raise serializers.ValidationError({"position": ["This field is required."]})

        if division is None:
            raise serializers.ValidationError({"division": ["This field is required."]})

        if plantilla_item and (plantilla_item.position_id != position.pk or plantilla_item.division_id != division.pk):
            raise serializers.ValidationError({
                "plantilla_item": ["The selected plantilla item must match the request position and division."],
            })

        return attrs

    def create(self, validated_data):
        target_status = validated_data.pop("status", HiringRequest.Status.DRAFT)
        request = self.context.get("request")
        user = request.user
        validated_data.setdefault("created_by", user.username)
        validated_data.setdefault("modified_by", user.username)
        validated_data["status"] = HiringRequest.Status.DRAFT

        with transaction.atomic():
            hiring_request = HiringRequest.objects.create(**validated_data)
            if target_status == HiringRequest.Status.SUBMITTED:
                hiring_request.modified_by = user.username
                hiring_request.save(update_fields=["modified_by"])
                submit_hiring_request(hiring_request)

        return hiring_request

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = request.user
        target_status = validated_data.pop("status", instance.status)

        editable_statuses = {
            HiringRequest.Status.DRAFT,
            HiringRequest.Status.REJECTED,
            HiringRequest.Status.CANCELLED,
        }
        if (
            not can_access_hr_portal(user)
            and target_status != HiringRequest.Status.CANCELLED
            and instance.status not in editable_statuses
        ):
            raise serializers.ValidationError({
                "non_field_errors": ["You can only edit draft or rejected hiring requests."],
            })

        with transaction.atomic():
            for key, value in validated_data.items():
                setattr(instance, key, value)
            instance.modified_by = user.username
            instance.save()

            if target_status == HiringRequest.Status.SUBMITTED and instance.status != HiringRequest.Status.SUBMITTED:
                submit_hiring_request(instance)
            elif target_status == HiringRequest.Status.CANCELLED and instance.status != HiringRequest.Status.CANCELLED:
                cancel_hiring_request(instance)
            elif target_status != instance.status:
                instance.status = target_status
                instance.save(update_fields=["status", "modified"])

        instance.refresh_from_db()
        return instance


class HiringRequestApprovalSerializer(serializers.ModelSerializer):
    approver_username = serializers.CharField(source="approver_user.username", read_only=True)
    approver_name = serializers.SerializerMethodField(read_only=True)
    approver_role_label = serializers.CharField(source="get_approver_role_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    request_no = serializers.CharField(source="hiring_request.request_no", read_only=True)
    request_status = serializers.CharField(source="hiring_request.status", read_only=True)
    request_status_label = serializers.CharField(source="hiring_request.get_status_display", read_only=True)
    requestor_username = serializers.CharField(source="hiring_request.requestor_user.username", read_only=True)
    division = serializers.IntegerField(source="hiring_request.division.pk", read_only=True)
    division_name = serializers.CharField(source="hiring_request.division.division_name", read_only=True)
    position = serializers.IntegerField(source="hiring_request.position.pk", read_only=True)
    position_name = serializers.CharField(source="hiring_request.position.position_name", read_only=True)
    headcount_requested = serializers.IntegerField(source="hiring_request.headcount_requested", read_only=True)
    employment_type = serializers.CharField(source="hiring_request.employment_type", read_only=True)

    class Meta:
        model = HiringRequestApproval
        fields = [
            "hiring_request_approval_id",
            "hiring_request",
            "request_no",
            "request_status",
            "request_status_label",
            "approver_role",
            "approver_role_label",
            "approver_user",
            "approver_username",
            "approver_name",
            "sequence",
            "status",
            "status_label",
            "decision_notes",
            "acted_at",
            "requestor_username",
            "division",
            "division_name",
            "position",
            "position_name",
            "headcount_requested",
            "employment_type",
            "created",
            "modified",
        ]
        read_only_fields = [
            "hiring_request",
            "request_no",
            "request_status",
            "request_status_label",
            "approver_role",
            "approver_role_label",
            "approver_user",
            "approver_username",
            "approver_name",
            "sequence",
            "status_label",
            "acted_at",
            "requestor_username",
            "division",
            "division_name",
            "position",
            "position_name",
            "headcount_requested",
            "employment_type",
            "created",
            "modified",
        ]

    def get_approver_name(self, obj):
        employee = get_user_employee(obj.approver_user)
        if employee is None:
            return obj.approver_user.username
        return f"{employee.first_name} {employee.last_name}"

    def validate(self, attrs):
        request = self.context.get("request")
        target_status = attrs.get("status")

        if target_status not in {
            HiringRequestApproval.Status.APPROVED,
            HiringRequestApproval.Status.REJECTED,
        }:
            raise serializers.ValidationError({
                "status": ["Approval decisions must be either approved or rejected."],
            })

        if self.instance.status != HiringRequestApproval.Status.PENDING:
            raise serializers.ValidationError({
                "status": ["Only pending recruitment approvals can be acted on."],
            })

        if request is None or not request.user.is_authenticated:
            raise serializers.ValidationError({
                "non_field_errors": ["Authentication is required to approve hiring requests."],
            })

        if not can_access_hr_portal(request.user) and request.user.pk != self.instance.approver_user_id:
            raise serializers.ValidationError({
                "non_field_errors": ["This hiring request approval is not assigned to your account."],
            })

        return attrs

    def update(self, instance, validated_data):
        decision_notes = validated_data.get("decision_notes", "")
        target_status = validated_data.get("status")

        if target_status == HiringRequestApproval.Status.APPROVED:
            return approve_hiring_request_approval(instance, decision_notes)

        return reject_hiring_request_approval(instance, decision_notes)


class JobPostingSerializer(serializers.ModelSerializer):
    requestor_username = serializers.CharField(source="requestor_user.username", read_only=True)
    requestor_name = serializers.SerializerMethodField(read_only=True)
    requestor_role_label = serializers.CharField(source="get_requestor_role_display", read_only=True)
    prepared_by_hr_username = serializers.CharField(source="prepared_by_hr_user.username", read_only=True)
    division_name = serializers.CharField(source="division.division_name", read_only=True)
    position_name = serializers.CharField(source="position.position_name", read_only=True)
    plantilla_item_number = serializers.CharField(source="plantilla_item.item_number", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    portal_status_label = serializers.CharField(source="get_portal_status_display", read_only=True)
    approval_progress = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = JobPosting
        fields = [
            "job_posting_id",
            "posting_no",
            "hiring_request",
            "requestor_role",
            "requestor_role_label",
            "requestor_user",
            "requestor_username",
            "requestor_name",
            "prepared_by_hr_user",
            "prepared_by_hr_username",
            "division",
            "division_name",
            "position",
            "position_name",
            "plantilla_item",
            "plantilla_item_number",
            "job_title",
            "job_summary",
            "job_description",
            "qualifications",
            "employment_type",
            "work_location",
            "open_slots",
            "status",
            "status_label",
            "portal_status",
            "portal_status_label",
            "publish_start",
            "publish_end",
            "published_at",
            "approval_progress",
            "created",
            "modified",
            "created_by",
            "modified_by",
        ]
        read_only_fields = [
            "posting_no",
            "hiring_request",
            "requestor_role",
            "requestor_role_label",
            "requestor_user",
            "requestor_username",
            "requestor_name",
            "prepared_by_hr_user",
            "prepared_by_hr_username",
            "status_label",
            "portal_status_label",
            "published_at",
            "approval_progress",
            "created",
            "modified",
        ]

    EDIT_TRIGGER_FIELDS = {
        "job_title",
        "job_summary",
        "job_description",
        "qualifications",
        "employment_type",
        "work_location",
        "open_slots",
        "publish_start",
        "publish_end",
        "position",
        "division",
        "plantilla_item",
    }
    REAPPROVAL_TRIGGER_STATUSES = {
        JobPosting.Status.PENDING_HR_PUBLISH_APPROVAL,
        JobPosting.Status.PUBLISHED,
    }

    def get_requestor_name(self, obj):
        employee = get_user_employee(obj.requestor_user)
        if employee is None:
            return obj.requestor_user.username
        return f"{employee.first_name} {employee.last_name}"

    def get_approval_progress(self, obj):
        total = obj.approvals.count()
        if total == 0:
            return "No approval actions yet"
        approved = obj.approvals.filter(status=JobPostingApproval.Status.APPROVED).count()
        return f"{approved} of {total} approval step(s) completed"

    def validate(self, attrs):
        request = self.context.get("request")
        instance = getattr(self, "instance", None)

        if request is None or not request.user.is_authenticated:
            raise serializers.ValidationError({
                "non_field_errors": ["Authentication is required to manage job postings."],
            })

        if instance is None:
            raise serializers.ValidationError({
                "non_field_errors": ["Job postings are created automatically from approved hiring requests."],
            })

        candidate = instance
        for key, value in attrs.items():
            setattr(candidate, key, value)

        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        explicit_status = attrs.get("status")
        if explicit_status == JobPosting.Status.PUBLISHED:
            raise serializers.ValidationError({
                "status": ["Publishing must be completed through the approval queue."],
            })

        if explicit_status == JobPosting.Status.PENDING_HR_PUBLISH_APPROVAL:
            raise serializers.ValidationError({
                "status": ["HR publish approval is completed through the approval queue."],
            })

        if (
            explicit_status == JobPosting.Status.PENDING_REQUESTOR_APPROVAL
            and not set(attrs.keys()).intersection(self.EDIT_TRIGGER_FIELDS)
        ):
            raise serializers.ValidationError({
                "status": ["Update the posting details before submitting for approval."],
            })

        return attrs

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = request.user
        target_status = validated_data.pop("status", instance.status)
        changed_fields = set(validated_data.keys())

        with transaction.atomic():
            for key, value in validated_data.items():
                setattr(instance, key, value)
            if changed_fields:
                instance.modified_by = user.username
                instance.save()

            if (
                changed_fields.intersection(self.EDIT_TRIGGER_FIELDS)
                and instance.status in self.REAPPROVAL_TRIGGER_STATUSES
            ):
                revert_job_posting_to_draft(instance)

            if target_status == JobPosting.Status.PENDING_REQUESTOR_APPROVAL:
                submit_job_posting_for_requestor_approval(instance, user)
            elif target_status == JobPosting.Status.UNPUBLISHED:
                instance.status = JobPosting.Status.UNPUBLISHED
                instance.portal_status = JobPosting.PortalStatus.HIDDEN
                instance.modified_by = user.username
                instance.save(update_fields=["status", "portal_status", "modified_by", "modified"])
            elif target_status == JobPosting.Status.CLOSED:
                instance.status = JobPosting.Status.CLOSED
                instance.portal_status = JobPosting.PortalStatus.CLOSED
                instance.modified_by = user.username
                instance.save(update_fields=["status", "portal_status", "modified_by", "modified"])

        instance.refresh_from_db()
        return instance


class JobPostingApprovalSerializer(serializers.ModelSerializer):
    approver_username = serializers.CharField(source="approver_user.username", read_only=True)
    approver_name = serializers.SerializerMethodField(read_only=True)
    approver_role_label = serializers.CharField(source="get_approver_role_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    posting_no = serializers.CharField(source="job_posting.posting_no", read_only=True)
    posting_status = serializers.CharField(source="job_posting.status", read_only=True)
    posting_status_label = serializers.CharField(source="job_posting.get_status_display", read_only=True)
    job_title = serializers.CharField(source="job_posting.job_title", read_only=True)
    division_name = serializers.CharField(source="job_posting.division.division_name", read_only=True)
    position_name = serializers.CharField(source="job_posting.position.position_name", read_only=True)

    class Meta:
        model = JobPostingApproval
        fields = [
            "job_posting_approval_id",
            "job_posting",
            "posting_no",
            "posting_status",
            "posting_status_label",
            "approver_role",
            "approver_role_label",
            "approver_user",
            "approver_username",
            "approver_name",
            "sequence",
            "status",
            "status_label",
            "decision_notes",
            "acted_at",
            "job_title",
            "division_name",
            "position_name",
            "created",
            "modified",
        ]
        read_only_fields = [
            "job_posting",
            "posting_no",
            "posting_status",
            "posting_status_label",
            "approver_role",
            "approver_role_label",
            "approver_user",
            "approver_username",
            "approver_name",
            "sequence",
            "status_label",
            "acted_at",
            "job_title",
            "division_name",
            "position_name",
            "created",
            "modified",
        ]

    def get_approver_name(self, obj):
        employee = get_user_employee(obj.approver_user)
        if employee is None:
            return obj.approver_user.username
        return f"{employee.first_name} {employee.last_name}"

    def validate(self, attrs):
        request = self.context.get("request")
        target_status = attrs.get("status")

        if target_status not in {
            JobPostingApproval.Status.APPROVED,
            JobPostingApproval.Status.REJECTED,
        }:
            raise serializers.ValidationError({
                "status": ["Job posting decisions must be either approved or rejected."],
            })

        if self.instance.status != JobPostingApproval.Status.PENDING:
            raise serializers.ValidationError({
                "status": ["Only pending job posting approvals can be acted on."],
            })

        if request is None or not request.user.is_authenticated:
            raise serializers.ValidationError({
                "non_field_errors": ["Authentication is required to approve job postings."],
            })

        if not can_access_hr_portal(request.user) and request.user.pk != self.instance.approver_user_id:
            raise serializers.ValidationError({
                "non_field_errors": ["This job posting approval is not assigned to your account."],
            })

        return attrs

    def update(self, instance, validated_data):
        decision_notes = validated_data.get("decision_notes", "")
        target_status = validated_data.get("status")

        if target_status == JobPostingApproval.Status.APPROVED:
            return approve_job_posting_approval(instance, decision_notes)

        return reject_job_posting_approval(instance, decision_notes)


class PublicJobPostingSerializer(serializers.ModelSerializer):
    division_name = serializers.CharField(source="division.division_name", read_only=True)
    position_name = serializers.CharField(source="position.position_name", read_only=True)

    class Meta:
        model = JobPosting
        fields = [
            "job_posting_id",
            "posting_no",
            "job_title",
            "job_summary",
            "job_description",
            "qualifications",
            "employment_type",
            "work_location",
            "open_slots",
            "division_name",
            "position_name",
            "publish_start",
            "publish_end",
        ]
