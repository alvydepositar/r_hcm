# Project Context

## Overview

`r_hcm` is a Django 5.2 HRIS/HCM redevelopment project with:

- server-rendered Django pages
- Django REST Framework CRUD APIs
- Tabulator-based maintenance tables on the frontend
- SQLite as the current local database

The project currently covers:

- employee maintenance
- divisions, positions, time rules
- CSC salary grade matrix
- CSC plantilla
- employee Personal Data Sheet (PDS)
- approver maintenance
- CSC-based leave type maintenance
- employee leave credits
- leave applications

## Tech Stack

- Python / Django 5.2.8
- Django REST Framework
- SQLite (`db.sqlite3`) in local settings
- Bootstrap-based admin template assets
- Tabulator for all CRUD tables
- plain JavaScript with shared helpers in `static/assets/js/helpers.js`

## Project Layout

- `r_hcm/`
  - project settings, root URLs, ASGI/WSGI
- `core/`
  - core master data models
  - API serializers and DRF viewsets
  - admin registration
  - tests
- `employee_modules/`
  - employee record
  - employee PDS model and seeds
- `hr_modules/`
  - HTML page views and routes
  - approver model
  - feature templates for Employee and Leave Management
- `static/assets/js/`
  - shared Tabulator table factory and lookup helpers
- `static/assets/css/`
  - Tabulator theme and PDS print styles

## Routing

Top-level URL includes in `r_hcm/urls.py`:

- `/admin/`
- `/` -> `core.urls`
- `/employee/` -> `employee_modules.urls`
- `/hr/` -> `hr_modules.urls`

Main HR pages in `hr_modules/urls.py`:

- `/hr/employee-management/`
- `/hr/leave-management/`
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

Main API endpoints in `core/urls.py`:

- `/api/employees/`
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
- `/api/approvers/`

## Core Data Domains

### Organizational / HR Master Data

- `Division`
- `Position`
- `TimeRule`
- `Employee`
- `Approver`

### Compensation / Staffing

- `SalaryGrade`
  - CSC salary grade with steps 1-8
- `CSCPlantilla`
  - plantilla item number
  - position
  - division
  - salary grade and step
  - vacancy / availability status

### Personal Records

- `EmployeePersonalDataSheet`
  - one PDS per employee
  - stores CSC-style PDS sections using JSON fields for repeatable sections
  - printable CSC-style layout is rendered from a dedicated print partial

### Leave Management

- `LeaveType`
  - master leave code and classification
- `LeaveTypeRule`
  - CSC rule schema
  - pay status
  - credit deduction mode
  - balance tracking mode
  - entitlement value / unit / period
  - notice / max consecutive days / document requirements
- `EmployeeLeaveCredit`
  - employee balance bucket
  - supports standard buckets like `vacation` and `sick`
  - also supports leave-type-linked buckets like `SPL` or `WELL`
- `EmployeeLeaveCreditLedger`
  - opening, accrual, adjustment, deduction, reversal entries
- `LeaveApplication`
  - leave filing record
  - stores snapshot of the rule used during filing
  - deducts credits on approval
  - reverses credits when an approved application is deleted or reverted

## Frontend Conventions

All maintenance tables are standardized around:

- `static/assets/js/tablefactory.js`
  - shared Tabulator wrapper
  - loading states
  - search binding
  - bulk edit buttons
  - delete-selected visibility
- `createTableRowEditor(...)`
  - row-level `Edit / Save / Cancel`
  - `Edit All Rows / Save All / Cancel All`
  - bulk deletion support
- `static/assets/js/helpers.js`
  - shared lookup loaders
  - searchable select/dropdown behavior
  - reference format/resolve helpers

Important UI behavior:

- tables are not directly editable by default
- users must click `Edit` or `Edit All Rows`
- all select editors are searchable
- DataTables has been removed; Tabulator is the table standard

## Seeded Baseline Data

Current local database snapshot:

- divisions: `5`
- positions: `10`
- salary grades: `33`
- plantilla items: `12`
- leave types: `16`
- leave credits: `12`
- leave applications: `5`
- employees: `3`
- PDS records: `3`
- approvers: `0`

Seed sources currently implemented through migrations:

- salary grade schedule
- CSC plantilla baseline
- leave types
- leave balance backfill + opening balances
- leave applications
- employee PDS baseline

## Key Leave Rules Implemented

- conversion leave types are blocked from the standard leave filing workflow
- tracked balance buckets currently include:
  - `vacation`
  - `sick`
  - leave-type-linked buckets such as `SPL` and `WELL`
- leave filing validation currently enforces:
  - start/end date validity
  - supporting document requirements
  - max consecutive days
  - advance notice days
  - sufficient available balance for tracked buckets
- working-day and calendar-day requests are auto-computed from dates

## Important Files

- `core/models.py`
- `core/serializers.py`
- `core/views.py`
- `core/tests.py`
- `hr_modules/views.py`
- `hr_modules/urls.py`
- `static/assets/js/tablefactory.js`
- `static/assets/js/helpers.js`
- `static/assets/css/tabulator-theme.css`

Leave feature pages:

- `hr_modules/templates/html/leave/leave_types.html`
- `hr_modules/templates/html/leave/employee_leave_credits.html`
- `hr_modules/templates/html/leave/leave_applications.html`

Leave feature scripts:

- `static/assets/js/hr/leave/leave_types.js`
- `static/assets/js/hr/leave/employee_leave_credits.js`
- `static/assets/js/hr/leave/leave_applications.js`

## Local Run / Validation

Common commands:

```powershell
venv\Scripts\python.exe manage.py migrate
venv\Scripts\python.exe manage.py check
venv\Scripts\python.exe manage.py test
venv\Scripts\python.exe manage.py runserver
```

## Current Caveats

- `README.md` is still minimal.
- `r_hcm/settings.py` is still in local-dev form:
  - hardcoded `SECRET_KEY`
  - `DEBUG = True`
  - empty `ALLOWED_HOSTS`
  - SQLite only
- permissions/auth hardening is not fully implemented yet for HTML views and APIs.
- there is no browser-based automated test suite; coverage is currently Django test based.

## Practical Notes For Future Work

- preserve the shared Tabulator behavior instead of creating page-specific table patterns
- when adding select fields, use the searchable select helpers in `helpers.js`
- when adding a CRUD table, use `tableFactory` and `createTableRowEditor`
- if a leave feature affects balances, update both:
  - `EmployeeLeaveCredit.current_balance`
  - `EmployeeLeaveCreditLedger`
- if a change alters seeded business rules, update the related migration assumptions and tests

