import re

from django.core.exceptions import ValidationError


LEAVE_APPLICATION_DETAIL_FIELD_TYPES = {
    "text",
    "textarea",
    "select",
    "date",
}

LEAVE_APPLICATION_DETAIL_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")

LEAVE_APPLICATION_DETAIL_TEMPLATE_NONE = "none"
LEAVE_APPLICATION_DETAIL_TEMPLATE_TRAVEL = "travel"
LEAVE_APPLICATION_DETAIL_TEMPLATE_SICK = "sick"
LEAVE_APPLICATION_DETAIL_TEMPLATE_PATERNITY = "paternity"
LEAVE_APPLICATION_DETAIL_TEMPLATE_STUDY = "study"
LEAVE_APPLICATION_DETAIL_TEMPLATE_WOMEN_SURGERY = "women_surgery"
LEAVE_APPLICATION_DETAIL_TEMPLATE_CUSTOM = "custom"

LEAVE_APPLICATION_DETAIL_TEMPLATES = {
    LEAVE_APPLICATION_DETAIL_TEMPLATE_NONE: [],
    LEAVE_APPLICATION_DETAIL_TEMPLATE_TRAVEL: [
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
    ],
    LEAVE_APPLICATION_DETAIL_TEMPLATE_SICK: [
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
    ],
    LEAVE_APPLICATION_DETAIL_TEMPLATE_PATERNITY: [
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
    ],
    LEAVE_APPLICATION_DETAIL_TEMPLATE_STUDY: [
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
    ],
    LEAVE_APPLICATION_DETAIL_TEMPLATE_WOMEN_SURGERY: [
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
    ],
}


def _coerce_text(value):
    if value is None:
        return ""

    return str(value).strip()


def normalize_leave_application_detail_schema(schema):
    if schema in (None, "", []):
        return []

    if not isinstance(schema, list):
        raise ValidationError("Application detail schema must be a list of field definitions.")

    normalized_schema = []
    seen_keys = set()
    errors = []

    for index, raw_field in enumerate(schema, start=1):
        prefix = f"Field #{index}"
        if not isinstance(raw_field, dict):
            errors.append(f"{prefix} must be an object.")
            continue

        key = _coerce_text(raw_field.get("key"))
        label = _coerce_text(raw_field.get("label"))
        field_type = _coerce_text(raw_field.get("type"))
        required = bool(raw_field.get("required", False))
        help_text = _coerce_text(raw_field.get("help_text"))
        placeholder = _coerce_text(raw_field.get("placeholder"))
        show_when = raw_field.get("show_when")

        if not key:
            errors.append(f"{prefix} is missing a key.")
            continue

        if not LEAVE_APPLICATION_DETAIL_KEY_PATTERN.match(key):
            errors.append(
                f"{prefix} key '{key}' must start with a letter and use only lowercase letters, numbers, or underscores."
            )
            continue

        if key in seen_keys:
            errors.append(f"{prefix} key '{key}' is duplicated.")
            continue

        if not label:
            errors.append(f"{prefix} must have a label.")
            continue

        if field_type not in LEAVE_APPLICATION_DETAIL_FIELD_TYPES:
            errors.append(
                f"{prefix} type '{field_type}' is invalid. Use one of: text, textarea, select, date."
            )
            continue

        normalized_field = {
            "key": key,
            "label": label,
            "type": field_type,
            "required": required,
            "help_text": help_text,
            "placeholder": placeholder,
            "choices": [],
            "show_when": None,
        }

        if field_type == "select":
            raw_choices = raw_field.get("choices")
            if not isinstance(raw_choices, list) or not raw_choices:
                errors.append(f"{prefix} must define a non-empty choices list.")
                continue

            normalized_choices = []
            seen_choice_values = set()
            for choice_index, raw_choice in enumerate(raw_choices, start=1):
                if not isinstance(raw_choice, dict):
                    errors.append(f"{prefix} choice #{choice_index} must be an object.")
                    continue

                choice_value = _coerce_text(raw_choice.get("value"))
                choice_label = _coerce_text(raw_choice.get("label")) or choice_value

                if not choice_value:
                    errors.append(f"{prefix} choice #{choice_index} is missing a value.")
                    continue

                if choice_value in seen_choice_values:
                    errors.append(f"{prefix} choice value '{choice_value}' is duplicated.")
                    continue

                seen_choice_values.add(choice_value)
                normalized_choices.append({
                    "value": choice_value,
                    "label": choice_label,
                })

            if normalized_choices:
                normalized_field["choices"] = normalized_choices

        if show_when not in (None, "", {}):
            if not isinstance(show_when, dict):
                errors.append(f"{prefix} show_when must be an object.")
            else:
                dependent_field = _coerce_text(show_when.get("field"))
                equals_value = _coerce_text(show_when.get("equals"))

                if not dependent_field:
                    errors.append(f"{prefix} show_when.field is required.")
                elif not LEAVE_APPLICATION_DETAIL_KEY_PATTERN.match(dependent_field):
                    errors.append(f"{prefix} show_when.field '{dependent_field}' is invalid.")
                elif equals_value == "":
                    errors.append(f"{prefix} show_when.equals is required.")
                else:
                    normalized_field["show_when"] = {
                        "field": dependent_field,
                        "equals": equals_value,
                    }

        normalized_schema.append(normalized_field)
        seen_keys.add(key)

    normalized_keys = {field["key"] for field in normalized_schema}
    for field in normalized_schema:
        if field["show_when"] and field["show_when"]["field"] not in normalized_keys:
            errors.append(
                f"Field '{field['label']}' references unknown dependency '{field['show_when']['field']}'."
            )

    if errors:
        raise ValidationError(errors)

    return normalized_schema


def build_leave_application_detail_schema(template_name):
    normalized_template = _coerce_text(template_name) or LEAVE_APPLICATION_DETAIL_TEMPLATE_NONE
    template_schema = LEAVE_APPLICATION_DETAIL_TEMPLATES.get(normalized_template)

    if template_schema is None:
        raise ValidationError(f"Unknown application detail template '{normalized_template}'.")

    return normalize_leave_application_detail_schema(template_schema)


def infer_leave_application_detail_template(schema):
    normalized_schema = normalize_leave_application_detail_schema(schema)

    if not normalized_schema:
        return LEAVE_APPLICATION_DETAIL_TEMPLATE_NONE

    for template_name, template_schema in LEAVE_APPLICATION_DETAIL_TEMPLATES.items():
        if template_name == LEAVE_APPLICATION_DETAIL_TEMPLATE_CUSTOM:
            continue

        if normalize_leave_application_detail_schema(template_schema) == normalized_schema:
            return template_name

    return LEAVE_APPLICATION_DETAIL_TEMPLATE_CUSTOM


def is_leave_application_detail_field_visible(field_config, details):
    show_when = field_config.get("show_when")
    if not show_when:
        return True

    dependent_value = _coerce_text((details or {}).get(show_when["field"]))
    return dependent_value == show_when["equals"]


def normalize_leave_application_details(schema, details):
    normalized_schema = normalize_leave_application_detail_schema(schema)

    if details in (None, "", {}):
        details = {}

    if not isinstance(details, dict):
        raise ValidationError("Application details must be a JSON object.")

    field_lookup = {field["key"]: field for field in normalized_schema}
    errors = []
    normalized_values = {}
    raw_values = {}

    for key in details.keys():
        if key not in field_lookup:
            errors.append(f"Unknown application detail field '{key}'.")

    for field in normalized_schema:
        raw_values[field["key"]] = _coerce_text(details.get(field["key"]))

    for field in normalized_schema:
        key = field["key"]
        value = raw_values[key]

        if not is_leave_application_detail_field_visible(field, raw_values):
            continue

        if field["type"] == "select":
            allowed_values = {choice["value"] for choice in field["choices"]}
            if value and value not in allowed_values:
                errors.append(f"{field['label']} contains an invalid choice.")
                continue

        if field["required"] and not value:
            errors.append(f"{field['label']} is required.")
            continue

        if value:
            normalized_values[key] = value

    if errors:
        raise ValidationError(errors)

    return normalized_values


def format_leave_application_detail_summary(schema, details):
    try:
        normalized_schema = normalize_leave_application_detail_schema(schema)
    except ValidationError:
        normalized_schema = []

    if not isinstance(details, dict) or not details:
        return ""

    choice_lookup = {
        field["key"]: {
            choice["value"]: choice["label"]
            for choice in field.get("choices", [])
        }
        for field in normalized_schema
    }

    summary_parts = []
    raw_values = {
        field["key"]: _coerce_text(details.get(field["key"]))
        for field in normalized_schema
    }

    for field in normalized_schema:
        if not is_leave_application_detail_field_visible(field, raw_values):
            continue

        value = raw_values.get(field["key"], "")
        if not value:
            continue

        if field["type"] == "select":
            value = choice_lookup.get(field["key"], {}).get(value, value)

        summary_parts.append(f"{field['label']}: {value}")

    return "\n".join(summary_parts)
