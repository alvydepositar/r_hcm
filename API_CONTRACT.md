# API Contract

This document describes the current Django REST Framework API exposed by this repository.

Scope:
- Current implementation only. This API is not versioned.
- Source of truth: `core/urls.py`, `core/views.py`, `core/serializers.py`, `core/models.py`, `employee_modules/models.py`, and `hr_modules/models.py`.
- Date of contract snapshot: 2026-03-24.

## Overview

- Base API URL: `/api/`
- Authentication model: Django session authentication
- CSRF: required for unsafe browser requests (`POST`, `PUT`, `PATCH`, `DELETE`)
- Content type: `application/json`
- Router style: DRF `DefaultRouter`
- Trailing slash: required
- Pagination: none configured; list endpoints currently return JSON arrays
- Detail routes use the model primary key in the URL; the response body key name varies by resource

Non-API auth routes used by the app:
- `GET/POST /login/`
- `POST /logout/`

## Common Response Rules

- `GET /api/<resource>/` returns an array of objects.
- `GET /api/<resource>/{pk}/` returns a single object.
- `POST` returns the created object on success.
- `PUT` and `PATCH` return the updated object on success.
- `DELETE` returns an empty success response.
- Validation failures return a JSON object keyed by field name or `non_field_errors`.

Example validation payload:

```json
{
  "requested_units": [
    "Requested units exceed the available balance of 3.00 in Vacation Leave Credits."
  ]
}
```

Common formats:
- Date: `YYYY-MM-DD`
- Time: `HH:MM[:SS]`
- Date-time: ISO 8601

## Access Model

### HR-only resources

The following endpoints require an authenticated user who can access the HR portal:

- `/api/employees/`
- `/api/access-rights/`
- `/api/divisions/`
- `/api/positions/`
- `/api/time_rules/`
- `/api/salary_grades/`
- `/api/csc-plantilla/`
- `/api/approvers/`

### Authenticated read, HR write

- `/api/leave-types/`
- `/api/leave-credits/`

All authenticated users may `GET`. Only HR users may `POST`, `PUT`, `PATCH`, or `DELETE`.

### Authenticated scoped resources

- `/api/personal-data-sheets/`
- `/api/leave-credit-ledger/`
- `/api/leave-applications/`
- `/api/leave-approvals/`
- `/api/hiring-requests/`
- `/api/hiring-request-approvals/`
- `/api/job-postings/`
- `/api/job-posting-approvals/`

These endpoints are authenticated for all users, but non-HR users are restricted to records tied to their linked employee profile or assigned approval step.

Additional recruitment access notes:
- `POST /api/hiring-requests/` is limited to recruitment-enabled or superuser accounts.
- `PATCH /api/job-postings/{pk}/` is HR only.
- Public job posting publication is exposed separately through `/api/public-job-postings/`.

### Public read resources

- `/api/public-job-postings/`

This endpoint is unauthenticated and only returns active published postings inside their publish window.

## Endpoint Catalog

| Resource | Path | Methods | Access | Query Params |
| --- | --- | --- | --- | --- |
| Employees | `/api/employees/` | `GET, POST, PUT, PATCH, DELETE` | HR only | none |
| Access Rights | `/api/access-rights/` | `GET, POST, PATCH, DELETE` | HR only | none |
| Personal Data Sheets | `/api/personal-data-sheets/` | `GET, POST, PUT, PATCH, DELETE` | Authenticated; non-HR scoped to own employee | `employee` (HR only) |
| Divisions | `/api/divisions/` | `GET, POST, PUT, PATCH, DELETE` | HR only | none |
| Positions | `/api/positions/` | `GET, POST, PUT, PATCH, DELETE` | HR only | none |
| Time Rules | `/api/time_rules/` | `GET, POST, PUT, PATCH, DELETE` | HR only | none |
| Salary Grades | `/api/salary_grades/` | `GET, POST, PUT, PATCH, DELETE` | HR only | none |
| CSC Plantilla | `/api/csc-plantilla/` | `GET, POST, PUT, PATCH, DELETE` | HR only | `availability_status` |
| Leave Types | `/api/leave-types/` | `GET, POST, PUT, PATCH, DELETE` | Authenticated read; HR write | none |
| Leave Credits | `/api/leave-credits/` | `GET, POST, PUT, PATCH, DELETE` | Authenticated read; HR write; non-HR scoped to own employee | `employee` (HR only), `bucket_code` |
| Leave Credit Ledger | `/api/leave-credit-ledger/` | `GET` | Authenticated; non-HR scoped to own employee | `leave_credit`, `employee` (HR only) |
| Leave Applications | `/api/leave-applications/` | `GET, POST, PUT, PATCH, DELETE` | Authenticated; non-HR scoped to own employee with limited writes | `employee` (HR only), `status` |
| Leave Approvals | `/api/leave-approvals/` | `GET, PATCH` | Authenticated; non-HR scoped to assigned approvals | `status` |
| Approvers | `/api/approvers/` | `GET, POST, PUT, PATCH, DELETE` | HR only | none |
| Hiring Requests | `/api/hiring-requests/` | `GET, POST, PUT, PATCH, DELETE` | Authenticated; non-HR scoped to own requests and assigned approvals; create limited to recruitment-enabled accounts | none |
| Hiring Request Approvals | `/api/hiring-request-approvals/` | `GET, PATCH` | Authenticated; non-HR scoped to assigned approvals | `status` |
| Job Postings | `/api/job-postings/` | `GET, PATCH` | Authenticated; HR write; non-HR read scoped to owned/requested postings or assigned approvals | `status`, `portal_status` |
| Job Posting Approvals | `/api/job-posting-approvals/` | `GET, PATCH` | Authenticated; non-HR scoped to assigned approvals | `status` |
| Public Job Postings | `/api/public-job-postings/` | `GET` | Public read | none |

## Resource Contracts

### Employees

Path:
- `/api/employees/`
- `/api/employees/{pk}/`

Primary key field in body:
- `id`

Writable fields:
- `employee_id`
- `first_name`
- `last_name`
- `middle_name`
- `name_extension`
- `position`
- `division`

Read-only/computed fields:
- `id`
- `division_name`
- `position_name`
- `username`

### Access Rights

Path:
- `/api/access-rights/`
- `/api/access-rights/{pk}/`

Primary key field in body:
- `id`

Methods:
- `GET`
- `POST`
- `PATCH`
- `DELETE`

Writable fields:
- `username`
- `employee`
- `has_hr_access`
- `has_recruitment_access`
- `is_active`
- `password`

Read-only/computed fields:
- `id`
- `employee_name`
- `employee_number`
- `division_name`
- `position_name`
- `has_employee_access`
- `has_approver_access`
- `role_names`
- `is_current_user`
- `last_login`

Important rules:
- HR access is assigned explicitly through the `HR` Django group.
- Recruitment access is assigned explicitly through `has_recruitment_access`.
- `has_employee_access` is derived from a linked employee record and is read-only.
- `has_approver_access` is derived from approver routing and is read-only.
- Division Chief recruitment routing is derived from the linked employee's approver assignment, not from Access Rights.
- `password` is required on `POST` and optional on `PATCH`.
- `employee` may be null, but if provided it cannot already be linked to another user account.
- `username` must be unique.
- A user cannot remove their own HR access.
- A user cannot deactivate their own account.
- Superuser accounts must retain HR access.
- `DELETE` is blocked for:
  - the currently logged-in account
  - superuser accounts

### Personal Data Sheets

Path:
- `/api/personal-data-sheets/`
- `/api/personal-data-sheets/{pk}/`

Primary key field in body:
- `pds_id`

Writable fields:
- `employee`
- `surname`
- `first_name`
- `middle_name`
- `name_extension`
- `date_of_birth`
- `place_of_birth`
- `sex`
- `civil_status`
- `civil_status_other`
- `citizenship`
- `citizenship_basis`
- `dual_citizenship_country`
- `height_m`
- `weight_kg`
- `blood_type`
- `gsis_id_no`
- `pagibig_id_no`
- `philhealth_no`
- `sss_no`
- `tin_no`
- `agency_employee_no`
- `residential_address`
- `permanent_address`
- `telephone_no`
- `mobile_no`
- `email_address`
- `spouse_information`
- `father_information`
- `mother_information`
- `children`
- `educational_background`
- `civil_service_eligibilities`
- `work_experiences`
- `voluntary_works`
- `learning_and_development`
- `special_skills`
- `recognitions`
- `memberships`
- `questionnaire`
- `references`
- `government_id_type`
- `government_id_number`
- `government_id_date_of_issue`
- `government_id_place_of_issue`
- `date_accomplished`
- `created_by`
- `modified_by`

Read-only/computed fields:
- `pds_id`
- `employee_name`
- `employee_number`
- `employee_position_name`
- `employee_division_name`
- `created`
- `modified`

Important rules:
- Non-HR users may only read and write their own personal data sheet.
- One personal data sheet is allowed per employee.
- `references` may contain at most three items.
- The following fields must be JSON arrays when present:
  - `children`
  - `civil_service_eligibilities`
  - `work_experiences`
  - `voluntary_works`
  - `learning_and_development`
  - `special_skills`
  - `recognitions`
  - `memberships`
  - `references`
- The following fields must be JSON objects when present:
  - `residential_address`
  - `permanent_address`
  - `spouse_information`
  - `father_information`
  - `mother_information`
  - `educational_background`
  - `questionnaire`
- For questionnaire detail keys, a `yes` answer requires a non-empty `details` value.

### Divisions

Path:
- `/api/divisions/`
- `/api/divisions/{pk}/`

Primary key field in body:
- `division_id`

Writable fields:
- `division_name`
- `division_abbreviation`
- `created_by`
- `modified_by`

Read-only/computed fields:
- `division_id`
- `created`
- `modified`

### Positions

Path:
- `/api/positions/`
- `/api/positions/{pk}/`

Primary key field in body:
- `position_id`

Writable fields:
- `position_name`
- `description`
- `standard_salary_grade`
- `created_by`
- `modified_by`

Read-only/computed fields:
- `position_id`
- `standard_csc_grade`
- `created`
- `modified`

### Time Rules

Path:
- `/api/time_rules/`
- `/api/time_rules/{pk}/`

Primary key field in body:
- `time_rule_id`

Writable fields:
- `time_rule_name`
- `earliest_in`
- `latest_in`
- `earliest_out`
- `latest_out`
- `lunch_start`
- `lunch_end`
- `lunch_grace_period`
- `created_by`
- `modified_by`

Read-only/computed fields:
- `time_rule_id`
- `created`
- `modified`

### Salary Grades

Path:
- `/api/salary_grades/`
- `/api/salary_grades/{pk}/`

Primary key field in body:
- `salary_grade_id`

Writable fields:
- `csc_grade`
- `step_1`
- `step_2`
- `step_3`
- `step_4`
- `step_5`
- `step_6`
- `step_7`
- `step_8`
- `created_by`
- `modified_by`

Read-only/computed fields:
- `salary_grade_id`
- `created`
- `modified`

### CSC Plantilla

Path:
- `/api/csc-plantilla/`
- `/api/csc-plantilla/{pk}/`

Primary key field in body:
- `plantilla_id`

Supported filters:
- `availability_status`

Writable fields:
- `item_number`
- `position`
- `division`
- `salary_grade`
- `salary_step`
- `availability_status`
- `created_by`
- `modified_by`

Read-only/computed fields:
- `plantilla_id`
- `position_name`
- `position_standard_salary_grade`
- `position_standard_csc_grade`
- `division_name`
- `csc_grade`
- `is_vacant`
- `monthly_salary`
- `annual_salary`
- `created`
- `modified`

Important rules:
- If the selected position has a mapped standard salary grade, `salary_grade` must match it.
- `salary_step` must resolve to an existing salary amount on the chosen salary grade.

### Leave Types

Path:
- `/api/leave-types/`
- `/api/leave-types/{pk}/`

Primary key field in body:
- `leave_type_id`

Writable fields:
- `leave_code`
- `leave_name`
- `category`
- `description`
- `legal_basis`
- `sort_order`
- `is_active`
- `pay_status`
- `credit_deduction_mode`
- `balance_tracking_mode`
- `entitlement_value`
- `entitlement_unit`
- `entitlement_period`
- `min_service_months_required`
- `advance_notice_days`
- `max_consecutive_days`
- `requires_earned_leave_credits`
- `allows_intermittent`
- `requires_supporting_document`
- `supporting_document_notes`
- `eligibility_notes`
- `filing_notes`
- `rule_notes`
- `filing_detail_template`
- `travel_abroad_notice_days`
- `application_detail_schema`
- `created_by`
- `modified_by`

Read-only/computed fields:
- `leave_type_id`
- `category_label`
- `is_system_seed`
- `pay_status_label`
- `credit_deduction_mode_label`
- `balance_tracking_mode_label`
- `entitlement_unit_label`
- `entitlement_period_label`
- `entitlement_summary`
- `filing_detail_template_label`
- `created`
- `modified`

Important rules:
- Rule fields are flattened into the leave-type payload.
- If `balance_tracking_mode` is omitted, it may be auto-derived from `credit_deduction_mode`.
- `application_detail_schema` is normalized and validated.
- Certain rule combinations are invalid, including:
  - earned credits required without a credit-based deduction mode
  - credit-based deduction without earned credits enabled
  - invalid balance tracking for earned-credit leave types
  - `max_consecutive_days` greater than entitlement
  - custom filing-detail template without at least one structured field
  - `travel_abroad_notice_days` on non-travel templates

### Employee Leave Credits

Path:
- `/api/leave-credits/`
- `/api/leave-credits/{pk}/`

Primary key field in body:
- `leave_credit_id`

Supported filters:
- `employee` (HR only)
- `bucket_code`

Writable fields:
- `employee`
- `bucket_code`
- `bucket_name`
- `linked_leave_type`
- `current_balance`
- `notes`
- `created_by`
- `modified_by`

Read-only/computed fields:
- `leave_credit_id`
- `employee_name`
- `employee_number`
- `linked_leave_type_name`
- `created`
- `modified`

Important rules:
- Non-HR users may only view their own leave credits.
- If `linked_leave_type` is set, `bucket_code` and `bucket_name` are forced to the linked leave type code and name.
- The employee and bucket combination must be unique.

### Employee Leave Credit Ledger

Path:
- `/api/leave-credit-ledger/`
- `/api/leave-credit-ledger/{pk}/`

Primary key field in body:
- `id`

Supported filters:
- `leave_credit`
- `employee` (HR only)

Methods:
- `GET` only

All fields are read-only:
- `id`
- `leave_credit`
- `employee_id`
- `employee_name`
- `bucket_code`
- `bucket_name`
- `entry_type`
- `units_delta`
- `balance_after`
- `effective_date`
- `reference_type`
- `reference_id`
- `notes`
- `created`

### Leave Applications

Path:
- `/api/leave-applications/`
- `/api/leave-applications/{pk}/`

Primary key field in body:
- `leave_application_id`

Supported filters:
- `employee` (HR only)
- `status`

Writable fields:
- `employee`
- `leave_type`
- `start_date`
- `end_date`
- `requested_units`
- `status`
- `reason`
- `supporting_document_reference`
- `supporting_document_notes`
- `application_details`
- `created_by`
- `modified_by`

Read-only/computed fields:
- `leave_application_id`
- `employee_name`
- `employee_number`
- `leave_type_name`
- `leave_code`
- `category`
- `category_label`
- `status_label`
- `application_detail_summary`
- `balance_bucket_code`
- `deducted_units`
- `available_balance`
- `entitlement_summary`
- `current_approval_role`
- `current_approval_role_label`
- `current_approver_name`
- `approval_progress`
- `approved_at`
- `rule_snapshot`
- `created`
- `modified`

Important rules:
- Non-HR users may only view their own leave applications.
- Non-HR users may only create applications for their own linked employee record.
- Non-HR users may only update their own submitted application to set `status` to `cancelled`.
- Only HR users may delete leave applications.
- Conversion leave types are not allowed in the standard leave filing workflow.
- `requested_units` is auto-calculated for calendar-day, working-day, and credit-balance leave rules.
- Manual `requested_units` input is required for leave types measured in months or other custom units.
- `application_details` is validated against the leave type's filing-detail schema or the stored `rule_snapshot`.
- Advance notice, travel-abroad notice, maximum consecutive days, supporting-document requirements, and available-balance checks are enforced.
- For approved filings with tracked balance buckets, ledger deduction entries are created automatically.
- Updating an approved filing may create reversal and replacement ledger entries.
- Deleting an approved filing may restore deducted balance through a reversal ledger entry.
- Approval queue synchronization runs on create and update.

### Leave Approvals

Path:
- `/api/leave-approvals/`
- `/api/leave-approvals/{pk}/`

Primary key field in body:
- `leave_application_approval_id`

Supported filters:
- `status`

Methods:
- `GET`
- `PATCH`

Writable fields:
- `status`
- `decision_notes`

Fields present in responses but read-only:
- `leave_application`
- `approver_employee`
- `approver_name`
- `approver_role`
- `approver_role_label`
- `sequence`
- `status_label`
- `acted_at`
- `application_status`
- `application_status_label`
- `employee`
- `employee_name`
- `employee_number`
- `leave_type`
- `leave_type_name`
- `leave_code`
- `start_date`
- `end_date`
- `requested_units`
- `reason`
- `supporting_document_reference`
- `supporting_document_notes`
- `application_details`
- `application_detail_summary`
- `approval_progress`
- `created`
- `modified`

Important rules:
- Non-HR users may only view approval steps assigned to their employee record.
- `PATCH` only accepts `status` values of `approved` or `rejected`.
- Only pending approval steps can be acted on.
- Non-HR approvers may only act on steps assigned to them.
- Approval and rejection actions execute workflow side effects through the approval service functions.

### Approvers

Path:
- `/api/approvers/`
- `/api/approvers/{pk}/`

Primary key field in body:
- `approver_id`

Writable fields:
- `approval_type`
- `employee_id`
- `division_id`
- `immediate_supervisor`
- `alt_supervisor`
- `division_chief`
- `alt_division_chief`
- `hr_approver`
- `alt_hr_approver`

Read-only/computed fields:
- `approver_id`
- `employee_name`
- `division_name`
- `immediate_supervisor_name`
- `alt_supervisor_name`
- `division_chief_name`
- `alt_division_chief_name`
- `hr_approver_name`
- `alt_hr_approver_name`

Important rules:
- Provide either `division_id` or `employee_id`, but not both.
- `approval_type=division` requires `division_id`.
- `approval_type=employee` requires `employee_id`.
- `immediate_supervisor`, `division_chief`, and `hr_approver` are required.
- The same employee cannot be assigned to multiple approver-role fields within one record.
- Division-scoped approver records must be unique per division.
- Employee-scoped approver records must be unique per employee.

### Hiring Requests

Path:
- `/api/hiring-requests/`
- `/api/hiring-requests/{pk}/`

Primary key field in body:
- `hiring_request_id`

Writable fields:
- `requestor_role`
- `division`
- `position`
- `plantilla_item`
- `headcount_requested`
- `employment_type`
- `hiring_reason`
- `target_start_date`
- `justification`
- `status`
- `created_by`
- `modified_by`

Read-only/computed fields:
- `hiring_request_id`
- `request_no`
- `requestor_role_label`
- `requestor_user`
- `requestor_username`
- `requestor_name`
- `division_name`
- `position_name`
- `plantilla_item_number`
- `current_approval_step`
- `current_approval_role_label`
- `approval_progress`
- `created`
- `modified`

Important rules:
- Only recruitment-enabled or superuser accounts may create hiring requests.
- New requests are stored as `draft` unless submitted immediately with `status=submitted`.
- If the requestor role is `it_manager`, submission routes to `Division Chief` then `HR`.
- If the requestor role is `division_chief`, submission routes directly to `HR`.
- Only the request owner or HR may update the request.
- Non-HR users may only edit requests while they are `draft`, `rejected`, or `cancelled`; they may also cancel before final approval.
- `requestor_role` cannot be changed after creation.
- `position` is required.
- `division` is required.
- If `plantilla_item` is provided, it must match the selected `position` and `division`.
- Final HR approval automatically creates one linked draft job posting.

### Hiring Request Approvals

Path:
- `/api/hiring-request-approvals/`
- `/api/hiring-request-approvals/{pk}/`

Primary key field in body:
- `hiring_request_approval_id`

Supported filters:
- `status`

Methods:
- `GET`
- `PATCH`

Writable fields:
- `status`
- `decision_notes`

Fields present in responses but read-only:
- `hiring_request`
- `request_no`
- `request_status`
- `request_status_label`
- `approver_role`
- `approver_role_label`
- `approver_user`
- `approver_username`
- `approver_name`
- `sequence`
- `status_label`
- `acted_at`
- `requestor_username`
- `division`
- `division_name`
- `position`
- `position_name`
- `headcount_requested`
- `employment_type`
- `created`
- `modified`

Important rules:
- Non-HR users may only view approval steps assigned to their account.
- `PATCH` only accepts `status` values of `approved` or `rejected`.
- Only pending approval steps can be acted on.
- Non-HR approvers may only act on steps assigned to them.
- Approval and rejection actions execute workflow side effects through the recruitment workflow service.

### Job Postings

Path:
- `/api/job-postings/`
- `/api/job-postings/{pk}/`

Primary key field in body:
- `job_posting_id`

Supported filters:
- `status`
- `portal_status`

Methods:
- `GET`
- `PATCH`

Writable fields:
- `division`
- `position`
- `plantilla_item`
- `job_title`
- `job_summary`
- `job_description`
- `qualifications`
- `employment_type`
- `work_location`
- `open_slots`
- `status`
- `portal_status`
- `publish_start`
- `publish_end`
- `created_by`
- `modified_by`

Fields present in responses but read-only:
- `job_posting_id`
- `posting_no`
- `hiring_request`
- `requestor_role`
- `requestor_role_label`
- `requestor_user`
- `requestor_username`
- `requestor_name`
- `prepared_by_hr_user`
- `prepared_by_hr_username`
- `division_name`
- `position_name`
- `plantilla_item_number`
- `status_label`
- `portal_status_label`
- `published_at`
- `approval_progress`
- `created`
- `modified`

Important rules:
- Job postings are created automatically from approved hiring requests; API clients cannot create them directly.
- Only HR users may edit job postings.
- `status=pending_requestor_approval` submits the current posting content into the requestor-approval queue.
- Clients cannot manually set `status=published` or `status=pending_hr_publish_approval`; those transitions happen through the approval queue.
- If HR edits posting content after requestor approval or after publication, the posting is reset to `draft` and requires a fresh approval cycle.
- `status=unpublished` hides a published posting without deleting it.
- `status=closed` marks the posting closed and sets the portal status to `closed`.
- `open_slots` must be at least 1.
- If `plantilla_item` is provided, it must match the selected `position` and `division`.
- `publish_end` cannot be earlier than `publish_start`.

### Job Posting Approvals

Path:
- `/api/job-posting-approvals/`
- `/api/job-posting-approvals/{pk}/`

Primary key field in body:
- `job_posting_approval_id`

Supported filters:
- `status`

Methods:
- `GET`
- `PATCH`

Writable fields:
- `status`
- `decision_notes`

Fields present in responses but read-only:
- `job_posting`
- `posting_no`
- `posting_status`
- `posting_status_label`
- `approver_role`
- `approver_role_label`
- `approver_user`
- `approver_username`
- `approver_name`
- `sequence`
- `status_label`
- `acted_at`
- `job_title`
- `division_name`
- `position_name`
- `created`
- `modified`

Important rules:
- Non-HR users may only view approval steps assigned to their account.
- `PATCH` only accepts `status` values of `approved` or `rejected`.
- Only pending approval steps can be acted on.
- The first approval step is the original hiring-request requestor.
- The second approval step is the configured HR approver for the posting division.
- Final HR approval publishes the posting to the public feed and stamps `published_at`.
- Rejection hides the posting from the public feed and marks the posting `rejected`.

### Public Job Postings

Path:
- `/api/public-job-postings/`
- `/api/public-job-postings/{pk}/`

Primary key field in body:
- `job_posting_id`

Methods:
- `GET`

All fields are read-only:
- `job_posting_id`
- `posting_no`
- `job_title`
- `job_summary`
- `job_description`
- `qualifications`
- `employment_type`
- `work_location`
- `open_slots`
- `division_name`
- `position_name`
- `publish_start`
- `publish_end`

Important rules:
- This endpoint is public and does not require authentication.
- Only records with `status=published` and `portal_status=published` are included.
- Records outside the configured publish window are excluded.
- This feed is intended for the public applicant portal and does not expose internal approval metadata.

## Notes for Frontend/API Consumers

- This API currently serves both HR/admin pages and employee-facing flows.
- The API is session-oriented, not token-oriented.
- Several resources expose read-only denormalized display fields to reduce extra lookup requests.
- Recruitment workflow data is split between internal authenticated endpoints and the public applicant-portal feed.
- Some fields are writable in the serializer but function as audit metadata only:
  - `created_by`
  - `modified_by`
- Because there is no explicit API versioning yet, frontend clients should treat this contract as tightly coupled to the current backend revision.

## Recommended Next Step

If this contract will be consumed by a separate frontend, the next useful deliverables would be:
- an `OpenAPI` schema or equivalent machine-readable contract
- standardized error envelopes
- explicit API versioning such as `/api/v1/`
- a dedicated auth contract for browser clients
