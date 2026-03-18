# Appointment Management - Database Schema

## Tables

### `appointments`

Primary table for all scheduled appointments. Uses a GiST exclusion constraint to prevent double-booking.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | `UUID` | `uuid_generate_v4()` | NO | Primary key |
| `clinic_id` | `UUID` | - | YES | FK to `clinics.id` (ON DELETE CASCADE) |
| `patient_id` | `UUID` | - | YES | FK to `patients.id` (ON DELETE CASCADE) |
| `provider_id` | `UUID` | - | YES | FK to `providers.id` (ON DELETE SET NULL) |
| `appointment_date` | `DATE` | - | NO | Date of appointment (YYYY-MM-DD) |
| `start_time` | `TIME` | - | NO | Start time (HH:MM:SS) |
| `end_time` | `TIME` | - | NO | End time (HH:MM:SS) |
| `duration` | `INTEGER` | `30` | YES | Duration in minutes |
| `appointment_type` | `TEXT` | `'general'` | YES | Type: general, follow_up, new_patient, consultation |
| `appointment_type_id` | `UUID` | - | YES | FK to `appointment_types.id` (added by migration) |
| `status` | `TEXT` | `'scheduled'` | YES | Status: scheduled, confirmed, checked_in, in_progress, completed, cancelled, no_show |
| `copay_amount` | `DECIMAL(10,2)` | `0` | YES | Copay amount |
| `copay_paid` | `BOOLEAN` | `false` | YES | Whether copay has been paid |
| `copay_paid_at` | `TIMESTAMPTZ` | - | YES | Timestamp of copay payment |
| `reason` | `TEXT` | - | YES | Reason for visit |
| `notes` | `TEXT` | - | YES | Additional notes |
| `cancellation_reason` | `TEXT` | - | YES | Reason for cancellation |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | YES | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | YES | Last update timestamp |

**Constraints:**
- `no_overlap` - GiST exclusion constraint preventing overlapping appointments for the same provider on the same date (excludes cancelled/no_show status). Requires `btree_gist` extension.

**Indexes:**
- Primary key on `id`
- Index on `clinic_id`
- Index on `patient_id`
- Index on `provider_id`
- Index on `appointment_date`
- Index on `status`

---

### `appointment_types`

Stores appointment type definitions with NexHealth integration support.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | NO | Primary key |
| `institution_id` | `INTEGER` | - | YES | FK to `institutions.id` (ON DELETE CASCADE) |
| `location_id` | `INTEGER` | - | YES | FK to `institution_locations.id` (ON DELETE SET NULL) |
| `operatory_id` | `INTEGER` | - | YES | FK to `operatories.id` (ON DELETE SET NULL) |
| `clinic_id` | `UUID` | `DEFAULT_CLINIC_ID` | YES | Clinic association |
| `name` | `VARCHAR(255)` | - | NO | Display name |
| `description` | `TEXT` | - | YES | Description |
| `code` | `VARCHAR(50)` | - | YES | Internal code (e.g., "NEW_PATIENT", "CLEANING") |
| `duration_minutes` | `INTEGER` | `30` | NO | Appointment duration |
| `buffer_before` | `INTEGER` | `0` | YES | Buffer time before (minutes) |
| `buffer_after` | `INTEGER` | `0` | YES | Buffer time after (minutes) |
| `default_price` | `DECIMAL(10,2)` | - | YES | Default price |
| `is_bookable_online` | `BOOLEAN` | `true` | YES | Available for online booking |
| `requires_deposit` | `BOOLEAN` | `false` | YES | Whether deposit is required |
| `deposit_amount` | `DECIMAL(10,2)` | - | YES | Deposit amount |
| `max_per_day` | `INTEGER` | - | YES | Max per day per provider |
| `min_notice_hours` | `INTEGER` | `24` | YES | Minimum booking notice |
| `max_advance_days` | `INTEGER` | `90` | YES | Maximum advance booking |
| `foreign_id` | `VARCHAR(255)` | - | YES | NexHealth appointment_type_id |
| `foreign_id_type` | `VARCHAR(50)` | `'nexhealth'` | YES | Integration source |
| `nexhealth_synced_at` | `TIMESTAMPTZ` | - | YES | Last NexHealth sync |
| `category` | `VARCHAR(100)` | `'general'` | YES | Category: general, hygiene, surgical, consultation, emergency |
| `color` | `VARCHAR(7)` | `'#3B82F6'` | YES | Hex color for calendar |
| `icon` | `VARCHAR(50)` | - | YES | Icon name for UI |
| `sort_order` | `INTEGER` | `0` | YES | Display order |
| `is_active` | `BOOLEAN` | `true` | YES | Active status |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | YES | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | YES | Last update timestamp |

**Indexes:**
- `idx_appointment_types_institution` on `institution_id`
- `idx_appointment_types_location` on `location_id`
- `idx_appointment_types_operatory` on `operatory_id`
- `idx_appointment_types_foreign_id` on `foreign_id`
- `idx_appointment_types_category` on `category`
- `idx_appointment_types_active` on `is_active`
- `idx_appointment_types_nexhealth_unique` - unique index on `foreign_id` WHERE `foreign_id_type = 'nexhealth'`

---

### `provider_availabilities`

Recurring weekly availability schedules for providers.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | NO | Primary key |
| `provider_id` | `UUID` | - | NO | FK to `providers.id` (ON DELETE CASCADE) |
| `location_id` | `INTEGER` | - | YES | FK to `institution_locations.id` (ON DELETE SET NULL) |
| `operatory_id` | `INTEGER` | - | YES | FK to `operatories.id` (ON DELETE SET NULL) |
| `clinic_id` | `UUID` | `DEFAULT_CLINIC_ID` | YES | Clinic association |
| `day_of_week` | `INTEGER` | - | NO | 0=Sunday through 6=Saturday |
| `start_time` | `TIME` | - | NO | Schedule start time |
| `end_time` | `TIME` | - | NO | Schedule end time |
| `effective_from` | `DATE` | `CURRENT_DATE` | YES | Schedule effective start date |
| `effective_until` | `DATE` | - | YES | Schedule end date (NULL = indefinite) |
| `is_active` | `BOOLEAN` | `true` | YES | Whether schedule is active |
| `appointment_type_ids` | `UUID[]` | - | YES | Specific allowed appointment types (NULL = all) |
| `slot_duration_minutes` | `INTEGER` | `30` | YES | Slot duration |
| `buffer_minutes` | `INTEGER` | `0` | YES | Buffer between slots |
| `foreign_id` | `VARCHAR(255)` | - | YES | NexHealth availability_id |
| `foreign_id_type` | `VARCHAR(50)` | `'nexhealth'` | YES | Integration source |
| `nexhealth_synced_at` | `TIMESTAMPTZ` | - | YES | Last NexHealth sync |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | YES | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | YES | Last update timestamp |

**Constraints:**
- `valid_time_range` - CHECK `end_time > start_time`
- `day_of_week` CHECK between 0 and 6

**Indexes:**
- `idx_availabilities_provider` on `provider_id`
- `idx_availabilities_day` on `day_of_week`
- `idx_availabilities_provider_day` on `(provider_id, day_of_week)`
- `idx_availabilities_location` on `location_id`
- `idx_availabilities_active` on `is_active`
- `idx_availabilities_effective` on `(effective_from, effective_until)`
- `idx_availabilities_foreign_id` on `foreign_id`

---

### `provider_availability_overrides`

Specific date exceptions to the recurring availability schedule.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | NO | Primary key |
| `provider_id` | `UUID` | - | NO | FK to `providers.id` (ON DELETE CASCADE) |
| `override_date` | `DATE` | - | NO | Date of override |
| `override_type` | `VARCHAR(50)` | - | NO | Type: unavailable, modified_hours, additional_hours |
| `start_time` | `TIME` | - | YES | Modified start time (for modified/additional hours) |
| `end_time` | `TIME` | - | YES | Modified end time |
| `reason` | `TEXT` | - | YES | Reason for override |
| `location_id` | `INTEGER` | - | YES | FK to `institution_locations.id` |
| `operatory_id` | `INTEGER` | - | YES | FK to `operatories.id` |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | YES | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | YES | Last update timestamp |

**Constraints:**
- UNIQUE on `(provider_id, override_date)` - one override per provider per date

---

### `operatories`

Physical rooms/chairs within clinic locations.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | `INTEGER` | auto-increment | NO | Primary key |
| `institution_id` | `INTEGER` | - | NO | FK to `institutions.id` |
| `location_id` | `INTEGER` | - | YES | FK to `institution_locations.id` |
| `name` | `TEXT` | - | NO | Operatory name |
| `description` | `TEXT` | - | YES | Description |
| `foreign_id` | `TEXT` | - | YES | NexHealth operatory_id |
| `is_active` | `BOOLEAN` | `true` | YES | Active status |
| `is_bookable` | `BOOLEAN` | `true` | YES | Whether bookable for appointments |
| `operatory_type` | `TEXT` | `'general'` | YES | Type: general, hygiene, surgery, consultation, imaging, pediatric, orthodontic, emergency, other |
| `capacity` | `INTEGER` | `1` | YES | Capacity |
| `appointment_types` | `TEXT[]` | `'{}'` | YES | Allowed appointment type codes |
| `appt_categories` | `TEXT[]` | `'{}'` | YES | Allowed appointment categories |
| `metadata` | `JSONB` | `'{}'` | YES | Additional metadata |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | YES | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | YES | Last update timestamp |

## Migrations

| Migration File | Description |
|---------------|-------------|
| `20251203000000_initial_schema.sql` | Creates `appointments` table with GiST exclusion constraint |
| `20260202000000_create_operatories_table.sql` | Creates `operatories` table |
| `20260202100000_create_appointment_types.sql` | Creates `appointment_types` table with NexHealth fields |
| `20260202100001_enhance_appointments.sql` | Adds `appointment_type_id` FK to appointments |
| `20260202100002_create_appointment_slots.sql` | Creates appointment slot tracking |
| `20260202100003_create_availabilities.sql` | Creates `provider_availabilities` and `provider_availability_overrides` |

## Row Level Security

All tables have RLS enabled with "Allow all for authenticated users" policies. This is appropriate for a clinic-internal application where all authenticated staff can view and manage appointments.

## Key Relationships

- `appointments.patient_id` -> `patients.id`
- `appointments.provider_id` -> `providers.id`
- `appointments.appointment_type_id` -> `appointment_types.id`
- `appointments.clinic_id` -> `clinics.id`
- `provider_availabilities.provider_id` -> `providers.id`
- `provider_availabilities.location_id` -> `institution_locations.id`
- `provider_availabilities.operatory_id` -> `operatories.id`
- `appointment_types.institution_id` -> `institutions.id`
- `operatories.institution_id` -> `institutions.id`
