from django.test import TestCase
from django.urls import reverse

from core.models import CSCPlantilla, Division, Position, SalaryGrade


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
        cls.division = Division.objects.create(
            division_name="Plantilla Test Division",
            division_abbreviation="PTD",
        )
        cls.position = Position.objects.create(position_name="Plantilla Test Position")
        cls.salary_grade_11 = SalaryGrade.objects.get(csc_grade=11)
        cls.salary_grade_33 = SalaryGrade.objects.get(csc_grade=33)

    def test_csc_plantilla_seed_data_is_loaded(self):
        plantilla = CSCPlantilla.objects.get(item_number="CSC-HRMD-HRMO4-001-2026")

        self.assertEqual(CSCPlantilla.objects.count(), 12)
        self.assertEqual(plantilla.division.division_abbreviation, "HRMD")
        self.assertEqual(plantilla.position.position_name, "Human Resource Management Officer IV")
        self.assertEqual(plantilla.salary_grade.csc_grade, 22)
        self.assertEqual(plantilla.salary_step, 2)
        self.assertEqual(str(plantilla.monthly_salary_amount), "82963.00")

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
        self.assertEqual(created_row["csc_grade"], 11)
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
                "position": self.position.pk,
                "division": self.division.pk,
                "salary_grade": self.salary_grade_33.pk,
                "salary_step": 3,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("salary_step", response.json())
