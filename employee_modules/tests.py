from django.test import TestCase
from django.urls import reverse

from core.models import Division, Position
from employee_modules.models import Employee, EmployeePersonalDataSheet


class EmployeePersonalDataSheetTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.division = Division.objects.create(
            division_name="Employee Services Division",
            division_abbreviation="ESD",
        )
        cls.position = Position.objects.create(position_name="Administrative Officer II")
        cls.employee = Employee.objects.create(
            employee_id="EMP-PDS-001",
            first_name="Ana",
            last_name="Reyes",
            middle_name="Lopez",
            position=cls.position,
            division=cls.division,
        )

    def test_personal_data_sheet_seed_data_is_loaded(self):
        seeded_pds = EmployeePersonalDataSheet.objects.get(
            employee__employee_id="PDS-SEED-001"
        )

        self.assertEqual(EmployeePersonalDataSheet.objects.count(), 3)
        self.assertEqual(seeded_pds.employee.first_name, "Amelia")
        self.assertEqual(seeded_pds.civil_status, "married")
        self.assertEqual(seeded_pds.educational_background["college"]["school_name"], "University of the Philippines Diliman")
        self.assertEqual(len(seeded_pds.references), 3)

    def test_personal_data_sheet_page_renders(self):
        response = self.client.get(reverse("personal_data_sheet"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Employee Personal Data Sheet")
        self.assertContains(response, "CS Form No. 212, Revised 2025")
        self.assertContains(response, "Personal Information")
        self.assertContains(response, 'id="pds-print-layout"', html=False)
        self.assertContains(response, "Page 1 of 4")

    def test_personal_data_sheet_api_crud(self):
        create_response = self.client.post(
            "/api/personal-data-sheets/",
            data={
                "employee": self.employee.pk,
                "surname": "Reyes",
                "first_name": "Ana",
                "middle_name": "Lopez",
                "sex": "female",
                "civil_status": "single",
                "citizenship": "Filipino",
                "residential_address": {"city_municipality": "Quezon City"},
                "permanent_address": {"city_municipality": "Quezon City"},
                "spouse_information": {},
                "father_information": {"surname": "Reyes"},
                "mother_information": {"surname": "Lopez"},
                "children": [{"full_name": "Child One", "birthdate": "2020-01-01"}],
                "educational_background": {"college": {"school_name": "State University"}},
                "civil_service_eligibilities": [],
                "work_experiences": [],
                "voluntary_works": [],
                "learning_and_development": [],
                "special_skills": ["Spreadsheet modeling"],
                "recognitions": ["Service Award"],
                "memberships": ["PMAP"],
                "questionnaire": {"q34a": {"answer": "no", "details": ""}},
                "references": [{"name": "Maria Santos", "address": "Pasig", "contact": "09170000000"}],
            },
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, 201)
        created = create_response.json()
        self.assertEqual(created["employee"], self.employee.pk)
        self.assertEqual(created["employee_number"], "EMP-PDS-001")

        filtered_list = self.client.get(f"/api/personal-data-sheets/?employee={self.employee.pk}")
        self.assertEqual(filtered_list.status_code, 200)
        self.assertEqual(len(filtered_list.json()), 1)

        patch_response = self.client.patch(
            f"/api/personal-data-sheets/{created['pds_id']}/",
            data={"civil_status": "married"},
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.json()["civil_status"], "married")

        delete_response = self.client.delete(f"/api/personal-data-sheets/{created['pds_id']}/")
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(EmployeePersonalDataSheet.objects.filter(pk=created["pds_id"]).exists())

    def test_personal_data_sheet_requires_questionnaire_details_for_yes_answers(self):
        response = self.client.post(
            "/api/personal-data-sheets/",
            data={
                "employee": self.employee.pk,
                "surname": "Reyes",
                "first_name": "Ana",
                "middle_name": "Lopez",
                "sex": "female",
                "civil_status": "single",
                "citizenship": "Filipino",
                "residential_address": {"city_municipality": "Quezon City"},
                "permanent_address": {"city_municipality": "Quezon City"},
                "spouse_information": {},
                "father_information": {"surname": "Reyes"},
                "mother_information": {"surname": "Lopez"},
                "children": [],
                "educational_background": {"college": {"school_name": "State University"}},
                "civil_service_eligibilities": [],
                "work_experiences": [],
                "voluntary_works": [],
                "learning_and_development": [],
                "special_skills": [],
                "recognitions": [],
                "memberships": [],
                "questionnaire": {"q34a": {"answer": "yes", "details": ""}},
                "references": [],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("questionnaire", response.json())
        self.assertIn("q34a", response.json()["questionnaire"])
