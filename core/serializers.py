from rest_framework import serializers

from employee_modules.models import Employee, EmployeePersonalDataSheet
from core.models import CSCPlantilla, Division, Position, SalaryGrade, TimeRule
from hr_modules.models import Approver

class EmployeeSerializer(serializers.ModelSerializer):
    division_name = serializers.CharField(source='division.division_name', read_only=True)
    position_name = serializers.CharField(source='position.position_name', read_only=True)
    
    class Meta:
        model = Employee
        fields = ['id','employee_id','first_name','last_name','middle_name',
                  'name_extension','position','division','division_name', 'position_name']


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

class DivisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Division
        fields = "__all__"

class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = "__all__"
        
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

    class Meta:
        model = CSCPlantilla
        fields = [
            "plantilla_id",
            "item_number",
            "position",
            "position_name",
            "division",
            "division_name",
            "salary_grade",
            "csc_grade",
            "salary_step",
            "monthly_salary",
            "annual_salary",
            "created",
            "modified",
            "created_by",
            "modified_by",
        ]

    def validate(self, attrs):
        salary_grade = attrs["salary_grade"] if "salary_grade" in attrs else getattr(self.instance, "salary_grade", None)
        salary_step = attrs["salary_step"] if "salary_step" in attrs else getattr(self.instance, "salary_step", None)

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
