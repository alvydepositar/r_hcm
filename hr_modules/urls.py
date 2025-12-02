from django.urls import path, include
from . import views

urlpatterns = [
    path('employee-management/', views.employee_management, name='employee_management'),
    path('leave-management/', views.leave_management, name='leave_management'),
    path('oba-management/', views.oba_management, name='oba_management'),
    path('cc-management/', views.cc_management, name='cc_management'),
]