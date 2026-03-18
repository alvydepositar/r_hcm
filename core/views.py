from decimal import Decimal

from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.shortcuts import render
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from core.models import (
    CSCPlantilla,
    Division,
    EmployeeLeaveCredit,
    EmployeeLeaveCreditLedger,
    LeaveApplication,
    LeaveApplicationApproval,
    LeaveType,
    Position,
    SalaryGrade,
    TimeRule,
)
from core.permissions import IsAuthenticatedAndHR, IsAuthenticatedAndHROrReadOnly
from core.rbac import can_access_hr_portal, get_user_employee
from core.serializers import (
    ApproverSerializer,
    CSCPlantillaSerializer,
    DivisionSerializer,
    EmployeeSerializer,
    EmployeePersonalDataSheetSerializer,
    EmployeeLeaveCreditLedgerSerializer,
    EmployeeLeaveCreditSerializer,
    LeaveApplicationSerializer,
    LeaveApplicationApprovalSerializer,
    LeaveTypeSerializer,
    PositionSerializer,
    SalaryGradeSerializer,
    TimeRuleSerializer,
)
from employee_modules.models import Employee, EmployeePersonalDataSheet
from hr_modules.models import Approver

# Create your views here.
@login_required
def index(request):
    return render(request, 'dashboard.html')


class EmployeeViewSet(ModelViewSet):
    queryset = Employee.objects.select_related('position', 'division').all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticatedAndHR]


class EmployeePersonalDataSheetViewSet(ModelViewSet):
    queryset = EmployeePersonalDataSheet.objects.select_related(
        'employee',
        'employee__position',
        'employee__division',
        'employee__user',
    ).all()
    serializer_class = EmployeePersonalDataSheetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        if not can_access_hr_portal(self.request.user):
            employee = get_user_employee(self.request.user)
            queryset = queryset.filter(employee=employee) if employee else queryset.none()

        employee_id = self.request.query_params.get('employee')
        if employee_id and can_access_hr_portal(self.request.user):
            queryset = queryset.filter(employee_id=employee_id)
        return queryset

    def perform_create(self, serializer):
        if can_access_hr_portal(self.request.user):
            serializer.save()
            return

        employee = get_user_employee(self.request.user)
        if employee is None:
            raise PermissionDenied("A linked employee record is required.")

        if serializer.validated_data.get("employee") != employee:
            raise PermissionDenied("You can only create your own personal data sheet.")

        serializer.save()

    def perform_update(self, serializer):
        if can_access_hr_portal(self.request.user):
            serializer.save()
            return

        employee = get_user_employee(self.request.user)
        if employee is None or self.get_object().employee != employee:
            raise PermissionDenied("You can only update your own personal data sheet.")

        serializer.save()


class DivisionViewSet(ModelViewSet):
    queryset = Division.objects.all()
    serializer_class = DivisionSerializer
    permission_classes = [IsAuthenticatedAndHR]


class PositionViewSet(ModelViewSet):
    queryset = Position.objects.select_related("standard_salary_grade").all()
    serializer_class = PositionSerializer
    permission_classes = [IsAuthenticatedAndHR]


class TimeRuleViewSet(ModelViewSet):
    queryset = TimeRule.objects.all()
    serializer_class = TimeRuleSerializer
    permission_classes = [IsAuthenticatedAndHR]


class SalaryGradeViewSet(ModelViewSet):
    queryset = SalaryGrade.objects.all()
    serializer_class = SalaryGradeSerializer
    permission_classes = [IsAuthenticatedAndHR]


class CSCPlantillaViewSet(ModelViewSet):
    queryset = CSCPlantilla.objects.select_related(
        "position",
        "position__standard_salary_grade",
        "division",
        "salary_grade",
    ).all()
    serializer_class = CSCPlantillaSerializer
    permission_classes = [IsAuthenticatedAndHR]

    def get_queryset(self):
        queryset = super().get_queryset()
        availability_status = self.request.query_params.get("availability_status")
        if availability_status:
            queryset = queryset.filter(availability_status=availability_status)
        return queryset


class LeaveTypeViewSet(ModelViewSet):
    queryset = LeaveType.objects.select_related("rule").all()
    serializer_class = LeaveTypeSerializer
    permission_classes = [IsAuthenticatedAndHROrReadOnly]


class EmployeeLeaveCreditViewSet(ModelViewSet):
    queryset = EmployeeLeaveCredit.objects.select_related(
        "employee",
        "employee__position",
        "employee__division",
        "linked_leave_type",
    ).all()
    serializer_class = EmployeeLeaveCreditSerializer
    permission_classes = [IsAuthenticatedAndHROrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        if not can_access_hr_portal(self.request.user):
            employee = get_user_employee(self.request.user)
            queryset = queryset.filter(employee=employee) if employee else queryset.none()

        employee_id = self.request.query_params.get("employee")
        bucket_code = self.request.query_params.get("bucket_code")

        if employee_id and can_access_hr_portal(self.request.user):
            queryset = queryset.filter(employee_id=employee_id)

        if bucket_code:
            queryset = queryset.filter(bucket_code=bucket_code)

        return queryset


class EmployeeLeaveCreditLedgerViewSet(ModelViewSet):
    queryset = EmployeeLeaveCreditLedger.objects.select_related(
        "leave_credit",
        "leave_credit__employee",
    ).all()
    serializer_class = EmployeeLeaveCreditLedgerSerializer
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        if not can_access_hr_portal(self.request.user):
            employee = get_user_employee(self.request.user)
            queryset = queryset.filter(leave_credit__employee=employee) if employee else queryset.none()

        leave_credit_id = self.request.query_params.get("leave_credit")
        employee_id = self.request.query_params.get("employee")

        if leave_credit_id:
            queryset = queryset.filter(leave_credit_id=leave_credit_id)

        if employee_id and can_access_hr_portal(self.request.user):
            queryset = queryset.filter(leave_credit__employee_id=employee_id)

        return queryset


class LeaveApplicationViewSet(ModelViewSet):
    queryset = LeaveApplication.objects.select_related(
        "employee",
        "employee__position",
        "employee__division",
        "employee__user",
        "leave_type",
        "leave_type__rule",
    ).all()
    serializer_class = LeaveApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        if not can_access_hr_portal(self.request.user):
            employee = get_user_employee(self.request.user)
            queryset = queryset.filter(employee=employee) if employee else queryset.none()

        employee_id = self.request.query_params.get("employee")
        status = self.request.query_params.get("status")

        if employee_id and can_access_hr_portal(self.request.user):
            queryset = queryset.filter(employee_id=employee_id)

        if status:
            queryset = queryset.filter(status=status)

        return queryset

    def perform_create(self, serializer):
        if can_access_hr_portal(self.request.user):
            serializer.save()
            return

        employee = get_user_employee(self.request.user)
        if employee is None:
            raise PermissionDenied("A linked employee record is required.")

        if serializer.validated_data.get("employee") != employee:
            raise PermissionDenied("You can only file leave for your own account.")

        serializer.save()

    def perform_update(self, serializer):
        if can_access_hr_portal(self.request.user):
            serializer.save()
            return

        instance = self.get_object()
        employee = get_user_employee(self.request.user)

        if employee is None or instance.employee != employee:
            raise PermissionDenied("You can only update your own leave applications.")

        mutable_fields = set(serializer.validated_data.keys())
        if mutable_fields != {"status"} or serializer.validated_data.get("status") != LeaveApplication.Status.CANCELLED:
            raise PermissionDenied("Employees may only cancel their own submitted leave applications.")

        if instance.status != LeaveApplication.Status.SUBMITTED:
            raise PermissionDenied("Only submitted leave applications can be cancelled.")

        serializer.save()

    def perform_destroy(self, instance):
        if not can_access_hr_portal(self.request.user):
            raise PermissionDenied("Only HR users can delete leave applications.")

        with transaction.atomic():
            if (
                instance.status == LeaveApplication.Status.APPROVED
                and instance.balance_bucket_code
                and (instance.deducted_units or Decimal("0.00")) > Decimal("0.00")
            ):
                credit = EmployeeLeaveCredit.objects.get(
                    employee=instance.employee,
                    bucket_code=instance.balance_bucket_code,
                )
                new_balance = credit.current_balance + instance.deducted_units
                credit.current_balance = new_balance
                credit.save(update_fields=["current_balance", "modified"])

                EmployeeLeaveCreditLedger.objects.create(
                    leave_credit=credit,
                    entry_type=EmployeeLeaveCreditLedger.EntryType.REVERSAL,
                    units_delta=instance.deducted_units,
                    balance_after=new_balance,
                    effective_date=timezone.localdate(),
                    reference_type="leave_application",
                    reference_id=str(instance.leave_application_id),
                    notes="Reversal after leave application deletion.",
                )

            instance.delete()


class LeaveApplicationApprovalViewSet(ModelViewSet):
    queryset = LeaveApplicationApproval.objects.select_related(
        "leave_application",
        "leave_application__employee",
        "leave_application__employee__position",
        "leave_application__employee__division",
        "leave_application__leave_type",
        "approver_employee",
        "approver_employee__position",
        "approver_employee__division",
    ).all()
    serializer_class = LeaveApplicationApprovalSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        queryset = super().get_queryset()
        status = self.request.query_params.get("status")

        if not can_access_hr_portal(self.request.user):
            employee = get_user_employee(self.request.user)
            queryset = queryset.filter(approver_employee=employee) if employee else queryset.none()

        if status:
            queryset = queryset.filter(status=status)

        return queryset


class ApproverViewSet(ModelViewSet):
    queryset = Approver.objects.select_related(
        'division_id',
        'employee_id',
        'immediate_supervisor',
        'alt_supervisor',
        'division_chief',
        'alt_division_chief',
        'hr_approver',
        'alt_hr_approver',
    ).all()
    serializer_class = ApproverSerializer
    permission_classes = [IsAuthenticatedAndHR]
