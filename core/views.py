from django.shortcuts import render
from rest_framework.viewsets import ModelViewSet

from core.models import CSCPlantilla, Division, Position, SalaryGrade, TimeRule
from core.serializers import (
    ApproverSerializer,
    CSCPlantillaSerializer,
    DivisionSerializer,
    EmployeeSerializer,
    EmployeePersonalDataSheetSerializer,
    PositionSerializer,
    SalaryGradeSerializer,
    TimeRuleSerializer,
)
from employee_modules.models import Employee, EmployeePersonalDataSheet
from hr_modules.models import Approver

# Create your views here.
def index(request):
    return render(request, 'dashboard.html')

class EmployeeViewSet(ModelViewSet):
    queryset = Employee.objects.select_related('position', 'division').all()
    serializer_class = EmployeeSerializer


class EmployeePersonalDataSheetViewSet(ModelViewSet):
    queryset = EmployeePersonalDataSheet.objects.select_related(
        'employee',
        'employee__position',
        'employee__division',
    ).all()
    serializer_class = EmployeePersonalDataSheetSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get('employee')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset
    
class DivisionViewSet(ModelViewSet):
    queryset = Division.objects.all()
    serializer_class = DivisionSerializer
    
class PositionViewSet(ModelViewSet):
    queryset = Position.objects.all()
    serializer_class = PositionSerializer
    
class TimeRuleViewSet(ModelViewSet):
    queryset = TimeRule.objects.all()
    serializer_class = TimeRuleSerializer


class SalaryGradeViewSet(ModelViewSet):
    queryset = SalaryGrade.objects.all()
    serializer_class = SalaryGradeSerializer


class CSCPlantillaViewSet(ModelViewSet):
    queryset = CSCPlantilla.objects.select_related(
        "position",
        "division",
        "salary_grade",
    ).all()
    serializer_class = CSCPlantillaSerializer
    
class ApproverViewSet(ModelViewSet):
    queryset = Approver.objects.select_related(
        'division_id',
        'employee_id',
        'immediate_supervisor',
        'alt_supervisor',
        'division_chief',
        'alt_division_chief',
        'hr_approver',
        'alt_hr_approver',
    ).all()
    serializer_class = ApproverSerializer
