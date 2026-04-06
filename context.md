# Project Context

## Overview

`r_hcm` is a Django 5.2 HRIS/HCM redevelopment project with:

- server-rendered Django pages for HR/admin and employee-facing workflows
- Django REST Framework APIs under `/api/`
- Tabulator-based CRUD tables for maintenance screens
- plain JavaScript feature modules with shared helpers
- SQLite as the default local database
- PostgreSQL in the Docker-based local setup

The project currently covers:

- employee master data and organizational structures
- positions, divisions, time rules, salary grades, and CSC plantilla
- employee Personal Data Sheet (PDS)
- approver maintenance
- access-rights management
- CSC-based leave type maintenance and leave credit tracking
- employee leave filing, approval queue, and history
- internal recruitment workflow for hiring requests and job postings
- requestor-side recruitment portal for IT Manager and Division Chief users

The public applicant portal is still planned and is not implemented in this repo yet.

## Tech Stack

- Python / Django 5.2.8
- Django REST Framework 3.16.1
- SQLite for default local development
- PostgreSQL for Docker-based local development
- Bootstrap-based static assets and layout
- Tabulator for maintenance tables
- plain JavaScript with shared helpers in `static/assets/js/helpers.js`
- shared table abstractions in `static/assets/js/tablefactory.js`
- Docker Compose for team onboarding

## Project Layout

- `r_hcm/`
  - project settings, root URLs, ASGI/WSGI
- `core/`
  - core master data models
  - DRF serializers and viewsets
  - recruitment workflow services
  - admin registration
  - tests
- `employee_modules/`
  - employee model
  - employee-facing leave portal views and templates
  - employee PDS model support
- `hr_modules/`
  - internal HR/admin HTML page views and routes
  - approver model
  - HR templates for employee, leave, recruitment, and security pages
- `static/assets/js/`
  - shared helpers, lookup loaders, Tabulator wrappers, and feature scripts
- `static/assets/css/`
  - Tabulator theme and page-specific styles
- `docs/`
  - system overview and recruitment documentation

## Routing

Top-level URL includes in `r_hcm/urls.py`:

- `/admin/`
- `/` -> `core.urls`
- `/employee/` -> `employee_modules.urls`
- `/hr/` -> `hr_modules.urls`

### Internal HR routes

Main HR/admin pages in `hr_modules/urls.py`:

- `/hr/employee-management/`
- `/hr/leave-management/`
- `/hr/recruitment-management/`
- `/hr/recruitment-portal/`
- `/hr/access-rights/`
- `/hr/leave-types/`
- `/hr/leave-credits/`
- `/hr/leave-applications/`
- `/hr/employee-info/`
- `/hr/personal-data-sheet/`
- `/hr/approvers/`
- `/hr/divisions/`
- `/hr/positions/`
- `/hr/time-rules/`
- `/hr/salary-grades/`
- `/hr/csc-plantilla/`

### Employee-facing routes

Main employee portal pages in `employee_modules/urls.py`:

- `/employee/leave-portal/`
- `/employee/leave-history/`
- `/employee/leave-approvals/`

### API routes

Main API endpoints in `core/urls.py`:

- `/api/employees/`
- `/api/access-rights/`
- `/api/personal-data-sheets/`
- `/api/divisions/`
- `/api/positions/`
- `/api/time_rules/`
- `/api/salary_grades/`
- `/api/csc-plantilla/`
- `/api/leave-types/`
- `/api/leave-credits/`
- `/api/leave-credit-ledger/`
- `/api/leave-applications/`
- `/api/leave-approvals/`
- `/api/approvers/`
- `/api/hiring-requests/`
- `/api/hiring-request-approvals/`
- `/api/job-postings/`
- `/api/job-posting-approvals/`
- `/api/public-job-postings/`

## Core Data Domains

### Organizational and HR Master Data

- `Division`
- `Position`
- `TimeRule`
- `Employee`
- `Approver`

### Compensation and Staffing

- `SalaryGrade`
  - CSC salary grade with steps 1-8
- `CSCPlantilla`
  - plantilla item number
  - linked position
  - linked division
  - salary grade and step
  - availability status

### Personal Records

- `EmployeePersonalDataSheet`
  - one PDS per employee
  - stores CSC-style sections using JSON fields for repeatable records
  - renders in a print-friendly CSC-style layout

### Access and Portal Roles

Access in the app is a mix of linked employee records and explicit Django groups:

- `HR`
  - grants HR portal access
- `Recruitment`
  - grants recruitment requestor access
- employee portal access
  - derived from a linked employee record
- approver queue access
  - derived from approver routing assignments

The Access Rights page can assign:

- HR access
- Recruitment access
- active/inactive account status

### Leave Management

- `LeaveType`
  - master leave code and classification
- `LeaveTypeRule`
  - CSC rule schema
  - pay status
  - credit deduction mode
  - balance tracking mode
  - entitlement value / unit / period
  - notice, max consecutive days, and document requirements
- `EmployeeLeaveCredit`
  - employee leave balance bucket
  - supports standard buckets such as `vacation` and `sick`
  - supports leave-type-linked buckets such as `SPL` and `WELL`
- `EmployeeLeaveCreditLedger`
  - opening, accrual, adjustment, deduction, and reversal entries
- `LeaveApplication`
  - leave filing record
  - stores a rule snapshot used during filing
  - deducts or restores credits through workflow hooks
- `LeaveApplicationApproval`
  - approval queue state for employee leave filings

### Recruitment

Implemented recruitment records:

- `HiringRequest`
- `HiringRequestApproval`
- `JobPosting`
- `JobPostingApproval`

Implemented recruitment workflow:

- IT Manager request route:
  - IT Manager -> Division Chief -> HR
- Division Chief request route:
  - Division Chief -> HR
- final HR approval of a hiring request:
  - automatically creates one linked draft `JobPosting`
- HR job posting flow:
  - HR prepares the posting
  - requestor approves or rejects it
  - HR completes final publish approval
- public feed:
  - published postings are exposed through `/api/public-job-postings/`

Current UI split:

- HR users use the internal `Recruitment Workspace`
- recruitment-enabled users and configured Division Chief approvers use the requestor-facing `Recruitment Portal`

## Frontend Conventions

All maintenance tables are standardized around:

- `static/assets/js/tablefactory.js`
  - shared Tabulator wrapper
  - loading states
  - row editing support
  - search binding
  - bulk edit and delete behavior
- `createTableRowEditor(...)`
  - row-level `Edit / Save / Cancel`
  - `Edit All Rows / Save All / Cancel All`
  - bulk deletion support
- `static/assets/js/helpers.js`
  - shared lookup loaders
  - toast/confirm helpers
  - searchable select/dropdown behavior
  - reference format/resolve helpers

Important UI behavior:

- tables are not directly editable by default
- users must click `Edit` or `Edit All Rows`
- searchable select helpers are the default pattern for select fields
- Tabulator is the table standard

Employee-facing pages follow their own feature-script pattern, for example:

- `static/assets/js/employee/leave_portal.js`
- `static/assets/js/employee/recruitment_portal.js`

## Environment and Local Setup

The project supports both:

- local Python virtualenv setup
- Docker Compose setup

Environment handling:

- `r_hcm/settings.py` auto-loads `.env` when present
- database settings can be overridden with env vars
- default local database is SQLite
- Docker setup uses PostgreSQL

Relevant setup files:

- `requirements.txt`
- `.env.example`
- `.env.docker.example`
- `compose.yaml`
- `Dockerfile`
- `README.md`

## Important Files

Core backend:

- `core/models.py`
- `core/serializers.py`
- `core/views.py`
- `core/recruitment_workflow.py`
- `core/tests.py`

HR/internal UI:

- `hr_modules/views.py`
- `hr_modules/urls.py`
- `hr_modules/templates/html/recruitment_management.html`
- `hr_modules/templates/html/security/access_rights.html`

Employee/requestor UI:

- `employee_modules/views.py`
- `employee_modules/urls.py`
- `employee_modules/templates/employee_portal/leave_portal.html`
- `employee_modules/templates/employee_portal/recruitment_portal.html`

Frontend scripts:

- `static/assets/js/helpers.js`
- `static/assets/js/tablefactory.js`
- `static/assets/js/hr/leave/leave_types.js`
- `static/assets/js/hr/leave/employee_leave_credits.js`
- `static/assets/js/hr/leave/leave_applications.js`
- `static/assets/js/hr/recruitment/recruitment_management.js`
- `static/assets/js/hr/security/access_rights.js`
- `static/assets/js/employee/leave_portal.js`
- `static/assets/js/employee/recruitment_portal.js`

Styles:

- `static/assets/css/tabulator-theme.css`

Documentation:

- `README.md`
- `API_CONTRACT.md`
- `docs/SYSTEM_OVERVIEW.md`
- `docs/RECRUITMENT_CENTRAL_DATA.md`

## Local Run and Validation

Common commands:

```powershell
venv\Scripts\python.exe manage.py migrate
venv\Scripts\python.exe manage.py check
venv\Scripts\python.exe manage.py test
venv\Scripts\python.exe manage.py runserver
```

Docker-based commands:

```powershell
docker compose up --build -d
docker compose exec web python manage.py migrate
docker compose exec web python manage.py check
docker compose exec web python manage.py test
```

## Current Caveats

- the public applicant portal UI is still not implemented
- the default non-Docker local database is still SQLite
- production deployment hardening is still pending
- there is no browser-based end-to-end test suite yet
- backend role checks remain the source of truth; frontend visibility should never be trusted as access control

## Practical Notes For Future Work

- preserve the shared Tabulator patterns instead of introducing page-specific CRUD behavior
- when adding select fields, use the searchable select helpers in `helpers.js`
- when adding a CRUD table, prefer `tableFactory` and `createTableRowEditor`
- assign recruitment requestor access through Django groups, not only employee position titles
- only one requestor role should be assigned per account:
  - `IT Manager`
  - `Division Chief`
- if a leave feature affects balances, update both:
  - `EmployeeLeaveCredit.current_balance`
  - `EmployeeLeaveCreditLedger`
- if a recruitment change affects approval routing, update:
  - `core/recruitment_workflow.py`
  - recruitment API tests
  - requestor and HR recruitment UIs
- if a change alters seeded business rules, update the related migration assumptions and tests
