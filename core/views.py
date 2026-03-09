from django.shortcuts import render
from rest_framework.viewsets import ModelViewSet

from core.serializers import *
from employee_modules.models import Employee
from core.models import *

# Create your views here.
def index(request):
    return render(request, 'dashboard.html')

class EmployeeViewSet(ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    
class DivisionViewSet(ModelViewSet):
    queryset = Division.objects.all()
    serializer_class = DivisionSerializer
    
class PositionViewSet(ModelViewSet):
    queryset = Position.objects.all()
    serializer_class = PositionSerializer
    
class TimeRuleViewSet(ModelViewSet):
    queryset = TimeRule.objects.all()
    serializer_class = TimeRuleSerializer
    
class ApproverViewSet(ModelViewSet):
    queryset = Approver.objects.all()
    serializer_class = ApproverSerializer