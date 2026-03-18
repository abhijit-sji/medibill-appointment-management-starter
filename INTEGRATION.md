# Appointment Management - Integration Guide

## Prerequisites

1. Running Supabase instance with all migrations applied
2. Node.js 18+ with npm
3. NexHealth API credentials (optional, for sync features)
4. Existing provider and patient records in the database

## Setup

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

Key dependencies for this module:
- `react-big-calendar` - Calendar visualization
- `moment` - Date localizer for react-big-calendar
- `date-fns` - Date formatting utilities
- `zod` - Schema validation

### 2. Database Migrations

Run migrations in order via the Supabase Dashboard SQL Editor:

```
supabase/migrations/20251203000000_initial_schema.sql          # appointments table
supabase/migrations/20260202000000_create_operatories_table.sql # operatories table
supabase/migrations/20260202100000_create_appointment_types.sql # appointment_types table
supabase/migrations/20260202100001_enhance_appointments.sql     # appointment_type_id FK
supabase/migrations/20260202100002_create_appointment_slots.sql # slot tracking
supabase/migrations/20260202100003_create_availabilities.sql    # provider_availabilities + overrides
```

### 3. Environment Variables

Required in `.env.local`:
```bash
VITE_SUPABASE_URL=https://qdnpztafkuprifwwqcgj.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key>
```

### 4. NexHealth Integration (Optional)

Store NexHealth credentials in the `integration_settings` table or set Supabase Edge Function secrets:

```sql
INSERT INTO integration_settings (integration_name, clinic_id, settings, is_enabled)
VALUES ('nexhealth', '00000000-0000-0000-0000-000000000001',
  '{"api_key": "your_key", "subdomain": "your_subdomain"}', true);
```

Deploy NexHealth edge functions:
```bash
supabase functions deploy nexhealth-appointments --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy nexhealth-availabilities --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy nexhealth-appointment-types --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy nexhealth-operatories --project-ref qdnpztafkuprifwwqcgj
```

## Usage

### Creating an Appointment

```typescript
import { createAppointment } from '@/services/appointments.service';

const appointment = await createAppointment({
  patient_id: 'uuid-of-patient',
  provider_id: 'uuid-of-provider',
  appointment_date: '2026-03-20',
  start_time: '09:00:00',
  end_time: '09:30:00',
  duration: 30,
  appointment_type: 'general',
  status: 'scheduled',
});
```

### Checking Slot Availability

```typescript
import { getAvailableSlots } from '@/services/appointments.service';

const slots = await getAvailableSlots(
  'provider-uuid',
  '2026-03-20',
  30  // slot duration in minutes
);

// Returns: [{ start_time: '09:00', end_time: '09:30', is_available: true }, ...]
```

### Managing Provider Availability

```typescript
import { setProviderWeeklySchedule } from '@/services/availabilities.service';

await setProviderWeeklySchedule('provider-uuid', [
  { day_of_week: 1, start_time: '08:00', end_time: '17:00', is_active: true }, // Monday
  { day_of_week: 2, start_time: '08:00', end_time: '17:00', is_active: true }, // Tuesday
  // ... etc
]);
```

### Creating an Override

```typescript
import { createOverride } from '@/services/availabilities.service';

await createOverride({
  provider_id: 'provider-uuid',
  override_date: '2026-03-25',
  override_type: 'unavailable',
  reason: 'Holiday',
});
```

### Using React Hooks

```tsx
import { useAppointments, useTodaysAppointments } from '@/hooks/useAppointments';
import { useAvailabilities, useCreateAvailability } from '@/hooks/useAvailabilities';

function MyComponent() {
  const { data: appointments, isLoading } = useAppointments();
  const { data: todayAppts } = useTodaysAppointments();
  const { data: availabilities } = useAvailabilities('provider-uuid');
  const createAvailability = useCreateAvailability();

  // Mutations auto-invalidate cache and show toasts
  createAvailability.mutate({
    provider_id: 'provider-uuid',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
  });
}
```

## Cross-Module Integration Points

### With Patient Management
- `appointments.patient_id` references `patients.id`
- Appointment queries join `patients` for name, phone, email
- CalendarPage links to patient profiles

### With Provider Management
- `appointments.provider_id` references `providers.id`
- Provider working hours (JSONB on `providers` table) used for slot generation
- Calendar supports provider filtering

### With Lead Management
- `createAppointment()` auto-updates matching leads to `status='booked'`
- `cancelAppointment()` reverts lead status to `'qualified'`
- Lead matching uses `patient_id`, `phone`, or `email`

### With Reminder System
- Reminders reference `appointments.id`
- Reminder responses (CONFIRM/CANCEL) update `appointments.status`

### With Voice AI
- Voice agent "Sarah" uses `getAvailableSlots()` for real-time slot checks
- Voice booking calls `createAppointment()` through shared utilities

### With NexHealth Integration
- Appointments, availabilities, appointment types, and operatories sync bidirectionally
- NexHealth IDs stored in `foreign_id` columns
- Sync status tracked via `nexhealth_synced_at` timestamps

## Troubleshooting

### Double-booking errors
The `no_overlap` GiST exclusion constraint prevents overlapping appointments. If you get constraint violation errors:
1. Verify the `btree_gist` extension is enabled
2. Check that cancelled/no-show appointments are properly excluded

### Missing slot availability
If `getAvailableSlots()` returns empty:
1. Verify the provider has `working_hours` JSONB configured with `enabled: true` for the target day
2. Check that `start` and `end` times are set in the provider's working hours
3. Verify appointments for that day are not filling all slots

### NexHealth sync issues
1. Check `integration_settings` table for valid NexHealth credentials
2. Verify edge function deployment: `supabase functions list`
3. Check edge function logs: `supabase functions logs nexhealth-appointments --tail`
