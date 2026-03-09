from multiprocessing import context
from django.shortcuts import render
from employee_modules.models import Employee
from core.models import Division

# Dashboard Views
def employee_management(request):
    total_employees = Employee.objects.count()
    division_groups = Division.objects.count()
    
    context = {
        'total_employees': total_employees,
        'division_groups': division_groups,
    }
    return render(request, 'employee_management.html', context)

def leave_management(request):
    return render(request, 'leave_management.html')

def oba_management(request):
    return render(request, 'oba_management.html')

def cc_management(request):
    return render(request, 'cc_management.html')

# Employee Views
def employee_info(request):
    return render(request, 'employee/employee_info.html')

# Core Views
def divisions(request):
    return render(request, 'employee/divisions.html')

def positions(request):
    return render(request, 'employee/positions.html')

def time_rules(request):
    return render(request, 'employee/time_rules.html')

def approvers(request):
    return render(request, 'employee/approvers.html')