from django.contrib.auth import views as auth_views
from django.urls import path, include
from . import views
from .views import (
    ApproverViewSet,
    CSCPlantillaViewSet,
    DivisionViewSet,
    EmployeeViewSet,
    EmployeePersonalDataSheetViewSet,
    EmployeeLeaveCreditLedgerViewSet,
    EmployeeLeaveCreditViewSet,
    LeaveApplicationViewSet,
    LeaveApplicationApprovalViewSet,
    LeaveTypeViewSet,
    PositionViewSet,
    SalaryGradeViewSet,
    TimeRuleViewSet,
)

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet)
router.register(r'personal-data-sheets', EmployeePersonalDataSheetViewSet)
router.register(r'divisions', DivisionViewSet)
router.register(r'positions', PositionViewSet)
router.register(r'time_rules', TimeRuleViewSet)
router.register(r'salary_grades', SalaryGradeViewSet)
router.register(r'csc-plantilla', CSCPlantillaViewSet)
router.register(r'leave-types', LeaveTypeViewSet)
router.register(r'leave-credits', EmployeeLeaveCreditViewSet)
router.register(r'leave-credit-ledger', EmployeeLeaveCreditLedgerViewSet)
router.register(r'leave-applications', LeaveApplicationViewSet)
router.register(r'leave-approvals', LeaveApplicationApprovalViewSet)
router.register(r'approvers', ApproverViewSet)

urlpatterns = [
    path('', name='index', view=views.index),
    path(
        "login/",
        auth_views.LoginView.as_view(template_name="registration/login.html", redirect_authenticated_user=True),
        name="login",
    ),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
   
    # API URLs
    path('api/', include(router.urls)),
]
