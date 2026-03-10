from datetime import date, datetime
from decimal import Decimal

from django.db import migrations
from django.utils import timezone


SEEDED_LEAVE_APPLICATIONS = [
    {
        "seed_key": "leave-seed-001",
        "employee_id": "PDS-SEED-001",
        "leave_code": "VL",
        "start_date": date(2026, 2, 18),
        "end_date": date(2026, 2, 20),
        "requested_units": Decimal("3.00"),
        "status": "approved",
        "reason": "System-seeded vacation leave filing for baseline leave history.",
        "supporting_document_reference": "",
        "supporting_document_notes": "Filed in advance and approved by HR.",
        "approved_at": datetime(2026, 2, 14, 9, 0, 0),
    },
    {
        "seed_key": "leave-seed-002",
        "employee_id": "PDS-SEED-002",
        "leave_code": "SL",
        "start_date": date(2026, 3, 6),
        "end_date": date(2026, 3, 6),
        "requested_units": Decimal("1.00"),
        "status": "submitted",
        "reason": "System-seeded pending sick leave filing.",
        "supporting_document_reference": "MED-CERT-2026-002",
        "supporting_document_notes": "Medical certificate attached for HR review.",
        "approved_at": None,
    },
    {
        "seed_key": "leave-seed-003",
        "employee_id": "PDS-SEED-003",
        "leave_code": "WELL",
        "start_date": date(2026, 3, 5),
        "end_date": date(2026, 3, 6),
        "requested_units": Decimal("2.00"),
        "status": "approved",
        "reason": "System-seeded wellness leave filing for health recovery.",
        "supporting_document_reference": "",
        "supporting_document_notes": "Wellness leave approved under the 2026 CSC rule.",
        "approved_at": datetime(2026, 3, 3, 10, 30, 0),
    },
    {
        "seed_key": "leave-seed-004",
        "employee_id": "PDS-SEED-001",
        "leave_code": "SPL",
        "start_date": date(2026, 1, 28),
        "end_date": date(2026, 1, 28),
        "requested_units": Decimal("1.00"),
        "status": "cancelled",
        "reason": "System-seeded cancelled special privilege leave filing.",
        "supporting_document_reference": "",
        "supporting_document_notes": "Cancelled before final approval.",
        "approved_at": None,
    },
    {
        "seed_key": "leave-seed-005",
        "employee_id": "PDS-SEED-002",
        "leave_code": "FVL",
        "start_date": date(2026, 1, 12),
        "end_date": date(2026, 1, 16),
        "requested_units": Decimal("5.00"),
        "status": "approved",
        "reason": "System-seeded mandatory leave filing for annual forced leave compliance.",
        "supporting_document_reference": "",
        "supporting_document_notes": "Agency-scheduled forced leave.",
        "approved_at": datetime(2026, 1, 9, 8, 30, 0),
    },
]


def resolve_balance_bucket(rule, leave_type):
    tracking_mode = getattr(rule, "balance_tracking_mode", "none")

    if tracking_mode == "vacation":
        return {
            "bucket_code": "vacation",
            "bucket_name": "Vacation Leave Credits",
        }

    if tracking_mode == "sick":
        return {
            "bucket_code": "sick",
            "bucket_name": "Sick Leave Credits",
        }

    if tracking_mode == "leave_type":
        return {
            "bucket_code": leave_type.leave_code,
            "bucket_name": leave_type.leave_name,
        }

    return None


def seed_leave_applications(apps, schema_editor):
    Employee = apps.get_model("employee_modules", "Employee")
    LeaveType = apps.get_model("core", "LeaveType")
    LeaveTypeRule = apps.get_model("core", "LeaveTypeRule")
    EmployeeLeaveCredit = apps.get_model("core", "EmployeeLeaveCredit")
    EmployeeLeaveCreditLedger = apps.get_model("core", "EmployeeLeaveCreditLedger")
    LeaveApplication = apps.get_model("core", "LeaveApplication")

    employees = {
        employee.employee_id: employee
        for employee in Employee.objects.all()
    }
    leave_types = {
        leave_type.leave_code: leave_type
        for leave_type in LeaveType.objects.all()
    }
    leave_rules = {
        rule.leave_type_id: rule
        for rule in LeaveTypeRule.objects.select_related("leave_type")
    }

    for record in SEEDED_LEAVE_APPLICATIONS:
        employee = employees.get(record["employee_id"])
        leave_type = leave_types.get(record["leave_code"])
        if not employee or not leave_type:
            continue

        rule = leave_rules.get(leave_type.pk)
        if not rule:
            continue

        bucket = resolve_balance_bucket(rule, leave_type)
        balance_bucket_code = bucket["bucket_code"] if bucket else ""
        deducted_units = record["requested_units"] if bucket else None
        approved_at = (
            timezone.make_aware(record["approved_at"])
            if record["approved_at"] is not None
            else None
        )

        application, created = LeaveApplication.objects.get_or_create(
            employee=employee,
            leave_type=leave_type,
            start_date=record["start_date"],
            end_date=record["end_date"],
            reason=record["reason"],
            defaults={
                "requested_units": record["requested_units"],
                "status": record["status"],
                "supporting_document_reference": record["supporting_document_reference"],
                "supporting_document_notes": record["supporting_document_notes"],
                "balance_bucket_code": balance_bucket_code,
                "deducted_units": deducted_units,
                "approved_at": approved_at,
                "rule_snapshot": {
                    "leave_code": leave_type.leave_code,
                    "leave_name": leave_type.leave_name,
                    "category": leave_type.category,
                    "pay_status": rule.pay_status,
                    "credit_deduction_mode": rule.credit_deduction_mode,
                    "balance_tracking_mode": getattr(rule, "balance_tracking_mode", "none"),
                    "entitlement_value": str(rule.entitlement_value) if rule.entitlement_value is not None else None,
                    "entitlement_unit": rule.entitlement_unit,
                    "entitlement_period": rule.entitlement_period,
                    "requires_supporting_document": rule.requires_supporting_document,
                    "balance_bucket_code": balance_bucket_code or None,
                    "balance_bucket_name": bucket["bucket_name"] if bucket else None,
                },
                "created_by": "system_seed",
                "modified_by": "system_seed",
            },
        )

        if not created:
            continue

        if (
            record["status"] == "approved"
            and balance_bucket_code
            and deducted_units is not None
        ):
            credit = EmployeeLeaveCredit.objects.filter(
                employee=employee,
                bucket_code=balance_bucket_code,
            ).first()
            if not credit:
                continue

            credit.current_balance = credit.current_balance - deducted_units
            credit.save(update_fields=["current_balance", "modified"])

            EmployeeLeaveCreditLedger.objects.create(
                leave_credit=credit,
                entry_type="deduction",
                units_delta=-deducted_units,
                balance_after=credit.current_balance,
                effective_date=record["start_date"],
                reference_type="system_seed",
                reference_id=record["seed_key"],
                notes="System-seeded approved leave application.",
            )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0017_backfill_leave_balance_rules_and_seed_credits"),
    ]

    operations = [
        migrations.RunPython(seed_leave_applications, migrations.RunPython.noop),
    ]
