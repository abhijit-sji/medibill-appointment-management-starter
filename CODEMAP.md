# Appointment Management - Code Map

## Directory Structure

```
src/
  pages/
    CalendarPage.tsx              # Main calendar view (day/week/month) with scheduling
    Availabilities.tsx            # Provider availability schedule management
    AppointmentTypes.tsx          # Appointment type configuration
    Operatories.tsx               # Operatory/room management

  services/
    appointments.service.ts       # CRUD + slot availability + stats
    availabilities.service.ts     # Provider availability CRUD + overrides + NexHealth sync
    appointment-types.service.ts  # Appointment type CRUD + NexHealth sync
    operatories.service.ts        # Operatory CRUD + search + stats

  hooks/
    useAppointments.ts            # useAppointments(), useTodaysAppointments(), useProviders()
    useAvailabilities.ts          # useAvailabilities(), useCreateAvailability(), useProviderOverrides(), etc.
    useAppointmentTypes.ts        # useAppointmentTypes(), useAppointmentTypeStats(), etc.

  lib/
    schemas/
      appointment.schema.ts      # Zod schemas for NexHealth appointment data validation

  components/
    appointments/
      AddAppointmentDialog.tsx    # Dialog for creating new appointments
      RescheduleDialog.tsx        # Dialog for rescheduling existing appointments
    appointment-types/
      AddAppointmentTypeDialog.tsx  # Dialog for creating appointment types
      EditAppointmentTypeDialog.tsx # Dialog for editing appointment types
    operatories/
      AddOperatoryDialog.tsx      # Dialog for creating operatories
      EditOperatoryDialog.tsx     # Dialog for editing operatories

supabase/
  functions/
    nexhealth-appointments/index.ts     # Sync appointments from NexHealth
    nexhealth-availabilities/index.ts   # Sync availabilities from NexHealth
    nexhealth-appointment-types/index.ts # Sync appointment types from NexHealth
    nexhealth-operatories/index.ts      # Sync operatories from NexHealth
    nexhealth-slots/index.ts            # Query available slots from NexHealth
    shared/
      availability.ts                   # Shared availability checking logic
      booking.ts                        # Shared booking logic for voice AI
  migrations/
    20251203000000_initial_schema.sql
    20260202000000_create_operatories_table.sql
    20260202100000_create_appointment_types.sql
    20260202100001_enhance_appointments.sql
    20260202100002_create_appointment_slots.sql
    20260202100003_create_availabilities.sql
```

## Key File Details

### `src/services/appointments.service.ts`

**Exports:**
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `getAllAppointments` | `clinicId?` | `AppointmentWithDetails[]` | All appointments with patient/provider/type joins |
| `getAppointmentsByDate` | `date, clinicId?` | `AppointmentWithDetails[]` | Appointments for a specific date |
| `getProviderAppointments` | `providerId, date, clinicId?` | Appointments | Non-cancelled appointments for a provider on a date |
| `getAppointmentById` | `appointmentId` | `AppointmentWithDetails` | Single appointment with full joins |
| `createAppointment` | `appointment, clinicId?` | `AppointmentWithDetails` | Create + auto-update matching leads to 'booked' |
| `updateAppointment` | `appointmentId, updates` | `AppointmentWithDetails` | Update appointment fields |
| `cancelAppointment` | `appointmentId, reason?` | `AppointmentWithDetails` | Cancel + revert lead status |
| `isSlotAvailable` | `providerId, date, start, end, excludeId?` | `boolean` | Check for time conflicts |
| `getAvailableSlots` | `providerId, date, duration?, excludeId?` | Slot[] | Generate available time slots |
| `getAppointmentStats` | `clinicId?` | Stats object | Today/week/completed/no-show counts |

**Types:**
- `AppointmentWithDetails` - Appointment row with joined patient, provider, and appointment_type

### `src/services/availabilities.service.ts`

**Exports:**
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `getAllAvailabilities` | `providerId?` | `ProviderAvailability[]` | All availabilities with provider/location/operatory joins |
| `getProviderAvailabilities` | `providerId` | `ProviderAvailability[]` | Availabilities for a specific provider |
| `getAvailabilityById` | `id` | `ProviderAvailability \| null` | Single availability |
| `createAvailability` | `availability` | `ProviderAvailability` | Create recurring availability |
| `updateAvailability` | `id, updates` | `ProviderAvailability` | Update availability |
| `deleteAvailability` | `id` | `void` | Delete availability |
| `setProviderWeeklySchedule` | `providerId, schedule[]` | `ProviderAvailability[]` | Replace all provider availabilities |
| `getProviderOverrides` | `providerId, start?, end?` | `ProviderAvailabilityOverride[]` | Date-specific overrides |
| `createOverride` | `override` | `ProviderAvailabilityOverride` | Create date override |
| `deleteOverride` | `id` | `void` | Delete override |
| `syncAvailabilitiesFromNexHealth` | `providerId?` | Sync result | Trigger NexHealth availability sync |
| `getAvailabilityStats` | none | Stats object | Provider/schedule/override counts |

**Types:**
- `ProviderAvailability` - Row with joined provider_name, location_name, operatory_name
- `ProviderAvailabilityOverride` - Override row
- `AvailabilityInsert`, `AvailabilityUpdate`, `OverrideInsert` - Insert/update types
- `DAYS_OF_WEEK` - Array of `{ value, label, short }` for day selection

### `src/services/operatories.service.ts`

**Exports:**
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `getAllOperatories` | none | `OperatoryWithRelations[]` | All operatories with joins |
| `getOperatoriesByInstitution` | `institutionId` | `OperatoryWithRelations[]` | Filter by institution |
| `getOperatoriesByLocation` | `locationId` | `Operatory[]` | Filter by location |
| `getOperatoryById` | `id` | `OperatoryWithRelations \| null` | Single operatory |
| `createOperatory` | `operatory` | `Operatory` | Create operatory |
| `updateOperatory` | `id, updates` | `Operatory` | Update operatory |
| `deleteOperatory` | `id` | `void` | Delete operatory |
| `getOperatoryStats` | none | Stats object | Total/active/bookable/by-type counts |
| `searchOperatories` | `query, institutionId?` | `OperatoryWithRelations[]` | Search by name |

**Constants:**
- `OPERATORY_TYPES` - Array of `{ value, label }` for type selection (general, hygiene, surgery, etc.)

### `src/lib/schemas/appointment.schema.ts`

**Zod Schemas:**
- `NexHealthAppointmentSlotSchema` - Slot with time, operatory_id, provider_id
- `NexHealthAppointmentSlotsDataSchema` - Slots grouped by location/provider
- `NexHealthAppointmentCreateSchema` - Create payload for NexHealth
- `NexHealthAppointmentUpdateSchema` - Update payload for NexHealth
- `NexHealthAppointmentDataSchema` - Full NexHealth appointment response
- `NexHealthAppointmentTypeSchema` - NexHealth appointment type
- `LocalAppointmentSchema` - Local appointment with NexHealth mapping

**Validation Helpers:**
- `validateNexHealthAppointmentCreate(data)` - Parse or throw
- `validateNexHealthAppointmentData(data)` - Parse or throw
- `safeValidateAppointmentSlots(data)` - Parse or return null
- `safeValidateAppointmentTypes(data)` - Parse or return null

### `src/hooks/useAppointments.ts`

**Exports:**
- `useAppointments()` - All appointments query
- `useTodaysAppointments()` - Today's appointments query (filtered, excludes cancelled)
- `useProviders()` - Active providers query (used by calendar for filtering)
- `formatTime(timeStr)` - Convert 24h time string to 12h format

### `src/hooks/useAvailabilities.ts`

**Exports (14 hooks):**
- `useAvailabilities(providerId?)` - Query all availabilities
- `useProviderAvailabilities(providerId)` - Query provider-specific
- `useAvailability(id)` - Query single
- `useAvailabilityStats()` - Stats query
- `useCreateAvailability()` - Create mutation
- `useUpdateAvailability()` - Update mutation
- `useDeleteAvailability()` - Delete mutation
- `useSetProviderWeeklySchedule()` - Bulk schedule mutation
- `useProviderOverrides(providerId, start?, end?)` - Overrides query
- `useCreateOverride()` - Create override mutation
- `useDeleteOverride()` - Delete override mutation
- `useSyncAvailabilitiesFromNexHealth()` - Sync mutation
