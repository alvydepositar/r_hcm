from django.db import migrations, models


LEAVE_APPLICATION_DETAIL_SCHEMAS = {
    "VL": [
        {
            "key": "travel_scope",
            "label": "Travel Scope",
            "type": "select",
            "required": True,
            "help_text": "CSC Form No. 6 requires vacation leave to indicate whether the travel is within the Philippines or abroad.",
            "choices": [
                {"value": "within_philippines", "label": "Within the Philippines"},
                {"value": "abroad", "label": "Abroad"},
            ],
        },
        {
            "key": "travel_destination",
            "label": "Destination",
            "type": "text",
            "required": True,
            "placeholder": "City, province, or country",
        },
    ],
    "SPL": [
        {
            "key": "travel_scope",
            "label": "Travel Scope",
            "type": "select",
            "required": True,
            "help_text": "CSC Form No. 6 uses the same travel-location detail block for vacation leave and special privilege leave.",
            "choices": [
                {"value": "within_philippines", "label": "Within the Philippines"},
                {"value": "abroad", "label": "Abroad"},
            ],
        },
        {
            "key": "travel_destination",
            "label": "Destination",
            "type": "text",
            "required": True,
            "placeholder": "City, province, or country",
        },
    ],
    "SL": [
        {
            "key": "medical_context",
            "label": "Medical Context",
            "type": "select",
            "required": True,
            "help_text": "CSC Form No. 6 requires sick leave to indicate whether the case is in hospital or out patient.",
            "choices": [
                {"value": "in_hospital", "label": "In Hospital"},
                {"value": "out_patient", "label": "Out Patient"},
            ],
        },
        {
            "key": "illness_details",
            "label": "Illness / Treatment Details",
            "type": "textarea",
            "required": True,
            "placeholder": "State the illness or the treatment context for the sick leave request.",
        },
    ],
    "STL": [
        {
            "key": "study_leave_purpose",
            "label": "Study Leave Purpose",
            "type": "select",
            "required": True,
            "help_text": "CSC Form No. 6 requires study leave to indicate whether it is for completion of a master's degree, bar/board review, or another purpose.",
            "choices": [
                {"value": "masters_completion", "label": "Completion of Master's Degree"},
                {"value": "bar_board_review", "label": "BAR / Board Examination Review"},
                {"value": "other", "label": "Other"},
            ],
        },
        {
            "key": "study_leave_other_purpose",
            "label": "Other Study Leave Purpose",
            "type": "text",
            "required": True,
            "placeholder": "Specify the other study leave purpose",
            "show_when": {
                "field": "study_leave_purpose",
                "equals": "other",
            },
        },
    ],
    "SLBW": [
        {
            "key": "surgery_details",
            "label": "Surgery Details",
            "type": "textarea",
            "required": True,
            "help_text": "CSC Form No. 6 requires the surgery details for Special Leave Benefits for Women.",
            "placeholder": "State the gynecological disorder and the surgery or medical recommendation involved.",
        },
    ],
}


def seed_leave_policy_application_details(apps, schema_editor):
    LeaveType = apps.get_model("core", "LeaveType")
    LeaveTypeRule = apps.get_model("core", "LeaveTypeRule")
    LeaveApplication = apps.get_model("core", "LeaveApplication")

    for leave_code, schema in LEAVE_APPLICATION_DETAIL_SCHEMAS.items():
        leave_type = LeaveType.objects.filter(leave_code=leave_code).first()
        if leave_type is None:
            continue

        LeaveTypeRule.objects.filter(leave_type=leave_type).update(
            application_detail_schema=schema,
        )

        for application in LeaveApplication.objects.filter(leave_type=leave_type):
            snapshot = dict(application.rule_snapshot or {})
            snapshot["application_detail_schema"] = schema
            application.rule_snapshot = snapshot
            application.save(update_fields=["rule_snapshot"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0022_seed_division_approver_routes"),
    ]

    operations = [
        migrations.AddField(
            model_name="leaveapplication",
            name="application_details",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="leavetyperule",
            name="application_detail_schema",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(
            seed_leave_policy_application_details,
            migrations.RunPython.noop,
        ),
    ]
