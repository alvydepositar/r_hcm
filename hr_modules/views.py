from django.shortcuts import render
from rest_framework.viewsets import ModelViewSet
from .models import Employee
from .serializers import EmployeeSerializer

# Dashboard Views
def employee_management(request):
    return render(request, 'employee_management.html')

def leave_management(request):
    return render(request, 'leave_management.html')

def oba_management(request):
    return render(request, 'oba_management.html')

def cc_management(request):
    return render(request, 'cc_management.html')

# Employee Views
def employee_info(request):
    return render(request, 'employee/employee_info.html')

class EmployeeViewSet(ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer