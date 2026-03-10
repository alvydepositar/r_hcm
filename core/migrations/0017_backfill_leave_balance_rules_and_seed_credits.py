from decimal import Decimal
from datetime import date

from django.db import migrations


BALANCE_TRACKING_BY_LEAVE_CODE = {
    "VL": "vacation",
    "FVL": "vacation",
    "SL": "sick",
    "SPL": "leave_type",
    "WELL": "leave_type",
}

OPENING_BALANCE_BY_BUCKET = {
    "vacation": {
        "bucket_name": "Vacation Leave Credits",
        "balance": Decimal("15.00"),
        "linked_leave_code": None,
    },
    "sick": {
        "bucket_name": "Sick Leave Credits",
        "balance": Decimal("15.00"),
        "linked_leave_code": None,
    },
    "SPL": {
        "bucket_name": "Special Privilege Leave",
        "balance": Decimal("3.00"),
        "linked_leave_code": "SPL",
    },
    "WELL": {
        "bucket_name": "Wellness Leave",
        "balance": Decimal("5.00"),
        "linked_leave_code": "WELL",
    },
}


def backfill_leave_balance_rules_and_seed_credits(apps, schema_editor):
    LeaveType = apps.get_model("core", "LeaveType")
    LeaveTypeRule = apps.get_model("core", "LeaveTypeRule")
    EmployeeLeaveCredit = apps.get_model("core", "EmployeeLeaveCredit")
    EmployeeLeaveCreditLedger = apps.get_model("core", "EmployeeLeaveCreditLedger")
    Employee = apps.get_model("employee_modules", "Employee")

    leave_types = {
        leave_type.leave_code: leave_type
        for leave_type in LeaveType.objects.all()
    }

    for leave_code, tracking_mode in BALANCE_TRACKING_BY_LEAVE_CODE.items():
        leave_type = leave_types.get(leave_code)
        if not leave_type:
            continue

        LeaveTypeRule.objects.filter(leave_type=leave_type).update(
            balance_tracking_mode=tracking_mode,
        )

    for employee in Employee.objects.all():
        for bucket_code, config in OPENING_BALANCE_BY_BUCKET.items():
            linked_leave_type = None
            if config["linked_leave_code"]:
                linked_leave_type = leave_types.get(config["linked_leave_code"])

            credit, created = EmployeeLeaveCredit.objects.get_or_create(
                employee=employee,
                bucket_code=bucket_code,
                defaults={
                    "bucket_name": config["bucket_name"],
                    "linked_leave_type": linked_leave_type,
                    "current_balance": config["balance"],
                    "notes": "System-seeded opening balance for leave management.",
                    "created_by": "system_seed",
                    "modified_by": "system_seed",
                },
            )

            if not created:
                if linked_leave_type and credit.linked_leave_type_id != linked_leave_type.pk:
                    credit.linked_leave_type = linked_leave_type
                if not credit.bucket_name:
                    credit.bucket_name = config["bucket_name"]
                if not credit.current_balance:
                    credit.current_balance = config["balance"]
                credit.save()

            if not EmployeeLeaveCreditLedger.objects.filter(
                leave_credit=credit,
                entry_type="opening",
                reference_type="system_seed",
            ).exists():
                EmployeeLeaveCreditLedger.objects.create(
                    leave_credit=credit,
                    entry_type="opening",
                    units_delta=credit.current_balance,
                    balance_after=credit.current_balance,
                    effective_date=date(2026, 1, 1),
                    reference_type="system_seed",
                    reference_id=f"{employee.pk}:{bucket_code}",
                    notes="System-seeded opening leave balance.",
                )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0016_leavetyperule_balance_tracking_mode_and_more"),
    ]

    operations = [
        migrations.RunPython(
            backfill_leave_balance_rules_and_seed_credits,
            migrations.RunPython.noop,
        ),
    ]
