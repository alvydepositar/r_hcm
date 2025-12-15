from rest_framework import serializers

from employee_modules.models import Employee
from core.models import Division

class EmployeeSerializer(serializers.ModelSerializer):
    division_name = serializers.CharField(source='division.division_name', read_only=True)
    
    class Meta:
        model = Employee
        fields = ['id','employee_id','first_name','last_name','middle_name',
                  'name_extension','position','division','division_name']

class DivisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Division
        fields = "__all__"
