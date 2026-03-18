from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import authenticate, get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from employee_modules.models import Employee
from hr_modules.models import Approver

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
)


class HRPortalAuthMixin:
    def setUp(self):
        super().setUp()
        self.client.force_login(get_user_model().objects.get(username="amelia.rivera"))


class SalaryGradeTests(HRPortalAuthMixin, TestCase):
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


class CSCPlantillaTests(HRPortalAuthMixin, TestCase):
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


class LeaveTypeTests(HRPortalAuthMixin, TestCase):
    def test_leave_type_seed_data_is_loaded(self):
        vacation_leave = LeaveType.objects.get(leave_code="VL")
        wellness_leave = LeaveType.objects.get(leave_code="WELL")
        maternity_leave = LeaveType.objects.get(leave_code="ML")
        paternity_leave = LeaveType.objects.get(leave_code="PAT")
        leave_without_pay = LeaveType.objects.get(leave_code="LWOP")

        self.assertEqual(LeaveType.objects.count(), 17)
        self.assertEqual(vacation_leave.rule.filing_detail_template, "travel")
        self.assertEqual(vacation_leave.rule.application_detail_schema[0]["key"], "travel_scope")
        self.assertEqual(vacation_leave.rule.application_detail_schema[0]["choices"][1]["value"], "abroad")
        self.assertEqual(paternity_leave.rule.filing_detail_template, "paternity")
        self.assertEqual(paternity_leave.rule.application_detail_schema[0]["key"], "paternity_spouse_name")
        self.assertEqual(wellness_leave.category, LeaveType.Category.WELLNESS)
        self.assertEqual(str(wellness_leave.rule.entitlement_value), "5.00")
        self.assertEqual(wellness_leave.rule.entitlement_period, "per_year")
        self.assertEqual(maternity_leave.rule.entitlement_summary(), "105 Calendar Days / Per Occurrence (max 105 consecutive days)")
        self.assertEqual(leave_without_pay.rule.pay_status, "without_pay")
        self.assertEqual(leave_without_pay.rule.balance_tracking_mode, "none")
        self.assertFalse(leave_without_pay.rule.requires_earned_leave_credits)

    def test_leave_type_page_renders(self):
        response = self.client.get(reverse("leave_types"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "CSC Leave Types and Rules")
        self.assertContains(response, "Add Leave Type")
        self.assertContains(response, "Leave-Specific Filing Rule")

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
                "filing_detail_template": "travel",
                "travel_abroad_notice_days": 10,
                "rule_notes": "Agency-specific test record.",
            },
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, 201)
        created = create_response.json()
        self.assertEqual(created["leave_code"], "CAREER")
        self.assertEqual(created["filing_detail_template"], "travel")
        self.assertEqual(created["travel_abroad_notice_days"], 10)
        self.assertEqual(created["application_detail_schema"][0]["key"], "travel_scope")
        self.assertEqual(created["entitlement_summary"], "2 Working Days / Per Year (max 2 consecutive days)")

        leave_type_id = created["leave_type_id"]

        patch_response = self.client.patch(
            f"/api/leave-types/{leave_type_id}/",
            data={
                "entitlement_value": "4.00",
                "max_consecutive_days": "3.00",
                "travel_abroad_notice_days": 15,
                "rule_notes": "Updated rule note.",
            },
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.json()["entitlement_summary"], "4 Working Days / Per Year (max 3 consecutive days)")
        self.assertEqual(patch_response.json()["travel_abroad_notice_days"], 15)

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

    def test_leave_type_accepts_structured_application_detail_schema(self):
        response = self.client.post(
            "/api/leave-types/",
            data={
                "leave_code": "TESTDET",
                "leave_name": "Test Detail Leave",
                "category": "special",
                "pay_status": "with_pay",
                "credit_deduction_mode": "none",
                "entitlement_value": "1.00",
                "entitlement_unit": "working_days",
                "entitlement_period": "per_application",
                "requires_earned_leave_credits": False,
                "application_detail_schema": [
                    {
                        "key": "event_scope",
                        "label": "Event Scope",
                        "type": "select",
                        "required": True,
                        "choices": [
                            {"value": "local", "label": "Local"},
                            {"value": "external", "label": "External"},
                        ],
                    }
                ],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.json()["application_detail_schema"][0]["key"],
            "event_scope",
        )
        self.assertEqual(response.json()["filing_detail_template"], "custom")

    def test_leave_type_rejects_invalid_application_detail_schema(self):
        response = self.client.post(
            "/api/leave-types/",
            data={
                "leave_code": "BADSCHEMA",
                "leave_name": "Bad Schema Leave",
                "category": "special",
                "pay_status": "with_pay",
                "credit_deduction_mode": "none",
                "entitlement_value": "1.00",
                "entitlement_unit": "working_days",
                "entitlement_period": "per_application",
                "requires_earned_leave_credits": False,
                "application_detail_schema": [
                    {
                        "key": "bad_select",
                        "label": "Bad Select",
                        "type": "select",
                        "required": True,
                    }
                ],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("application_detail_schema", response.json())


class EmployeeLeaveCreditTests(HRPortalAuthMixin, TestCase):
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


class SeededLeaveApplicationTests(HRPortalAuthMixin, TestCase):
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


class LeaveApplicationTests(HRPortalAuthMixin, TestCase):
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
        cls.paternity_leave = LeaveType.objects.get(leave_code="PAT")
        cls.study_leave = LeaveType.objects.get(leave_code="STL")
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
                "application_details": {
                    "travel_scope": "abroad",
                    "travel_destination": "Tokyo, Japan",
                },
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
                "application_details": {
                    "medical_context": "out_patient",
                    "illness_details": "Flu-like symptoms and medical consultation.",
                },
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("supporting_document_reference", response.json())

    def test_vacation_leave_requires_travel_scope_and_destination(self):
        start_date = timezone.localdate() + timedelta(days=10)
        end_date = start_date + timedelta(days=1)

        response = self.client.post(
            "/api/leave-applications/",
            data={
                "employee": self.employee.pk,
                "leave_type": self.vacation_leave.pk,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "status": "submitted",
                "reason": "Family vacation",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("application_details", response.json())

        valid_response = self.client.post(
            "/api/leave-applications/",
            data={
                "employee": self.employee.pk,
                "leave_type": self.vacation_leave.pk,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "status": "submitted",
                "reason": "Family vacation",
                "application_details": {
                    "travel_scope": "within_philippines",
                    "travel_destination": "Bohol",
                },
            },
            content_type="application/json",
        )

        self.assertEqual(valid_response.status_code, 201)
        self.assertIn("Travel Scope", valid_response.json()["application_detail_summary"])

    def test_travel_abroad_notice_days_apply_only_to_abroad_requests(self):
        vacation_leave = LeaveType.objects.get(pk=self.vacation_leave.pk)
        vacation_leave.rule.travel_abroad_notice_days = 20
        vacation_leave.rule.save(update_fields=["travel_abroad_notice_days"])

        start_date = timezone.localdate() + timedelta(days=10)
        end_date = start_date + timedelta(days=1)

        abroad_response = self.client.post(
            "/api/leave-applications/",
            data={
                "employee": self.employee.pk,
                "leave_type": vacation_leave.pk,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "status": "submitted",
                "reason": "Foreign travel",
                "application_details": {
                    "travel_scope": "abroad",
                    "travel_destination": "Singapore",
                },
            },
            content_type="application/json",
        )

        self.assertEqual(abroad_response.status_code, 400)
        self.assertIn("start_date", abroad_response.json())

        local_response = self.client.post(
            "/api/leave-applications/",
            data={
                "employee": self.employee.pk,
                "leave_type": vacation_leave.pk,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "status": "submitted",
                "reason": "Domestic travel",
                "application_details": {
                    "travel_scope": "within_philippines",
                    "travel_destination": "Bohol",
                },
            },
            content_type="application/json",
        )

        self.assertEqual(local_response.status_code, 201)

    def test_paternity_leave_requires_csc_specific_application_details(self):
        start_date = timezone.localdate() + timedelta(days=3)

        invalid_response = self.client.post(
            "/api/leave-applications/",
            data={
                "employee": self.employee.pk,
                "leave_type": self.paternity_leave.pk,
                "start_date": start_date.isoformat(),
                "end_date": (start_date + timedelta(days=6)).isoformat(),
                "status": "submitted",
                "reason": "Paternity leave",
                "supporting_document_reference": "PAT-REQ-001",
                "application_details": {
                    "paternity_case_type": "childbirth",
                },
            },
            content_type="application/json",
        )

        self.assertEqual(invalid_response.status_code, 400)
        self.assertIn("application_details", invalid_response.json())

        valid_response = self.client.post(
            "/api/leave-applications/",
            data={
                "employee": self.employee.pk,
                "leave_type": self.paternity_leave.pk,
                "start_date": start_date.isoformat(),
                "end_date": (start_date + timedelta(days=6)).isoformat(),
                "status": "submitted",
                "reason": "Paternity leave",
                "supporting_document_reference": "PAT-REQ-001",
                "application_details": {
                    "paternity_spouse_name": "Ana Applicant",
                    "paternity_case_type": "childbirth",
                    "paternity_delivery_date": start_date.isoformat(),
                    "paternity_delivery_order": "1",
                },
            },
            content_type="application/json",
        )

        self.assertEqual(valid_response.status_code, 201)
        self.assertIn("Name of Legitimate Spouse", valid_response.json()["application_detail_summary"])

    def test_study_leave_other_purpose_requires_specific_detail(self):
        start_date = timezone.localdate() + timedelta(days=20)

        response = self.client.post(
            "/api/leave-applications/",
            data={
                "employee": self.employee.pk,
                "leave_type": self.study_leave.pk,
                "start_date": start_date.isoformat(),
                "end_date": start_date.isoformat(),
                "requested_units": "6.00",
                "status": "submitted",
                "reason": "Graduate studies",
                "supporting_document_reference": "STL-PLAN-001",
                "application_details": {
                    "study_leave_purpose": "other",
                },
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("application_details", response.json())

        valid_response = self.client.post(
            "/api/leave-applications/",
            data={
                "employee": self.employee.pk,
                "leave_type": self.study_leave.pk,
                "start_date": start_date.isoformat(),
                "end_date": start_date.isoformat(),
                "requested_units": "6.00",
                "status": "submitted",
                "reason": "Graduate studies",
                "supporting_document_reference": "STL-PLAN-001",
                "application_details": {
                    "study_leave_purpose": "other",
                    "study_leave_other_purpose": "Doctoral qualifying examination preparation",
                },
            },
            content_type="application/json",
        )

        self.assertEqual(valid_response.status_code, 201)
        self.assertIn(
            "Doctoral qualifying examination preparation",
            valid_response.json()["application_detail_summary"],
        )


class RBACAndApprovalWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.division = Division.objects.create(
            division_name="Approval Workflow Division",
            division_abbreviation="AWD",
        )
        cls.position = Position.objects.create(position_name="Approval Workflow Position")
        cls.requester = Employee.objects.create(
            employee_id="EMP-RBAC-001",
            first_name="Rica",
            last_name="Requester",
            position=cls.position,
            division=cls.division,
        )
        cls.supervisor = Employee.objects.create(
            employee_id="EMP-RBAC-002",
            first_name="Simon",
            last_name="Supervisor",
            position=cls.position,
            division=cls.division,
        )
        cls.division_chief = Employee.objects.create(
            employee_id="EMP-RBAC-003",
            first_name="Cathy",
            last_name="Chief",
            position=cls.position,
            division=cls.division,
        )
        cls.hr_approver = Employee.objects.create(
            employee_id="EMP-RBAC-004",
            first_name="Hanna",
            last_name="Approver",
            position=cls.position,
            division=cls.division,
        )
        cls.vacation_leave = LeaveType.objects.get(leave_code="VL")

        EmployeeLeaveCredit.objects.create(
            employee=cls.requester,
            bucket_code="vacation",
            bucket_name="Vacation Leave Credits",
            current_balance=Decimal("15.00"),
        )

        Approver.objects.create(
            approval_type=Approver.ApprovalType.DIVISION,
            division_id=cls.division,
            immediate_supervisor=cls.supervisor,
            division_chief=cls.division_chief,
            hr_approver=cls.hr_approver,
        )

        user_model = get_user_model()
        cls.requester_user = user_model.objects.create_user(username="rbac.requester", password="Employee@2026")
        cls.supervisor_user = user_model.objects.create_user(username="rbac.supervisor", password="Approver@2026")
        cls.requester.user = cls.requester_user
        cls.requester.save(update_fields=["user"])
        cls.supervisor.user = cls.supervisor_user
        cls.supervisor.save(update_fields=["user"])

    def test_seeded_rbac_credentials_are_available(self):
        self.assertIsNotNone(authenticate(username="amelia.rivera", password="HrPortal@2026"))
        self.assertIsNotNone(authenticate(username="miguel.bautista", password="Approver@2026"))
        self.assertIsNotNone(authenticate(username="leah.torres", password="Approver@2026"))

    def test_employee_user_cannot_open_hr_page(self):
        self.client.force_login(self.requester_user)

        response = self.client.get(reverse("employee_management"))

        self.assertEqual(response.status_code, 403)

    def test_dual_role_user_uses_employee_navigation_on_employee_routes(self):
        dual_role_user = get_user_model().objects.get(username="amelia.rivera")
        self.client.force_login(dual_role_user)

        response = self.client.get(reverse("employee_leave_portal"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["portal_mode"], "employee")

    def test_portal_switch_persists_for_dual_role_user_until_hr_route_is_opened(self):
        dual_role_user = get_user_model().objects.get(username="amelia.rivera")
        self.client.force_login(dual_role_user)

        switch_response = self.client.get(f"{reverse('index')}?portal=employee")
        self.assertEqual(switch_response.status_code, 200)
        self.assertEqual(switch_response.context["portal_mode"], "employee")

        persisted_response = self.client.get(reverse("index"))
        self.assertEqual(persisted_response.status_code, 200)
        self.assertEqual(persisted_response.context["portal_mode"], "employee")

        hr_response = self.client.get(reverse("leave_management"))
        self.assertEqual(hr_response.status_code, 200)
        self.assertEqual(hr_response.context["portal_mode"], "hr")

    def test_dual_role_user_can_switch_back_to_hr_mode_from_index(self):
        dual_role_user = get_user_model().objects.get(username="amelia.rivera")
        self.client.force_login(dual_role_user)

        employee_response = self.client.get(f"{reverse('index')}?portal=employee")
        self.assertEqual(employee_response.status_code, 200)
        self.assertEqual(employee_response.context["portal_mode"], "employee")

        hr_response = self.client.get(f"{reverse('index')}?portal=hr")
        self.assertEqual(hr_response.status_code, 200)
        self.assertEqual(hr_response.context["portal_mode"], "hr")

    def test_submitted_leave_application_creates_pending_approval_queue(self):
        self.client.force_login(self.requester_user)
        start_date = timezone.localdate() + timedelta(days=7)
        end_date = start_date + timedelta(days=1)

        response = self.client.post(
            "/api/leave-applications/",
            data={
                "employee": self.requester.pk,
                "leave_type": self.vacation_leave.pk,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "status": "submitted",
                "reason": "Workflow validation",
                "application_details": {
                    "travel_scope": "within_philippines",
                    "travel_destination": "Cebu",
                },
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        application_id = response.json()["leave_application_id"]
        approvals = LeaveApplicationApproval.objects.filter(
            leave_application_id=application_id,
        ).order_by("sequence")

        self.assertEqual(approvals.count(), 3)
        self.assertEqual(approvals[0].status, LeaveApplicationApproval.Status.PENDING)
        self.assertEqual(approvals[0].approver_employee, self.supervisor)
        self.assertEqual(approvals[1].status, LeaveApplicationApproval.Status.QUEUED)

    def test_approver_can_approve_assigned_leave(self):
        application = LeaveApplication.objects.create(
            employee=self.requester,
            leave_type=self.vacation_leave,
            start_date=timezone.localdate() + timedelta(days=7),
            end_date=timezone.localdate() + timedelta(days=8),
            requested_units=Decimal("2.00"),
            status=LeaveApplication.Status.SUBMITTED,
            reason="For approval queue page",
            balance_bucket_code="vacation",
            deducted_units=Decimal("2.00"),
            rule_snapshot={"leave_code": "VL"},
        )
        first_step = LeaveApplicationApproval.objects.create(
            leave_application=application,
            approver_employee=self.supervisor,
            approver_role=LeaveApplicationApproval.ApprovalRole.IMMEDIATE_SUPERVISOR,
            sequence=1,
            status=LeaveApplicationApproval.Status.PENDING,
        )
        LeaveApplicationApproval.objects.create(
            leave_application=application,
            approver_employee=self.division_chief,
            approver_role=LeaveApplicationApproval.ApprovalRole.DIVISION_CHIEF,
            sequence=2,
            status=LeaveApplicationApproval.Status.QUEUED,
        )

        self.client.force_login(self.supervisor_user)

        queue_response = self.client.get("/api/leave-approvals/?status=pending")
        self.assertEqual(queue_response.status_code, 200)
        self.assertEqual(len(queue_response.json()), 1)

        decision_response = self.client.patch(
            f"/api/leave-approvals/{first_step.leave_application_approval_id}/",
            data={"status": "approved", "decision_notes": "Approved by supervisor."},
            content_type="application/json",
        )

        self.assertEqual(decision_response.status_code, 200)

        first_step.refresh_from_db()
        next_step = application.approvals.get(sequence=2)
        application.refresh_from_db()

        self.assertEqual(first_step.status, LeaveApplicationApproval.Status.APPROVED)
        self.assertEqual(next_step.status, LeaveApplicationApproval.Status.PENDING)
        self.assertEqual(application.status, LeaveApplication.Status.SUBMITTED)
