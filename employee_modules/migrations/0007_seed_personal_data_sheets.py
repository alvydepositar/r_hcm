from datetime import date

from django.db import migrations


DIVISIONS = [
    {
        "division_name": "Human Resource Management Division",
        "division_abbreviation": "HRMD",
    },
    {
        "division_name": "Finance and Administrative Division",
        "division_abbreviation": "FAD",
    },
    {
        "division_name": "Information Systems Management Division",
        "division_abbreviation": "ISMD",
    },
]

POSITIONS = [
    {
        "position_name": "Human Resource Management Officer IV",
        "description": "Leads human resource programs and plantilla administration.",
    },
    {
        "position_name": "Accountant III",
        "description": "Handles financial reporting, reconciliation, and budget controls.",
    },
    {
        "position_name": "Information Systems Analyst III",
        "description": "Supports enterprise systems, reporting, and process automation.",
    },
]

PDS_SEED_RECORDS = [
    {
        "employee": {
            "employee_id": "PDS-SEED-001",
            "first_name": "Amelia",
            "last_name": "Rivera",
            "middle_name": "Santos",
            "name_extension": "",
            "division_name": "Human Resource Management Division",
            "position_name": "Human Resource Management Officer IV",
        },
        "pds": {
            "surname": "Rivera",
            "first_name": "Amelia",
            "middle_name": "Santos",
            "name_extension": "",
            "date_of_birth": date(1988, 6, 14),
            "place_of_birth": "Quezon City",
            "sex": "female",
            "civil_status": "married",
            "citizenship": "Filipino",
            "citizenship_basis": "by_birth",
            "height_m": "1.63",
            "weight_kg": "58.50",
            "blood_type": "O+",
            "gsis_id_no": "11-2233445-6",
            "pagibig_id_no": "1234-5678-9012",
            "philhealth_no": "12-345678901-2",
            "sss_no": "34-5678901-2",
            "tin_no": "123-456-789-000",
            "agency_employee_no": "PDS-SEED-001",
            "residential_address": {
                "house_block_lot_no": "18 Lot 7",
                "street": "Acacia Street",
                "subdivision_village": "Mapayapa Village",
                "barangay": "Bagumbayan",
                "city_municipality": "Quezon City",
                "province": "Metro Manila",
                "zip_code": "1110",
            },
            "permanent_address": {
                "house_block_lot_no": "18 Lot 7",
                "street": "Acacia Street",
                "subdivision_village": "Mapayapa Village",
                "barangay": "Bagumbayan",
                "city_municipality": "Quezon City",
                "province": "Metro Manila",
                "zip_code": "1110",
            },
            "telephone_no": "8800-2211",
            "mobile_no": "09171234567",
            "email_address": "amelia.rivera@example.gov.ph",
            "spouse_information": {
                "surname": "Rivera",
                "first_name": "Daniel",
                "middle_name": "Lopez",
                "name_extension": "",
                "occupation": "Project Manager",
                "employer_business_name": "State Development Bank",
                "business_address": "Ortigas Center, Pasig City",
                "telephone_no": "8631-4400",
            },
            "father_information": {
                "surname": "Santos",
                "first_name": "Ricardo",
                "middle_name": "Villanueva",
                "name_extension": "",
            },
            "mother_information": {
                "surname": "Dela Cruz",
                "first_name": "Myrna",
                "middle_name": "Castro",
            },
            "children": [
                {"full_name": "Mica Ella Rivera", "birthdate": "2015-04-10"},
                {"full_name": "Noah Daniel Rivera", "birthdate": "2018-11-23"},
            ],
            "educational_background": {
                "college": {
                    "school_name": "University of the Philippines Diliman",
                    "degree_course": "BS Psychology",
                    "period_from": "2004",
                    "period_to": "2008",
                    "highest_level_units": "Graduated",
                    "year_graduated": "2008",
                    "honors": "Cum Laude",
                },
                "graduate": {
                    "school_name": "Polytechnic University of the Philippines",
                    "degree_course": "Master in Public Administration",
                    "period_from": "2014",
                    "period_to": "2017",
                    "highest_level_units": "Graduated",
                    "year_graduated": "2017",
                    "honors": "",
                },
            },
            "civil_service_eligibilities": [
                {
                    "eligibility": "Career Service Professional",
                    "rating": "84.56",
                    "exam_date": "2010-08-08",
                    "exam_place": "Quezon City",
                    "license_number": "CSP-2010-1182",
                    "validity": "N/A",
                }
            ],
            "work_experiences": [
                {
                    "from": "2019-01-01",
                    "to": "2026-03-09",
                    "position_title": "Human Resource Management Officer IV",
                    "agency_company": "Human Resource Management Division",
                    "monthly_salary": "82963.00",
                    "salary_grade_step": "SG 22 / Step 2",
                    "appointment_status": "Permanent",
                    "government_service": "yes",
                },
                {
                    "from": "2013-06-01",
                    "to": "2018-12-31",
                    "position_title": "Administrative Officer IV",
                    "agency_company": "Civil Service Field Office",
                    "monthly_salary": "42594.00",
                    "salary_grade_step": "SG 15 / Step 2",
                    "appointment_status": "Permanent",
                    "government_service": "yes",
                },
            ],
            "voluntary_works": [
                {
                    "organization_address": "Barangay Bagumbayan Livelihood Council, Quezon City",
                    "from": "2022-04-01",
                    "to": "2022-12-15",
                    "hours": "48",
                    "nature_of_work": "Volunteer HR resource speaker",
                }
            ],
            "learning_and_development": [
                {
                    "title": "Strategic Human Resource Management",
                    "from": "2024-05-13",
                    "to": "2024-05-17",
                    "hours": "40",
                    "type": "Managerial",
                    "conducted_by": "Civil Service Institute",
                }
            ],
            "special_skills": ["Policy drafting", "Competency mapping", "Public speaking"],
            "recognitions": ["Outstanding HR Program Lead 2024"],
            "memberships": ["PMAP", "Philippine Society for Talent Development"],
            "questionnaire": {
                "q34a": {"answer": "no", "details": ""},
                "q34b": {"answer": "no", "details": ""},
                "q35a": {"answer": "no", "details": ""},
                "q35b": {"answer": "no", "details": ""},
                "q36": {"answer": "no", "details": ""},
                "q37": {"answer": "no", "details": ""},
                "q38a": {"answer": "no", "details": ""},
                "q38b": {"answer": "no", "details": ""},
                "q39": {"answer": "no", "details": ""},
                "q40a": {"answer": "no", "details": ""},
                "q40b": {"answer": "no", "details": ""},
                "q40c": {"answer": "no", "details": ""},
            },
            "references": [
                {"name": "Marissa Delos Reyes", "address": "Marikina City", "contact": "09170001001"},
                {"name": "Jose Manuel Cruz", "address": "Pasig City", "contact": "09170001002"},
                {"name": "Elaine Villarta", "address": "Quezon City", "contact": "09170001003"},
            ],
            "government_id_type": "Passport",
            "government_id_number": "P1234567A",
            "government_id_date_of_issue": date(2023, 1, 17),
            "government_id_place_of_issue": "DFA ASEANA",
            "date_accomplished": date(2026, 1, 15),
        },
    },
    {
        "employee": {
            "employee_id": "PDS-SEED-002",
            "first_name": "Miguel",
            "last_name": "Bautista",
            "middle_name": "Navarro",
            "name_extension": "Jr.",
            "division_name": "Finance and Administrative Division",
            "position_name": "Accountant III",
        },
        "pds": {
            "surname": "Bautista",
            "first_name": "Miguel",
            "middle_name": "Navarro",
            "name_extension": "Jr.",
            "date_of_birth": date(1986, 9, 2),
            "place_of_birth": "San Fernando, Pampanga",
            "sex": "male",
            "civil_status": "married",
            "citizenship": "Filipino",
            "citizenship_basis": "by_birth",
            "height_m": "1.72",
            "weight_kg": "74.20",
            "blood_type": "A+",
            "gsis_id_no": "22-3344556-7",
            "pagibig_id_no": "2233-4455-6677",
            "philhealth_no": "22-123456789-0",
            "sss_no": "45-6789012-3",
            "tin_no": "234-567-890-111",
            "agency_employee_no": "PDS-SEED-002",
            "residential_address": {
                "house_block_lot_no": "29",
                "street": "Sampaguita Street",
                "subdivision_village": "Green Meadows",
                "barangay": "Sto. Cristo",
                "city_municipality": "San Fernando",
                "province": "Pampanga",
                "zip_code": "2000",
            },
            "permanent_address": {
                "house_block_lot_no": "29",
                "street": "Sampaguita Street",
                "subdivision_village": "Green Meadows",
                "barangay": "Sto. Cristo",
                "city_municipality": "San Fernando",
                "province": "Pampanga",
                "zip_code": "2000",
            },
            "telephone_no": "8865-7731",
            "mobile_no": "09181234567",
            "email_address": "miguel.bautista@example.gov.ph",
            "spouse_information": {
                "surname": "Bautista",
                "first_name": "Clarisse",
                "middle_name": "Mendoza",
                "name_extension": "",
                "occupation": "Teacher",
                "employer_business_name": "Department of Education",
                "business_address": "San Fernando, Pampanga",
                "telephone_no": "045-963-2201",
            },
            "father_information": {
                "surname": "Bautista",
                "first_name": "Ramon",
                "middle_name": "Navarro",
                "name_extension": "Sr.",
            },
            "mother_information": {
                "surname": "Reyes",
                "first_name": "Lucia",
                "middle_name": "Santiago",
            },
            "children": [
                {"full_name": "Luis Miguel Bautista", "birthdate": "2013-07-04"},
            ],
            "educational_background": {
                "college": {
                    "school_name": "Holy Angel University",
                    "degree_course": "BS Accountancy",
                    "period_from": "2003",
                    "period_to": "2007",
                    "highest_level_units": "Graduated",
                    "year_graduated": "2007",
                    "honors": "",
                },
            },
            "civil_service_eligibilities": [
                {
                    "eligibility": "RA 1080 - CPA Board",
                    "rating": "",
                    "exam_date": "2008-10-12",
                    "exam_place": "Manila",
                    "license_number": "CPA-2008-6671",
                    "validity": "N/A",
                }
            ],
            "work_experiences": [
                {
                    "from": "2020-02-01",
                    "to": "2026-03-09",
                    "position_title": "Accountant III",
                    "agency_company": "Finance and Administrative Division",
                    "monthly_salary": "59966.00",
                    "salary_grade_step": "SG 19 / Step 2",
                    "appointment_status": "Permanent",
                    "government_service": "yes",
                }
            ],
            "voluntary_works": [],
            "learning_and_development": [
                {
                    "title": "Public Sector Accounting Standards Update",
                    "from": "2025-08-20",
                    "to": "2025-08-22",
                    "hours": "24",
                    "type": "Technical",
                    "conducted_by": "Government Accountancy Office",
                }
            ],
            "special_skills": ["Financial analysis", "Budget monitoring"],
            "recognitions": ["Finance Process Improvement Award 2025"],
            "memberships": ["PICPA"],
            "questionnaire": {
                "q34a": {"answer": "no", "details": ""},
                "q34b": {"answer": "no", "details": ""},
                "q35a": {"answer": "no", "details": ""},
                "q35b": {"answer": "no", "details": ""},
                "q36": {"answer": "no", "details": ""},
                "q37": {"answer": "no", "details": ""},
                "q38a": {"answer": "no", "details": ""},
                "q38b": {"answer": "no", "details": ""},
                "q39": {"answer": "no", "details": ""},
                "q40a": {"answer": "no", "details": ""},
                "q40b": {"answer": "no", "details": ""},
                "q40c": {"answer": "no", "details": ""},
            },
            "references": [
                {"name": "Francis Villanueva", "address": "Makati City", "contact": "09170002001"},
                {"name": "Rica Salonga", "address": "San Fernando, Pampanga", "contact": "09170002002"},
            ],
            "government_id_type": "Driver's License",
            "government_id_number": "N02-11-123456",
            "government_id_date_of_issue": date(2024, 3, 11),
            "government_id_place_of_issue": "LTO San Fernando",
            "date_accomplished": date(2026, 1, 18),
        },
    },
    {
        "employee": {
            "employee_id": "PDS-SEED-003",
            "first_name": "Leah",
            "last_name": "Torres",
            "middle_name": "Garcia",
            "name_extension": "",
            "division_name": "Information Systems Management Division",
            "position_name": "Information Systems Analyst III",
        },
        "pds": {
            "surname": "Torres",
            "first_name": "Leah",
            "middle_name": "Garcia",
            "name_extension": "",
            "date_of_birth": date(1991, 2, 27),
            "place_of_birth": "Cebu City",
            "sex": "female",
            "civil_status": "single",
            "citizenship": "Filipino",
            "citizenship_basis": "by_birth",
            "height_m": "1.59",
            "weight_kg": "53.40",
            "blood_type": "B+",
            "gsis_id_no": "33-4455667-8",
            "pagibig_id_no": "3344-5566-7788",
            "philhealth_no": "33-234567890-1",
            "sss_no": "56-7890123-4",
            "tin_no": "345-678-901-222",
            "agency_employee_no": "PDS-SEED-003",
            "residential_address": {
                "house_block_lot_no": "11",
                "street": "Molave Street",
                "subdivision_village": "IT Park Residences",
                "barangay": "Lahug",
                "city_municipality": "Cebu City",
                "province": "Cebu",
                "zip_code": "6000",
            },
            "permanent_address": {
                "house_block_lot_no": "88",
                "street": "Rizal Avenue",
                "subdivision_village": "",
                "barangay": "Poblacion",
                "city_municipality": "Toledo City",
                "province": "Cebu",
                "zip_code": "6038",
            },
            "telephone_no": "",
            "mobile_no": "09221234567",
            "email_address": "leah.torres@example.gov.ph",
            "spouse_information": {},
            "father_information": {
                "surname": "Torres",
                "first_name": "Eduardo",
                "middle_name": "Morales",
                "name_extension": "",
            },
            "mother_information": {
                "surname": "Garcia",
                "first_name": "Helen",
                "middle_name": "Luna",
            },
            "children": [],
            "educational_background": {
                "college": {
                    "school_name": "University of San Carlos",
                    "degree_course": "BS Information Technology",
                    "period_from": "2008",
                    "period_to": "2012",
                    "highest_level_units": "Graduated",
                    "year_graduated": "2012",
                    "honors": "",
                },
            },
            "civil_service_eligibilities": [
                {
                    "eligibility": "Career Service Professional",
                    "rating": "86.14",
                    "exam_date": "2015-03-15",
                    "exam_place": "Cebu City",
                    "license_number": "CSP-2015-0912",
                    "validity": "N/A",
                }
            ],
            "work_experiences": [
                {
                    "from": "2021-06-01",
                    "to": "2026-03-09",
                    "position_title": "Information Systems Analyst III",
                    "agency_company": "Information Systems Management Division",
                    "monthly_salary": "59153.00",
                    "salary_grade_step": "SG 19 / Step 1",
                    "appointment_status": "Permanent",
                    "government_service": "yes",
                },
                {
                    "from": "2016-02-01",
                    "to": "2021-05-31",
                    "position_title": "Systems Analyst",
                    "agency_company": "Provincial Government of Cebu",
                    "monthly_salary": "45000.00",
                    "salary_grade_step": "",
                    "appointment_status": "Permanent",
                    "government_service": "yes",
                },
            ],
            "voluntary_works": [
                {
                    "organization_address": "Code for GovPH Cebu Chapter",
                    "from": "2023-01-14",
                    "to": "2023-10-28",
                    "hours": "36",
                    "nature_of_work": "Volunteer mentor for civic tech bootcamps",
                }
            ],
            "learning_and_development": [
                {
                    "title": "Cybersecurity Incident Response for Government IT Teams",
                    "from": "2025-02-10",
                    "to": "2025-02-14",
                    "hours": "40",
                    "type": "Technical",
                    "conducted_by": "DICT Academy",
                }
            ],
            "special_skills": ["SQL tuning", "Systems analysis", "Process automation"],
            "recognitions": ["Digital Transformation Champion 2024"],
            "memberships": ["PhilNITS", "ISACA Manila Chapter"],
            "questionnaire": {
                "q34a": {"answer": "no", "details": ""},
                "q34b": {"answer": "no", "details": ""},
                "q35a": {"answer": "no", "details": ""},
                "q35b": {"answer": "no", "details": ""},
                "q36": {"answer": "no", "details": ""},
                "q37": {"answer": "no", "details": ""},
                "q38a": {"answer": "no", "details": ""},
                "q38b": {"answer": "no", "details": ""},
                "q39": {"answer": "no", "details": ""},
                "q40a": {"answer": "no", "details": ""},
                "q40b": {"answer": "no", "details": ""},
                "q40c": {"answer": "no", "details": ""},
            },
            "references": [
                {"name": "Irene Lopez", "address": "Cebu City", "contact": "09170003001"},
                {"name": "Patrick Ramos", "address": "Taguig City", "contact": "09170003002"},
            ],
            "government_id_type": "UMID",
            "government_id_number": "1000-2233445-6",
            "government_id_date_of_issue": date(2022, 7, 8),
            "government_id_place_of_issue": "GSIS Cebu",
            "date_accomplished": date(2026, 1, 20),
        },
    },
]


def seed_personal_data_sheets(apps, schema_editor):
    Division = apps.get_model("core", "Division")
    Position = apps.get_model("core", "Position")
    Employee = apps.get_model("employee_modules", "Employee")
    EmployeePersonalDataSheet = apps.get_model("employee_modules", "EmployeePersonalDataSheet")

    division_map = {}
    for division_data in DIVISIONS:
        division, _ = Division.objects.get_or_create(
            division_name=division_data["division_name"],
            defaults={
                "division_abbreviation": division_data["division_abbreviation"],
                "created_by": "system_seed",
                "modified_by": "system_seed",
            },
        )
        division_map[division.division_name] = division

    position_map = {}
    for position_data in POSITIONS:
        position, _ = Position.objects.get_or_create(
            position_name=position_data["position_name"],
            defaults={
                "description": position_data["description"],
                "created_by": "system_seed",
                "modified_by": "system_seed",
            },
        )
        position_map[position.position_name] = position

    for record in PDS_SEED_RECORDS:
        employee_data = record["employee"]
        employee, _ = Employee.objects.get_or_create(
            employee_id=employee_data["employee_id"],
            defaults={
                "first_name": employee_data["first_name"],
                "last_name": employee_data["last_name"],
                "middle_name": employee_data["middle_name"],
                "name_extension": employee_data["name_extension"] or None,
                "division": division_map[employee_data["division_name"]],
                "position": position_map[employee_data["position_name"]],
                "created_by": "system_seed",
                "modified_by": "system_seed",
            },
        )

        EmployeePersonalDataSheet.objects.get_or_create(
            employee=employee,
            defaults={
                **record["pds"],
                "created_by": "system_seed",
                "modified_by": "system_seed",
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_seed_cscplantilla"),
        ("employee_modules", "0006_employeepersonaldatasheet"),
    ]

    operations = [
        migrations.RunPython(seed_personal_data_sheets, migrations.RunPython.noop),
    ]
