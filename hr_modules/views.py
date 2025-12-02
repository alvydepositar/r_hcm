from django.shortcuts import render

# Create your views here.
def employee_management(request):
    return render(request, 'employee_management.html')

def leave_management(request):
    return render(request, 'leave_management.html')

def oba_management(request):
    return render(request, 'oba_management.html')

def cc_management(request):
    return render(request, 'cc_management.html')