from django.shortcuts import render
from rest_framework.viewsets import ModelViewSet

from core.serializers import DivisionSerializer, EmployeeSerializer
from employee_modules.models import Employee
from core.models import Division

# Create your views here.
def index(request):
    return render(request, 'dashboard.html')

class EmployeeViewSet(ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    
class DivisionViewSet(ModelViewSet):
    queryset = Division.objects.all()
    serializer_class = DivisionSerializer