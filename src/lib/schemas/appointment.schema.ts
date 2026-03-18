/**
 * Appointment Validation Schemas
 * Zod schemas for NexHealth appointment data validation
 */

import { z } from 'zod';

// ============================================================================
// NexHealth Appointment Slot Schema
// ============================================================================
export const NexHealthAppointmentSlotSchema = z.object({
  time: z.string(), // ISO8601 datetime
  operatory_id: z.number().optional(),
  provider_id: z.number().optional(),
});

export type NexHealthAppointmentSlot = z.infer<typeof NexHealthAppointmentSlotSchema>;

// ============================================================================
// NexHealth Appointment Slots Response Schema
// ============================================================================
export const NexHealthAppointmentSlotsDataSchema = z.object({
  lid: z.number(), // location_id
  pid: z.number(), // provider_id
  operatory_id: z.number().optional(),
  slots: z.array(NexHealthAppointmentSlotSchema),
});

export type NexHealthAppointmentSlotsData = z.infer<typeof NexHealthAppointmentSlotsDataSchema>;

// ============================================================================
// NexHealth Appointment Create Schema
// ============================================================================
export const NexHealthAppointmentCreateSchema = z.object({
  patient_id: z.number(),
  provider_id: z.number(),
  start_time: z.string(), // ISO8601 datetime
  operatory_id: z.number().optional(),
  appointment_type_id: z.number().optional(),
});

export type NexHealthAppointmentCreate = z.infer<typeof NexHealthAppointmentCreateSchema>;

// ============================================================================
// NexHealth Appointment Update Schema
// ============================================================================
export const NexHealthAppointmentUpdateSchema = z.object({
  start_time: z.string().optional(),
  provider_id: z.number().optional(),
  operatory_id: z.number().optional(),
  appointment_type_id: z.number().optional(),
  confirmed: z.boolean().optional(),
});

export type NexHealthAppointmentUpdate = z.infer<typeof NexHealthAppointmentUpdateSchema>;

// ============================================================================
// NexHealth Appointment Response Schema (from API)
// ============================================================================
export const NexHealthAppointmentDataSchema = z.object({
  id: z.number(),
  patient_id: z.number(),
  provider_id: z.number(),
  location_id: z.number().optional(),
  operatory_id: z.number().optional().nullable(),
  start_time: z.string(), // ISO8601
  end_time: z.string().optional(), // ISO8601
  confirmed: z.boolean().optional(),
  cancelled: z.boolean().optional(),
  synced: z.boolean().optional(),
  appointment_type_id: z.number().optional().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type NexHealthAppointmentData = z.infer<typeof NexHealthAppointmentDataSchema>;

// ============================================================================
// NexHealth Appointment Type Schema
// ============================================================================
export const NexHealthAppointmentTypeSchema = z.object({
  id: z.number(),
  name: z.string(),
  parent_type: z.string().optional().nullable(),
  parent_id: z.number().optional().nullable(),
  minutes: z.number().optional(),
  bookable_online: z.boolean().optional(),
});

export type NexHealthAppointmentType = z.infer<typeof NexHealthAppointmentTypeSchema>;

// ============================================================================
// Local Appointment to NexHealth Mapping
// ============================================================================
export const LocalAppointmentSchema = z.object({
  id: z.string().uuid().optional(),
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  appointment_date: z.string(), // YYYY-MM-DD
  start_time: z.string(), // HH:MM:SS
  end_time: z.string(), // HH:MM:SS
  appointment_type: z.string().optional().nullable(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  nexhealth_appointment_id: z.number().optional().nullable(),
});

export type LocalAppointment = z.infer<typeof LocalAppointmentSchema>;

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate NexHealth appointment create payload
 */
export function validateNexHealthAppointmentCreate(data: unknown): NexHealthAppointmentCreate {
  return NexHealthAppointmentCreateSchema.parse(data);
}

/**
 * Validate NexHealth appointment response
 */
export function validateNexHealthAppointmentData(data: unknown): NexHealthAppointmentData {
  return NexHealthAppointmentDataSchema.parse(data);
}

/**
 * Safe validation for appointment slots
 */
export function safeValidateAppointmentSlots(data: unknown): NexHealthAppointmentSlotsData[] | null {
  const arraySchema = z.array(NexHealthAppointmentSlotsDataSchema);
  const result = arraySchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Safe validation for appointment types
 */
export function safeValidateAppointmentTypes(data: unknown): NexHealthAppointmentType[] | null {
  const arraySchema = z.array(NexHealthAppointmentTypeSchema);
  const result = arraySchema.safeParse(data);
  return result.success ? result.data : null;
}
