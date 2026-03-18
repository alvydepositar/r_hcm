from django.db import migrations


APPROVAL_STEP_DEFINITIONS = (
    ("immediate_supervisor", "immediate_supervisor", "alt_supervisor"),
    ("division_chief", "division_chief", "alt_division_chief"),
    ("hr_approver", "hr_approver", "alt_hr_approver"),
)


def _build_queue_for_application(leave_application_approval_model, application, approver_config):
    if leave_application_approval_model.objects.filter(leave_application_id=application.pk).exists():
        return

    approval_rows = []
    for index, (role_code, primary_field, alternate_field) in enumerate(APPROVAL_STEP_DEFINITIONS):
        approver_employee_id = (
            getattr(approver_config, f"{primary_field}_id", None)
            or getattr(approver_config, f"{alternate_field}_id", None)
        )
        if not approver_employee_id:
            continue

        approval_rows.append(
            leave_application_approval_model(
                leave_application_id=application.pk,
                approver_employee_id=approver_employee_id,
                approver_role=role_code,
                sequence=index + 1,
                status="pending" if not approval_rows else "queued",
            )
        )

    if approval_rows:
        leave_application_approval_model.objects.bulk_create(approval_rows)


def seed_division_approver_routes(apps, schema_editor):
    employee_model = apps.get_model("employee_modules", "Employee")
    approver_model = apps.get_model("hr_modules", "Approver")
    leave_application_model = apps.get_model("core", "LeaveApplication")
    leave_application_approval_model = apps.get_model("core", "LeaveApplicationApproval")

    amelia = employee_model.objects.filter(employee_id="PDS-SEED-001").first()
    miguel = employee_model.objects.filter(employee_id="PDS-SEED-002").first()
    leah = employee_model.objects.filter(employee_id="PDS-SEED-003").first()

    if not all([amelia, miguel, leah]):
        return

    for division in {miguel.division, leah.division}:
        if approver_model.objects.filter(approval_type="division", division_id=division.pk).exists():
            continue

        approver_model.objects.create(
            approval_type="division",
            division_id=division,
            immediate_supervisor=amelia,
            division_chief=miguel,
            hr_approver=leah,
        )

    for application in leave_application_model.objects.filter(status="submitted"):
        approver_config = approver_model.objects.filter(
            approval_type="division",
            division_id=application.employee.division_id,
        ).first()
        if approver_config is not None:
            _build_queue_for_application(
                leave_application_approval_model,
                application,
                approver_config,
            )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0021_seed_rbac_users_and_leave_approvals"),
    ]

    operations = [
        migrations.RunPython(seed_division_approver_routes, migrations.RunPython.noop),
    ]
