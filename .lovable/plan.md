
# Pasimo Admin Panel — Full Expansion Plan

Big scope. I'll build it in **3 phases** so you can review progress instead of waiting for one giant drop. Say "go" to start Phase 1, or tell me to reorder.

## Phase 1 — Data foundation & Employee CRUD

**Database (migration)**
- New `departments` table (name, manager_id, employee count via view)
- New `notifications` table (title, body, audience: all/department/user, channel)
- New `company_settings` table (single row: name, logo_url, address, timezone, working_hours_start/end, grace_minutes)
- Extend `profiles`: `joining_date`, `status` (active/inactive), `department_id` (FK), `shift_id` (FK), `location_id` (FK), `avatar_url` already exists
- Extend `attendance_settings`: `require_checkin_selfie`, `enable_selfie` toggles
- Storage bucket `avatars` (public) for profile photos + `company` for logo
- RLS + GRANTs for every new table

**Admin creates employees (server function)**
- `createEmployee` serverFn (admin-only) using `supabaseAdmin.auth.admin.createUser` → sets email/password, inserts profile with all fields, assigns role, links dept/shift/location
- Welcome email toggle (uses existing Lovable email infra if enabled; skipped otherwise)

**UI**
- **Employees page**: search, filter (dept/status), sort, pagination, "Add Employee" dialog with all fields incl. photo upload, edit, activate/deactivate, delete, reset password
- **Departments page** (new): CRUD + assign manager + employee count
- **Dashboard**: 4 Quick Action cards (Add Employee, Add Department, Reports, Settings)

## Phase 2 — Attendance, Shifts, Leave polish

- **Attendance page** (new admin view): tabs Today/Week/Month/By-employee, table with selfie thumbnail + GPS link, edit/approve/mark-absent, export CSV
- **Shifts**: add grace period field, assign employees (multi-select)
- **Leave**: already exists — add filter by type/status + history view
- **Geofence/Selfie settings**: toggle checkin/checkout selfie requirement, enable/disable geofence (already partially done — polish UI)

## Phase 3 — Reports, Notifications, Company Settings

- **Reports**: presets (Daily/Weekly/Monthly/Dept/Employee/Late/Absence), CSV + Excel (xlsx) + PDF (jspdf) export
- **Notifications**: compose to all / department / individual; in-app bell dropdown reads unread; email channel via existing infra
- **Company Settings**: name, logo upload, address, timezone, working hours, late rules — bind logo/name into sidebar & top bar

## Notes / trade-offs

- **WhatsApp notifications** — marked as future in your PRD, so I'll leave a stub only.
- **PDF export** adds `jspdf` + `jspdf-autotable` (~100kb). OK?
- **Welcome email** requires Lovable Email domain setup — I'll wire the code path; if no domain, it silently skips and you can enable later.
- I won't rebuild things already working (auth, check-in/out selfie+GPS, basic reports CSV, basic shifts/leave/locations).

**Reply "go" and I'll start Phase 1.** Or tell me to skip/reorder phases.
