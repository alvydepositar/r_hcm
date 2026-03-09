from django.urls import path, include
from . import views

urlpatterns = [
    # Dashboard URLs
    path('employee-management/', views.employee_management, name='employee_management'),
    path('leave-management/', views.leave_management, name='leave_management'),
    path('oba-management/', views.oba_management, name='oba_management'),
    path('cc-management/', views.cc_management, name='cc_management'),
    # Employee URLs
    path('employee-info/', views.employee_info, name='employee_info'),
    path('approvers/', views.approvers, name='approvers'),
    # Core URLs
    path('divisions/', views.divisions, name='divisions'),
    path('positions/', views.positions, name='positions'),
    path('time-rules/', views.time_rules, name='time_rules'),
]