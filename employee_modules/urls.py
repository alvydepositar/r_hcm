from django.urls import path
from . import views
urlpatterns = [
    path("leave-portal/", views.employee_leave_portal, name="employee_leave_portal"),
    path("leave-history/", views.employee_leave_history, name="employee_leave_history"),
    path("leave-approvals/", views.employee_leave_approval_queue, name="employee_leave_approval_queue"),
]
