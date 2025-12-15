from django.shortcuts import render
from employee_modules.models import Employee
from core.models import Division

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