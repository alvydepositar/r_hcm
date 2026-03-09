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
    {
        "division_name": "Policy and Planning Division",
        "division_abbreviation": "PPD",
    },
    {
        "division_name": "Legal Services Division",
        "division_abbreviation": "LSD",
    },
]

POSITIONS = [
    {
        "position_name": "Director IV",
        "description": "Division head position for major service units.",
    },
    {
        "position_name": "Chief Administrative Officer",
        "description": "Supervises core administrative operations and compliance.",
    },
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
    {
        "position_name": "Administrative Officer IV",
        "description": "Handles administrative planning, records, and office operations.",
    },
    {
        "position_name": "Administrative Assistant III",
        "description": "Provides clerical and records support to service units.",
    },
    {
        "position_name": "Attorney III",
        "description": "Provides legal review, opinions, and compliance support.",
    },
    {
        "position_name": "Planning Officer III",
        "description": "Supports strategic planning, monitoring, and reporting.",
    },
    {
        "position_name": "Administrative Aide VI",
        "description": "Delivers frontline administrative and office support services.",
    },
]

PLANTILLA_ITEMS = [
    {
        "item_number": "CSC-HRMD-DIR4-001-2026",
        "division_name": "Human Resource Management Division",
        "position_name": "Director IV",
        "csc_grade": 28,
        "salary_step": 1,
    },
    {
        "item_number": "CSC-HRMD-HRMO4-001-2026",
        "division_name": "Human Resource Management Division",
        "position_name": "Human Resource Management Officer IV",
        "csc_grade": 22,
        "salary_step": 2,
    },
    {
        "item_number": "CSC-HRMD-AO4-001-2026",
        "division_name": "Human Resource Management Division",
        "position_name": "Administrative Officer IV",
        "csc_grade": 15,
        "salary_step": 3,
    },
    {
        "item_number": "CSC-HRMD-AA6-001-2026",
        "division_name": "Human Resource Management Division",
        "position_name": "Administrative Aide VI",
        "csc_grade": 6,
        "salary_step": 2,
    },
    {
        "item_number": "CSC-FAD-CAO-001-2026",
        "division_name": "Finance and Administrative Division",
        "position_name": "Chief Administrative Officer",
        "csc_grade": 24,
        "salary_step": 1,
    },
    {
        "item_number": "CSC-FAD-ACC3-001-2026",
        "division_name": "Finance and Administrative Division",
        "position_name": "Accountant III",
        "csc_grade": 19,
        "salary_step": 2,
    },
    {
        "item_number": "CSC-FAD-ADAS3-001-2026",
        "division_name": "Finance and Administrative Division",
        "position_name": "Administrative Assistant III",
        "csc_grade": 9,
        "salary_step": 4,
    },
    {
        "item_number": "CSC-ISMD-ISA3-001-2026",
        "division_name": "Information Systems Management Division",
        "position_name": "Information Systems Analyst III",
        "csc_grade": 19,
        "salary_step": 1,
    },
    {
        "item_number": "CSC-ISMD-AO4-001-2026",
        "division_name": "Information Systems Management Division",
        "position_name": "Administrative Officer IV",
        "csc_grade": 15,
        "salary_step": 2,
    },
    {
        "item_number": "CSC-PPD-PO3-001-2026",
        "division_name": "Policy and Planning Division",
        "position_name": "Planning Officer III",
        "csc_grade": 18,
        "salary_step": 1,
    },
    {
        "item_number": "CSC-LSD-ATY3-001-2026",
        "division_name": "Legal Services Division",
        "position_name": "Attorney III",
        "csc_grade": 21,
        "salary_step": 1,
    },
    {
        "item_number": "CSC-LSD-AA6-001-2026",
        "division_name": "Legal Services Division",
        "position_name": "Administrative Aide VI",
        "csc_grade": 6,
        "salary_step": 4,
    },
]


def seed_csc_plantilla(apps, schema_editor):
    CSCPlantilla = apps.get_model("core", "CSCPlantilla")
    Division = apps.get_model("core", "Division")
    Position = apps.get_model("core", "Position")
    SalaryGrade = apps.get_model("core", "SalaryGrade")

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

    salary_grade_map = {
        salary_grade.csc_grade: salary_grade
        for salary_grade in SalaryGrade.objects.filter(
            csc_grade__in=[item["csc_grade"] for item in PLANTILLA_ITEMS]
        )
    }

    for item in PLANTILLA_ITEMS:
        CSCPlantilla.objects.get_or_create(
            item_number=item["item_number"],
            defaults={
                "division": division_map[item["division_name"]],
                "position": position_map[item["position_name"]],
                "salary_grade": salary_grade_map[item["csc_grade"]],
                "salary_step": item["salary_step"],
                "created_by": "system_seed",
                "modified_by": "system_seed",
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_cscplantilla"),
    ]

    operations = [
        migrations.RunPython(seed_csc_plantilla, migrations.RunPython.noop),
    ]
