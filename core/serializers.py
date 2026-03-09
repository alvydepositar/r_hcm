from rest_framework import serializers

from employee_modules.models import Employee
from core.models import Division, Position, TimeRule
from hr_modules.models import Approver

class EmployeeSerializer(serializers.ModelSerializer):
    division_name = serializers.CharField(source='division.division_name', read_only=True)
    position_name = serializers.CharField(source='position.position_name', read_only=True)
    
    class Meta:
        model = Employee
        fields = ['id','employee_id','first_name','last_name','middle_name',
                  'name_extension','position','division','division_name', 'position_name']

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
        
class ApproverSerializer(serializers.ModelSerializer):
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
        approval_type = data.get('approval_type')
        division = data.get('division_id')
        employee = data.get('employee_id')

        immediate = data.get('immediate_supervisor')
        division_chief = data.get('division_chief')
        hr = data.get('hr_approver')

        if division and employee:
            raise serializers.ValidationError(
                "Select either a division or an employee, not both."
            )

        if not division and not employee and not self.instance:            
            raise serializers.ValidationError(
                "Either division or employee must be provided."
            )

        if approval_type == 'division' and not division:
            raise serializers.ValidationError(
                "Approval type 'division' requires a division."
            )

        if approval_type == 'employee' and not employee:
            raise serializers.ValidationError(
                "Approval type 'employee' requires an employee."
            )

        if not immediate and not self.instance:
            raise serializers.ValidationError(
                "Immediate supervisor is required."
            )

        if not division_chief and not self.instance:
            raise serializers.ValidationError(
                "Division chief is required."
            )

        if not hr and not self.instance:
            raise serializers.ValidationError(
                "HR approver is required."
            )

        approvers = [
            immediate,
            data.get('alt_supervisor'),
            division_chief,
            data.get('alt_division_chief'),
            hr,
            data.get('alt_hr_approver'),
        ]

        clean = [a for a in approvers if a is not None]

        if len(clean) != len(set(clean)):
            raise serializers.ValidationError(
                "The same employee cannot be assigned to multiple approver roles."
            )

        return data