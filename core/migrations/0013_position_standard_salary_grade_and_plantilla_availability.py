from django.db import migrations, models
import django.db.models.deletion


def backfill_position_grades_and_plantilla_availability(apps, schema_editor):
    Employee = apps.get_model("employee_modules", "Employee")
    Position = apps.get_model("core", "Position")
    CSCPlantilla = apps.get_model("core", "CSCPlantilla")

    for position in Position.objects.all():
        grade_ids = list(
            CSCPlantilla.objects.filter(position_id=position.pk)
            .values_list("salary_grade_id", flat=True)
            .distinct()
        )
        if len(grade_ids) == 1:
            position.standard_salary_grade_id = grade_ids[0]
            position.save(update_fields=["standard_salary_grade"])

    employee_counts = {}
    for employee in Employee.objects.all():
        key = (employee.position_id, employee.division_id)
        employee_counts[key] = employee_counts.get(key, 0) + 1

    for plantilla in CSCPlantilla.objects.all():
        plantilla.availability_status = "vacant"
        plantilla.save(update_fields=["availability_status"])

    for (position_id, division_id), total in employee_counts.items():
        plantilla_items = CSCPlantilla.objects.filter(
            position_id=position_id,
            division_id=division_id,
        ).order_by("item_number")

        for index, plantilla in enumerate(plantilla_items):
            desired_status = "filled" if index < total else "vacant"
            if plantilla.availability_status != desired_status:
                plantilla.availability_status = desired_status
                plantilla.save(update_fields=["availability_status"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_seed_cscplantilla"),
        ("employee_modules", "0007_seed_personal_data_sheets"),
    ]

    operations = [
        migrations.AddField(
            model_name="position",
            name="standard_salary_grade",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="positions",
                to="core.salarygrade",
            ),
        ),
        migrations.AddField(
            model_name="cscplantilla",
            name="availability_status",
            field=models.CharField(
                choices=[("vacant", "Vacant"), ("filled", "Filled")],
                default="vacant",
                max_length=20,
            ),
        ),
        migrations.RunPython(
            backfill_position_grades_and_plantilla_availability,
            migrations.RunPython.noop,
        ),
    ]
