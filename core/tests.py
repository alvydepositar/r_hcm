from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from employee_modules.models import Employee

from core.models import (
    CSCPlantilla,
    Division,
    EmployeeLeaveCredit,
    EmployeeLeaveCreditLedger,
    LeaveApplication,
    LeaveType,
    Position,
    SalaryGrade,
)


class SalaryGradeTests(TestCase):
    def test_salary_grade_string_representation(self):
        salary_grade = SalaryGrade.objects.get(csc_grade=11)

        self.assertEqual(str(salary_grade), "Salary Grade 11")

    def test_salary_grade_seed_data_is_loaded(self):
        salary_grade = SalaryGrade.objects.get(csc_grade=33)

        self.assertEqual(SalaryGrade.objects.count(), 33)
        self.assertEqual(str(salary_grade.step_1), "449157.00")
        self.assertEqual(str(salary_grade.step_2), "462329.00")
        self.assertIsNone(salary_grade.step_3)
        self.assertIsNone(salary_grade.step_8)

    def test_salary_grade_page_renders(self):
        response = self.client.get(reverse("salary_grades"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "CSC Salary Grade")
        self.assertContains(response, "Step 1")
        self.assertContains(response, "Step 8")

    def test_salary_grade_api_crud(self):
        create_response = self.client.post(
            "/api/salary_grades/",
            data={
                "csc_grade": 34,
                "step_1": "28000.00",
                "step_2": "28500.00",
                "step_3": "29000.00",
                "step_4": "29500.00",
                "step_5": "30000.00",
                "step_6": "30500.00",
                "step_7": "31000.00",
                "step_8": "31500.00",
            },
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, 201)
        salary_grade_id = create_response.json()["salary_grade_id"]

        list_response = self.client.get("/api/salary_grades/")
        self.assertEqual(list_response.status_code, 200)
        created_row = next(
            row for row in list_response.json() if row["csc_grade"] == 34
        )
        self.assertEqual(created_row["step_1"], "28000.00")

        patch_response = self.client.patch(
            f"/api/salary_grades/{salary_grade_id}/",
            data={"step_8": "32000.00"},
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.json()["step_8"], "32000.00")

        delete_response = self.client.delete(f"/api/salary_grades/{salary_grade_id}/")
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(SalaryGrade.objects.filter(pk=salary_grade_id).exists())


class CSCPlantillaTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.salary_grade_11 = SalaryGrade.objects.get(csc_grade=11)
        cls.salary_grade_15 = SalaryGrade.objects.get(csc_grade=15)
        cls.salary_grade_33 = SalaryGrade.objects.get(csc_grade=33)
        cls.division = Division.objects.create(
            division_name="Plantilla Test Division",
            division_abbreviation="PTD",
        )
        cls.position = Position.objects.create(
            position_name="Plantilla Test Position",
            standard_salary_grade=cls.salary_grade_11,
        )
        cls.position_grade_33 = Position.objects.create(
            position_name="Plantilla Test Position SG33",
            standard_salary_grade=cls.salary_grade_33,
        )

    def test_csc_plantilla_seed_data_is_loaded(self):
        plantilla = CSCPlantilla.objects.get(item_number="CSC-HRMD-HRMO4-001-2026")

        self.assertEqual(CSCPlantilla.objects.count(), 12)
        self.assertEqual(plantilla.division.division_abbreviation, "HRMD")
        self.assertEqual(plantilla.position.position_name, "Human Resource Management Officer IV")
        self.assertEqual(plantilla.position.standard_salary_grade.csc_grade, 22)
        self.assertEqual(plantilla.salary_grade.csc_grade, 22)
        self.assertEqual(plantilla.salary_step, 2)
        self.assertEqual(str(plantilla.monthly_salary_amount), "82963.00")
        self.assertEqual(plantilla.availability_status, "filled")

    def test_csc_plantilla_model_uses_salary_matrix(self):
        plantilla = CSCPlantilla(
            item_number="PLT-001",
            position=self.position,
            division=self.division,
            salary_grade=self.salary_grade_11,
            salary_step=3,
        )

        plantilla.full_clean()

        self.assertEqual(str(plantilla.monthly_salary_amount), "32109.00")
        self.assertEqual(str(plantilla.annual_salary_amount), "385308.00")

    def test_csc_plantilla_page_renders(self):
        response = self.client.get(reverse("csc_plantilla"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "CSC Plantilla")
        self.assertContains(response, "Plantilla Item No.")
        self.assertContains(response, "Monthly Salary")
        self.assertContains(response, "Show Vacancies Only")

    def test_csc_plantilla_api_crud(self):
        create_response = self.client.post(
            "/api/csc-plantilla/",
            data={
                "item_number": "PLT-001",
                "position": self.position.pk,
                "division": self.division.pk,
                "salary_grade": self.salary_grade_11.pk,
                "salary_step": 3,
            },
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, 201)
        created_row = create_response.json()
        self.assertEqual(created_row["position_standard_csc_grade"], 11)
        self.assertEqual(created_row["csc_grade"], 11)
        self.assertEqual(created_row["availability_status"], "vacant")
        self.assertTrue(created_row["is_vacant"])
        self.assertEqual(created_row["monthly_salary"], "32109.00")
        self.assertEqual(created_row["annual_salary"], "385308.00")

        plantilla_id = created_row["plantilla_id"]

        list_response = self.client.get("/api/csc-plantilla/")
        self.assertEqual(list_response.status_code, 200)
        listed_row = next(
            row for row in list_response.json() if row["item_number"] == "PLT-001"
        )
        self.assertEqual(listed_row["item_number"], "PLT-001")

        patch_response = self.client.patch(
            f"/api/csc-plantilla/{plantilla_id}/",
            data={"salary_step": 4},
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.json()["monthly_salary"], "32401.00")
        self.assertEqual(patch_response.json()["annual_salary"], "388812.00")

        delete_response = self.client.delete(f"/api/csc-plantilla/{plantilla_id}/")
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(CSCPlantilla.objects.filter(pk=plantilla_id).exists())

    def test_csc_plantilla_rejects_unpublished_salary_step(self):
        response = self.client.post(
            "/api/csc-plantilla/",
            data={
                "item_number": "PLT-033",
                "position": self.position_grade_33.pk,
                "division": self.division.pk,
                "salary_grade": self.salary_grade_33.pk,
                "salary_step": 3,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("salary_step", response.json())

    def test_csc_plantilla_rejects_salary_grade_not_matching_position_mapping(self):
        response = self.client.post(
            "/api/csc-plantilla/",
            data={
                "item_number": "PLT-MISMATCH",
                "position": self.position.pk,
                "division": self.division.pk,
                "salary_grade": self.salary_grade_15.pk,
                "salary_step": 1,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("salary_grade", response.json())


class LeaveTypeTests(TestCase):
    def test_leave_type_seed_data_is_loaded(self):
        wellness_leave = LeaveType.objects.get(leave_code="WELL")
        maternity_leave = LeaveType.objects.get(leave_code="ML")

        self.assertEqual(LeaveType.objects.count(), 16)
        self.assertEqual(wellness_leave.category, LeaveType.Category.WELLNESS)
        self.assertEqual(str(wellness_leave.rule.entitlement_value), "5.00")
        self.assertEqual(wellness_leave.rule.entitlement_period, "per_year")
        self.assertEqual(maternity_leave.rule.entitlement_summary(), "105 Calendar Days / Per Occurrence (max 105 consecutive days)")

    def test_leave_type_page_renders(self):
        response = self.client.get(reverse("leave_types"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "CSC Leave Types and Rules")
        self.assertContains(response, "Add Leave Type")
        self.assertContains(response, "Entitlement Value")

    def test_leave_type_api_crud(self):
        create_response = self.client.post(
            "/api/leave-types/",
            data={
                "leave_code": "CAREER",
                "leave_name": "Career Incentive Leave",
                "category": "special",
                "description": "Custom agency-maintained leave type for testing.",
                "legal_basis": "Agency policy",
                "sort_order": 999,
                "is_active": True,
                "pay_status": "with_pay",
                "credit_deduction_mode": "separate",
                "entitlement_value": "2.00",
                "entitlement_unit": "working_days",
                "entitlement_period": "per_year",
                "min_service_months_required": "12.00",
                "advance_notice_days": 3,
                "max_consecutive_days": "2.00",
                "requires_earned_leave_credits": False,
                "allows_intermittent": True,
                "requires_supporting_document": True,
                "supporting_document_notes": "Supervisor endorsement required.",
                "eligibility_notes": "For permanent staff only.",
                "filing_notes": "File at least three days ahead.",
                "rule_notes": "Agency-specific test record.",
            },
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, 201)
        created = create_response.json()
        self.assertEqual(created["leave_code"], "CAREER")
        self.assertEqual(created["entitlement_summary"], "2 Working Days / Per Year (max 2 consecutive days)")

        leave_type_id = created["leave_type_id"]

        patch_response = self.client.patch(
            f"/api/leave-types/{leave_type_id}/",
            data={
                "entitlement_value": "4.00",
                "max_consecutive_days": "3.00",
                "rule_notes": "Updated rule note.",
            },
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.json()["entitlement_summary"], "4 Working Days / Per Year (max 3 consecutive days)")

        delete_response = self.client.delete(f"/api/leave-types/{leave_type_id}/")
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(LeaveType.objects.filter(pk=leave_type_id).exists())

    def test_leave_type_rejects_credit_rule_without_earned_credits(self):
        response = self.client.post(
            "/api/leave-types/",
            data={
                "leave_code": "BADRULE",
                "leave_name": "Broken Leave Rule",
                "category": "special",
                "pay_status": "with_pay",
                "credit_deduction_mode": "vacation",
                "entitlement_unit": "working_days",
                "entitlement_period": "per_year",
                "requires_earned_leave_credits": False,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("requires_earned_leave_credits", response.json())

    def test_leave_type_balance_tracking_backfill_is_loaded(self):
        self.assertEqual(
            LeaveType.objects.get(leave_code="VL").rule.balance_tracking_mode,
            "vacation",
        )
        self.assertEqual(
            LeaveType.objects.get(leave_code="FVL").rule.balance_tracking_mode,
            "vacation",
        )
        self.assertEqual(
            LeaveType.objects.get(leave_code="SL").rule.balance_tracking_mode,
            "sick",
        )
        self.assertEqual(
            LeaveType.objects.get(leave_code="SPL").rule.balance_tracking_mode,
            "leave_type",
        )
        self.assertEqual(
            LeaveType.objects.get(leave_code="WELL").rule.balance_tracking_mode,
            "leave_type",
        )


class EmployeeLeaveCreditTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.division = Division.objects.create(
            division_name="Leave Credit Division",
            division_abbreviation="LCD",
        )
        cls.position = Position.objects.create(
            position_name="Leave Credit Analyst",
        )
        cls.employee = Employee.objects.create(
            employee_id="EMP-LC-001",
            first_name="Credit",
            last_name="Holder",
            position=cls.position,
            division=cls.division,
        )

    def test_employee_leave_credits_page_renders(self):
        response = self.client.get(reverse("employee_leave_credits"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Employee Leave Credits")
        self.assertContains(response, "Add Leave Credit")

    def test_employee_leave_credit_api_crud(self):
        create_response = self.client.post(
            "/api/leave-credits/",
            data={
                "employee": self.employee.pk,
                "bucket_code": "vacation",
                "bucket_name": "Vacation Leave Credits",
                "current_balance": "12.50",
                "notes": "Opening balance for testing.",
            },
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, 201)
        leave_credit_id = create_response.json()["leave_credit_id"]

        patch_response = self.client.patch(
            f"/api/leave-credits/{leave_credit_id}/",
            data={
                "current_balance": "14.25",
                "notes": "Adjusted test balance.",
            },
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.json()["current_balance"], "14.25")

        delete_response = self.client.delete(f"/api/leave-credits/{leave_credit_id}/")
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(EmployeeLeaveCredit.objects.filter(pk=leave_credit_id).exists())


class SeededLeaveApplicationTests(TestCase):
    def test_leave_application_seed_data_is_loaded(self):
        self.assertEqual(LeaveApplication.objects.count(), 5)
        self.assertEqual(
            LeaveApplication.objects.filter(status=LeaveApplication.Status.APPROVED).count(),
            3,
        )
        self.assertEqual(
            LeaveApplication.objects.filter(status=LeaveApplication.Status.SUBMITTED).count(),
            1,
        )
        self.assertEqual(
            LeaveApplication.objects.filter(status=LeaveApplication.Status.CANCELLED).count(),
            1,
        )

        vacation_application = LeaveApplication.objects.get(
            reason="System-seeded vacation leave filing for baseline leave history.",
        )
        wellness_application = LeaveApplication.objects.get(
            reason="System-seeded wellness leave filing for health recovery.",
        )

        self.assertEqual(vacation_application.balance_bucket_code, "vacation")
        self.assertEqual(str(vacation_application.deducted_units), "3.00")
        self.assertEqual(wellness_application.balance_bucket_code, "WELL")
        self.assertEqual(str(wellness_application.deducted_units), "2.00")

        vacation_credit = EmployeeLeaveCredit.objects.get(
            employee__employee_id="PDS-SEED-001",
            bucket_code="vacation",
        )
        wellness_credit = EmployeeLeaveCredit.objects.get(
            employee__employee_id="PDS-SEED-003",
            bucket_code="WELL",
        )

        self.assertEqual(vacation_credit.current_balance, Decimal("12.00"))
        self.assertEqual(wellness_credit.current_balance, Decimal("3.00"))


class LeaveApplicationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.division = Division.objects.create(
            division_name="Leave Application Division",
            division_abbreviation="LAD",
        )
        cls.position = Position.objects.create(
            position_name="Leave Application Analyst",
        )
        cls.employee = Employee.objects.create(
            employee_id="EMP-LA-001",
            first_name="Leave",
            last_name="Applicant",
            position=cls.position,
            division=cls.division,
        )
        cls.vacation_leave = LeaveType.objects.get(leave_code="VL")
        cls.sick_leave = LeaveType.objects.get(leave_code="SL")
        cls.wellness_leave = LeaveType.objects.get(leave_code="WELL")
        cls.vacation_credit = EmployeeLeaveCredit.objects.create(
            employee=cls.employee,
            bucket_code="vacation",
            bucket_name="Vacation Leave Credits",
            current_balance=Decimal("10.00"),
        )
        cls.wellness_credit = EmployeeLeaveCredit.objects.create(
            employee=cls.employee,
            bucket_code="WELL",
            bucket_name="Wellness Leave",
            linked_leave_type=cls.wellness_leave,
            current_balance=Decimal("5.00"),
        )

    def test_leave_applications_page_renders(self):
        response = self.client.get(reverse("leave_applications"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Leave Applications")
        self.assertContains(response, "File Leave")

    def test_approved_leave_application_deducts_balance_and_delete_reverses(self):
        start_date = timezone.localdate() + timedelta(days=10)
        end_date = start_date + timedelta(days=2)

        create_response = self.client.post(
            "/api/leave-applications/",
            data={
                "employee": self.employee.pk,
                "leave_type": self.vacation_leave.pk,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "status": "approved",
                "reason": "Family trip",
            },
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, 201)
        application_id = create_response.json()["leave_application_id"]
        requested_units = Decimal(create_response.json()["requested_units"])

        self.vacation_credit.refresh_from_db()
        self.assertEqual(
            self.vacation_credit.current_balance,
            Decimal("10.00") - requested_units,
        )
        self.assertEqual(
            EmployeeLeaveCreditLedger.objects.filter(
                leave_credit=self.vacation_credit,
                entry_type="deduction",
            ).count(),
            1,
        )

        delete_response = self.client.delete(f"/api/leave-applications/{application_id}/")
        self.assertEqual(delete_response.status_code, 204)

        self.vacation_credit.refresh_from_db()
        self.assertEqual(self.vacation_credit.current_balance, Decimal("10.00"))
        self.assertEqual(
            EmployeeLeaveCreditLedger.objects.filter(
                leave_credit=self.vacation_credit,
                entry_type="reversal",
            ).count(),
            1,
        )
        self.assertFalse(LeaveApplication.objects.filter(pk=application_id).exists())

    def test_leave_application_requires_supporting_document_when_rule_requires_it(self):
        start_date = timezone.localdate() + timedelta(days=1)

        response = self.client.post(
            "/api/leave-applications/",
            data={
                "employee": self.employee.pk,
                "leave_type": self.sick_leave.pk,
                "start_date": start_date.isoformat(),
                "end_date": start_date.isoformat(),
                "status": "submitted",
                "reason": "Feeling unwell",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("supporting_document_reference", response.json())
