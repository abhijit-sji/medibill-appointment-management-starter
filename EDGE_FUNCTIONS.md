# Appointment Management - Edge Functions

## Overview

The appointment management module uses NexHealth-related edge functions for syncing external scheduling data. These functions are shared with the nexhealth-integration module.

## Edge Functions

### `nexhealth-appointments`

**Path:** `supabase/functions/nexhealth-appointments/index.ts`

**Purpose:** Sync appointments between NexHealth and the local database.

**Authentication:** JWT verified (requires authenticated session)

**Endpoints:**
- `GET ?action=sync` - Pull appointments from NexHealth and upsert into local `appointments` table
- `GET ?action=list` - List appointments from NexHealth API
- `POST` - Create appointment in NexHealth and sync back

**Request/Response:**
```
GET /functions/v1/nexhealth-appointments?action=sync
Authorization: Bearer <jwt>

Response:
{
  "success": true,
  "synced": 15,
  "errors": 0,
  "message": "Synced 15 appointments from NexHealth"
}
```

**Data Transform:** NexHealth appointments are mapped to local schema:
- `nexhealth.id` -> `appointments.nexhealth_appointment_id`
- `nexhealth.start_time` (ISO8601) -> `appointments.appointment_date` + `appointments.start_time`
- `nexhealth.patient_id` -> matched by `patients.nexhealth_patient_id`
- `nexhealth.provider_id` -> matched by `providers.nexhealth_provider_id`

---

### `nexhealth-availabilities`

**Path:** `supabase/functions/nexhealth-availabilities/index.ts`

**Purpose:** Sync provider availability schedules from NexHealth.

**Authentication:** JWT verified

**Endpoints:**
- `GET ?action=sync` - Pull availabilities and upsert into `provider_availabilities`
- `GET ?action=sync&provider_id=<uuid>` - Sync for specific provider

**Called By:**
- `availabilities.service.ts` -> `syncAvailabilitiesFromNexHealth()` (frontend trigger)
- Availabilities page NexHealth sync button

**Response:**
```json
{
  "success": true,
  "synced": 8,
  "errors": 0,
  "message": "Synced 8 availabilities from NexHealth"
}
```

---

### `nexhealth-appointment-types`

**Path:** `supabase/functions/nexhealth-appointment-types/index.ts`

**Purpose:** Sync appointment type definitions from NexHealth.

**Authentication:** JWT verified

**Endpoints:**
- `GET ?action=sync` - Pull appointment types and upsert into `appointment_types`
- `GET ?action=list` - List appointment types from NexHealth

**Data Mapping:**
- `nexhealth.id` -> `appointment_types.foreign_id`
- `nexhealth.name` -> `appointment_types.name`
- `nexhealth.minutes` -> `appointment_types.duration_minutes`
- `nexhealth.bookable_online` -> `appointment_types.is_bookable_online`

---

### `nexhealth-operatories`

**Path:** `supabase/functions/nexhealth-operatories/index.ts`

**Purpose:** Sync operatory/room definitions from NexHealth.

**Authentication:** JWT verified

**Endpoints:**
- `GET ?action=sync` - Pull operatories and upsert into `operatories`

**Data Mapping:**
- `nexhealth.id` -> `operatories.foreign_id`
- `nexhealth.name` -> `operatories.name`

---

### `nexhealth-slots`

**Path:** `supabase/functions/nexhealth-slots/index.ts`

**Purpose:** Query real-time available appointment slots from NexHealth.

**Authentication:** JWT verified

**Endpoints:**
- `GET ?provider_id=<id>&start_date=<date>&end_date=<date>` - Get available slots

**Response:**
```json
[
  {
    "lid": 12345,
    "pid": 67890,
    "operatory_id": 111,
    "slots": [
      { "time": "2026-03-20T09:00:00-05:00", "operatory_id": 111, "provider_id": 67890 }
    ]
  }
]
```

**Validation:** Response data validated using `NexHealthAppointmentSlotsDataSchema` from `appointment.schema.ts`.

## Shared Edge Function Utilities

### `supabase/functions/shared/availability.ts`

Shared logic for checking provider availability, used by the voice AI `voice-stream` function during real-time call handling.

**Key Functions:**
- `checkProviderAvailability(providerId, date)` - Check if a provider is available on a given date/time
- `getNextAvailableSlot(providerId, fromDate)` - Find the next available appointment slot

### `supabase/functions/shared/booking.ts`

Shared logic for creating appointments, used by both the frontend service layer and the voice AI agent.

**Key Functions:**
- `bookAppointment(patientId, providerId, date, time)` - Create a new appointment with validation
- `validateBookingRequest(data)` - Validate booking parameters

## Deployment

### Deploy All Appointment-Related Functions

```bash
supabase functions deploy nexhealth-appointments --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy nexhealth-availabilities --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy nexhealth-appointment-types --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy nexhealth-operatories --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy nexhealth-slots --project-ref qdnpztafkuprifwwqcgj
```

### Required Secrets

These are set in the Supabase project or stored in `integration_settings`:
- `SUPABASE_URL` (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-set)
- NexHealth credentials (stored in `integration_settings` table under `integration_name='nexhealth'`)

### Verify Deployment

```bash
supabase functions list
supabase functions logs nexhealth-appointments --tail
```

## Configuration

NexHealth integration settings are read dynamically from the `integration_settings` table at runtime:

```sql
SELECT settings FROM integration_settings
WHERE integration_name = 'nexhealth'
AND clinic_id = '00000000-0000-0000-0000-000000000001';
```

This allows credentials to be updated via the admin UI (`/admin/nexhealth`) without redeploying functions.
