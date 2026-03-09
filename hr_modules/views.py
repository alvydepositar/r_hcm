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

def personal_data_sheet(request):
    return render(request, 'employee/personal_data_sheet.html')

# Core Views
def divisions(request):
    return render(request, 'employee/divisions.html')

def positions(request):
    return render(request, 'employee/positions.html')

def time_rules(request):
    return render(request, 'employee/time_rules.html')

def salary_grades(request):
    return render(request, 'employee/salary_grades.html')

def csc_plantilla(request):
    return render(request, 'employee/csc_plantilla.html')

def approvers(request):
    context = {
        'divisions': Division.objects.order_by('division_name'),
        'employees': Employee.objects.order_by('first_name', 'last_name'),
    }
    return render(request, 'employee/approvers.html', context)
