from django.db import migrations


LEAVE_WITHOUT_PAY = {
    "leave_code": "LWOP",
    "leave_name": "Leave Without Pay",
    "category": "special",
    "description": (
        "Authorized leave of absence not charged against leave credits and without salary for the "
        "period of approved absence."
    ),
    "legal_basis": "CSC Omnibus Rules on Leave; CS Form No. 6, Revised 2020",
    "sort_order": 35,
    "is_active": True,
    "is_system_seed": True,
    "created_by": "system_seed",
    "modified_by": "system_seed",
}

LEAVE_WITHOUT_PAY_RULE = {
    "pay_status": "without_pay",
    "credit_deduction_mode": "none",
    "balance_tracking_mode": "none",
    "entitlement_value": None,
    "entitlement_unit": "working_days",
    "entitlement_period": "not_fixed",
    "min_service_months_required": None,
    "advance_notice_days": None,
    "max_consecutive_days": None,
    "requires_earned_leave_credits": False,
    "allows_intermittent": True,
    "requires_supporting_document": False,
    "supporting_document_notes": (
        "Agency may still require supporting justification depending on the cause of absence "
        "or applicable internal policy."
    ),
    "eligibility_notes": (
        "Used for approved absences that are not chargeable to leave credits, including periods "
        "when earned credits are insufficient or unavailable."
    ),
    "filing_notes": (
        "File through the regular leave application process and secure agency approval before the "
        "absence whenever practicable."
    ),
    "rule_notes": (
        "No salary is paid for the approved period and no leave credit bucket is deducted."
    ),
}


def seed_leave_without_pay(apps, schema_editor):
    LeaveType = apps.get_model("core", "LeaveType")
    LeaveTypeRule = apps.get_model("core", "LeaveTypeRule")

    leave_type, _ = LeaveType.objects.update_or_create(
        leave_code=LEAVE_WITHOUT_PAY["leave_code"],
        defaults=LEAVE_WITHOUT_PAY,
    )

    LeaveTypeRule.objects.update_or_create(
        leave_type=leave_type,
        defaults=LEAVE_WITHOUT_PAY_RULE,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0018_seed_leave_applications"),
    ]

    operations = [
        migrations.RunPython(seed_leave_without_pay, migrations.RunPython.noop),
    ]
