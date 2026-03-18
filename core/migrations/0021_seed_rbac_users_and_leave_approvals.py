from django.contrib.auth.hashers import make_password
from django.db import migrations


ROLE_HR = "HR"
ROLE_EMPLOYEE = "Employee"
ROLE_APPROVER = "Approver"

APPROVAL_STEP_DEFINITIONS = (
    ("immediate_supervisor", "immediate_supervisor", "alt_supervisor"),
    ("division_chief", "division_chief", "alt_division_chief"),
    ("hr_approver", "hr_approver", "alt_hr_approver"),
)

SEEDED_USER_CONFIG = {
    "PDS-SEED-001": {
        "username": "amelia.rivera",
        "password": "HrPortal@2026",
        "is_staff": True,
        "groups": [ROLE_HR, ROLE_EMPLOYEE],
    },
    "PDS-SEED-002": {
        "username": "miguel.bautista",
        "password": "Approver@2026",
        "is_staff": False,
        "groups": [ROLE_EMPLOYEE],
    },
    "PDS-SEED-003": {
        "username": "leah.torres",
        "password": "Approver@2026",
        "is_staff": False,
        "groups": [ROLE_EMPLOYEE],
    },
}


def _resolve_approver_config(approver_model, employee):
    employee_config = approver_model.objects.filter(
        approval_type="employee",
        employee_id=employee.pk,
    ).first()
    if employee_config is not None:
        return employee_config

    return approver_model.objects.filter(
        approval_type="division",
        division_id=employee.division_id,
    ).first()


def seed_rbac_users_and_approvals(apps, schema_editor):
    user_model = apps.get_model("auth", "User")
    group_model = apps.get_model("auth", "Group")
    employee_model = apps.get_model("employee_modules", "Employee")
    approver_model = apps.get_model("hr_modules", "Approver")
    leave_application_model = apps.get_model("core", "LeaveApplication")
    leave_application_approval_model = apps.get_model("core", "LeaveApplicationApproval")

    groups = {
        name: group_model.objects.get_or_create(name=name)[0]
        for name in [ROLE_HR, ROLE_EMPLOYEE, ROLE_APPROVER]
    }

    for employee in employee_model.objects.select_related("division").all():
        config = SEEDED_USER_CONFIG.get(employee.employee_id, {})
        username = config.get("username", employee.employee_id.lower())
        password = config.get("password", "Employee@2026")

        user, _ = user_model.objects.get_or_create(
            username=username,
            defaults={
                "first_name": employee.first_name,
                "last_name": employee.last_name,
                "is_staff": config.get("is_staff", False),
            },
        )

        user.first_name = employee.first_name
        user.last_name = employee.last_name
        user.is_staff = config.get("is_staff", user.is_staff)
        user.password = make_password(password)
        user.save(update_fields=["first_name", "last_name", "is_staff", "password"])

        employee.user_id = user.pk
        employee.save(update_fields=["user"])

        groups[ROLE_EMPLOYEE].user_set.add(user)
        for group_name in config.get("groups", []):
            groups[group_name].user_set.add(user)

    approver_employee_ids = set()
    for approver in approver_model.objects.all():
        for field_name in (
            "immediate_supervisor_id",
            "alt_supervisor_id",
            "division_chief_id",
            "alt_division_chief_id",
            "hr_approver_id",
            "alt_hr_approver_id",
        ):
            employee_id = getattr(approver, field_name, None)
            if employee_id:
                approver_employee_ids.add(employee_id)

    for employee in employee_model.objects.filter(pk__in=approver_employee_ids):
        if employee.user_id:
            groups[ROLE_APPROVER].user_set.add(user_model.objects.get(pk=employee.user_id))

    for application in leave_application_model.objects.select_related("employee").filter(status="submitted"):
        if leave_application_approval_model.objects.filter(leave_application_id=application.pk).exists():
            continue

        approver_config = _resolve_approver_config(approver_model, application.employee)
        if approver_config is None:
            continue

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


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0020_leaveapplicationapproval"),
        ("hr_modules", "0005_alter_approver_division_id_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_rbac_users_and_approvals, migrations.RunPython.noop),
    ]
