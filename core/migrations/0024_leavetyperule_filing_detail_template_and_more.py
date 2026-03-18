from django.db import migrations, models


TRAVEL_SCHEMA = [
    {
        "key": "travel_scope",
        "label": "Travel Scope",
        "type": "select",
        "required": True,
        "help_text": (
            "CSC Form No. 6 requires vacation leave and special privilege leave "
            "to indicate whether the travel is within the Philippines or abroad."
        ),
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
]

SICK_SCHEMA = [
    {
        "key": "medical_context",
        "label": "Medical Context",
        "type": "select",
        "required": True,
        "help_text": (
            "CSC Form No. 6 requires sick leave to indicate whether the case is "
            "in hospital or out patient."
        ),
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
        "placeholder": "State the illness or treatment details for the sick leave request.",
    },
]

PATERNITY_SCHEMA = [
    {
        "key": "paternity_spouse_name",
        "label": "Name of Legitimate Spouse",
        "type": "text",
        "required": True,
        "placeholder": "State the full name of the spouse",
    },
    {
        "key": "paternity_case_type",
        "label": "Paternity Leave Case",
        "type": "select",
        "required": True,
        "help_text": (
            "Paternity leave applies to childbirth or miscarriage of the legitimate spouse."
        ),
        "choices": [
            {"value": "childbirth", "label": "Childbirth"},
            {"value": "miscarriage", "label": "Miscarriage"},
        ],
    },
    {
        "key": "paternity_delivery_date",
        "label": "Expected or Actual Delivery Date",
        "type": "date",
        "required": True,
        "help_text": (
            "CSC rules require notice within a reasonable period before expected "
            "delivery, except in miscarriage and abnormal deliveries."
        ),
    },
    {
        "key": "paternity_delivery_order",
        "label": "Delivery / Miscarriage Count",
        "type": "select",
        "required": True,
        "help_text": (
            "Paternity leave is limited to the first four deliveries or miscarriages "
            "of the legitimate spouse with whom the employee is cohabiting."
        ),
        "choices": [
            {"value": "1", "label": "First"},
            {"value": "2", "label": "Second"},
            {"value": "3", "label": "Third"},
            {"value": "4", "label": "Fourth"},
        ],
    },
]

STUDY_SCHEMA = [
    {
        "key": "study_leave_purpose",
        "label": "Study Leave Purpose",
        "type": "select",
        "required": True,
        "help_text": (
            "CSC Form No. 6 requires study leave to indicate whether it is for "
            "completion of a master's degree, bar/board review, or another purpose."
        ),
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
]

WOMEN_SURGERY_SCHEMA = [
    {
        "key": "surgery_details",
        "label": "Surgery Details",
        "type": "textarea",
        "required": True,
        "help_text": (
            "CSC Form No. 6 requires surgery details for Special Leave Benefits "
            "for Women."
        ),
        "placeholder": (
            "State the gynecological disorder and the surgery or medical "
            "recommendation involved."
        ),
    },
]

TEMPLATE_CONFIG = {
    "VL": ("travel", TRAVEL_SCHEMA),
    "SPL": ("travel", TRAVEL_SCHEMA),
    "SL": ("sick", SICK_SCHEMA),
    "PAT": ("paternity", PATERNITY_SCHEMA),
    "STL": ("study", STUDY_SCHEMA),
    "SLBW": ("women_surgery", WOMEN_SURGERY_SCHEMA),
}

TEMPLATE_LABELS = {
    "none": "No Special Filing Details",
    "travel": "Travel Details",
    "sick": "Sick Leave Details",
    "paternity": "Paternity Leave Details",
    "study": "Study Leave Details",
    "women_surgery": "Women's Surgery Details",
    "custom": "Custom Structured Filing Details",
}


def backfill_filing_detail_templates(apps, schema_editor):
    LeaveTypeRule = apps.get_model("core", "LeaveTypeRule")
    LeaveApplication = apps.get_model("core", "LeaveApplication")

    for rule in LeaveTypeRule.objects.select_related("leave_type"):
        template_name = "none"
        schema = []

        mapped_template = TEMPLATE_CONFIG.get(rule.leave_type.leave_code)
        if mapped_template:
            template_name, schema = mapped_template
        elif rule.application_detail_schema:
            template_name = "custom"
            schema = rule.application_detail_schema

        rule.filing_detail_template = template_name
        rule.travel_abroad_notice_days = None
        rule.application_detail_schema = schema
        rule.save(
            update_fields=[
                "filing_detail_template",
                "travel_abroad_notice_days",
                "application_detail_schema",
            ]
        )

    for application in LeaveApplication.objects.select_related("leave_type__rule"):
        rule = application.leave_type.rule
        snapshot = dict(application.rule_snapshot or {})
        snapshot["filing_detail_template"] = rule.filing_detail_template
        snapshot["filing_detail_template_label"] = TEMPLATE_LABELS.get(
            rule.filing_detail_template,
            rule.filing_detail_template,
        )
        snapshot["travel_abroad_notice_days"] = rule.travel_abroad_notice_days
        snapshot["application_detail_schema"] = rule.application_detail_schema
        application.rule_snapshot = snapshot
        application.save(update_fields=["rule_snapshot"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0023_leave_policy_application_details"),
    ]

    operations = [
        migrations.AddField(
            model_name="leavetyperule",
            name="filing_detail_template",
            field=models.CharField(
                choices=[
                    ("none", "No Special Filing Details"),
                    ("travel", "Travel Details"),
                    ("sick", "Sick Leave Details"),
                    ("paternity", "Paternity Leave Details"),
                    ("study", "Study Leave Details"),
                    ("women_surgery", "Women's Surgery Details"),
                    ("custom", "Custom Structured Filing Details"),
                ],
                default="none",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="leavetyperule",
            name="travel_abroad_notice_days",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(
            backfill_filing_detail_templates,
            migrations.RunPython.noop,
        ),
    ]
