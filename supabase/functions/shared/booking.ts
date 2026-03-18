/**
 * Appointment Booking
 * Books appointments in the database
 * Medibill Voice Sync Health - Phase 1
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

export interface BookingRequest {
  patient_id: string;
  provider_id: string;
  appointment_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  appointment_type: string;
  reason?: string;
  duration?: number; // minutes, default 30
  notes?: string;
}

export interface BookingResult {
  success: boolean;
  appointment_id?: string;
  confirmation_number?: string;
  error?: string;
}

/**
 * Book an appointment for a patient
 */
export async function bookAppointment(request: BookingRequest): Promise<BookingResult> {
  console.log('Booking appointment:', request);

  const {
    patient_id,
    provider_id,
    appointment_date,
    start_time,
    appointment_type,
    reason,
    duration = 30,
    notes,
  } = request;

  try {
    console.log('Booking request details:', {
      patient_id,
      provider_id,
      appointment_date,
      start_time,
      appointment_type,
      duration
    });

    // 1. Check provider working hours for this date
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('working_hours, slot_duration, buffer_time')
      .eq('id', provider_id)
      .single();

    if (providerError || !provider) {
      return {
        success: false,
        error: 'Provider not found',
      };
    }

    const dateObj = new Date(appointment_date);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dateObj.getDay()];
    const workingHours = provider.working_hours as Record<string, any> | null;
    const dayHours = workingHours?.[dayOfWeek];

    // Strict check: Provider must have working_hours configured and the day must be explicitly enabled
    if (!workingHours || 
        typeof workingHours !== 'object' || 
        Object.keys(workingHours).length === 0 ||
        !dayHours || 
        dayHours.enabled !== true || 
        !dayHours.start || 
        !dayHours.end) {
      return {
        success: false,
        error: 'Provider is not available on this day (no working hours configured)',
      };
    }

    // Check if requested time is within working hours (must be set if we got here)
    const providerStartTime = dayHours.start;
    const providerEndTime = dayHours.end;
    const breaks: Array<{ start: string; end: string; label?: string }> = dayHours.breaks || [];

    const [reqHours, reqMins] = start_time.split(':').map(Number);
    const [startHours, startMins] = providerStartTime.split(':').map(Number);
    const [endHours, endMins] = providerEndTime.split(':').map(Number);
    
    const requestedTime = reqHours * 60 + reqMins;
    const workingStart = startHours * 60 + startMins;
    const workingEnd = endHours * 60 + endMins;
    const requestedEnd = requestedTime + duration;

    if (requestedTime < workingStart || requestedEnd > workingEnd) {
      return {
        success: false,
        error: `Appointment time must be between ${providerStartTime} and ${providerEndTime}`,
      };
    }

    // Check if requested time falls within a break period
    for (const brk of breaks) {
      const [bh, bm] = brk.start.split(':').map(Number);
      const [eh, em] = brk.end.split(':').map(Number);
      const brkStart = bh * 60 + bm;
      const brkEnd = eh * 60 + em;
      if (requestedTime < brkEnd && requestedEnd > brkStart) {
        const label = brk.label || 'break';
        return {
          success: false,
          error: `Provider is unavailable during ${label} (${brk.start}–${brk.end}). Please choose a different time.`,
        };
      }
    }

    // Check if this patient already has an appointment with this provider on this date
    const { data: existingPatientApt } = await supabase
      .from('appointments')
      .select('id, start_time')
      .eq('patient_id', patient_id)
      .eq('provider_id', provider_id)
      .eq('appointment_date', appointment_date)
      .neq('status', 'cancelled')
      .limit(1)
      .maybeSingle();

    if (existingPatientApt) {
      return {
        success: false,
        error: `Patient already has an appointment with this provider on ${appointment_date} at ${existingPatientApt.start_time?.substring(0, 5)}. Please choose a different date or provider.`,
      };
    }

    // Calculate end_time from start_time and duration
    const endTimeMinutes = requestedTime + duration;
    const endHoursCalc = Math.floor(endTimeMinutes / 60);
    const endMinsCalc = endTimeMinutes % 60;
    const end_time = `${String(endHoursCalc).padStart(2, '0')}:${String(endMinsCalc).padStart(2, '0')}`;

    // 2. Validate slot is still available
    const isAvailable = await isSlotAvailable(
      provider_id,
      appointment_date,
      start_time,
      duration
    );

    console.log('Slot availability check:', { isAvailable });

    if (!isAvailable) {
      return {
        success: false,
        error: 'Time slot is no longer available',
      };
    }

    // 3. Insert appointment
    const appointmentData = {
      clinic_id: DEFAULT_CLINIC_ID,
      patient_id,
      provider_id,
      appointment_date,
      start_time: `${start_time}:00`, // Add seconds
      end_time: `${end_time}:00`, // Add seconds
      appointment_type,
      reason: reason || appointment_type,
      duration,
      status: 'scheduled',
      notes,
      copay_amount: 30.00, // Default copay
      copay_paid: false,
    };

    console.log('Inserting appointment with data:', appointmentData);

    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting appointment:', {
        error: insertError,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      return {
        success: false,
        error: 'Failed to book appointment',
      };
    }

    console.log('Appointment inserted successfully:', {
      id: appointment.id,
      date: appointment.appointment_date,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      status: appointment.status
    });

    // 3. Generate confirmation number
    const confirmationNumber = generateConfirmationNumber(appointment.id);

    console.log('Appointment booked successfully:', {
      appointment_id: appointment.id,
      confirmation_number: confirmationNumber
    });

    return {
      success: true,
      appointment_id: appointment.id,
      confirmation_number: confirmationNumber,
    };

  } catch (error) {
    console.error('Error booking appointment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a time slot is available for the given provider.
 * Uses actual start/end times to detect any overlap with existing appointments.
 */
async function isSlotAvailable(
  providerId: string,
  date: string,
  time: string,
  duration: number
): Promise<boolean> {
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('start_time, end_time, duration')
    .eq('provider_id', providerId)
    .eq('appointment_date', date)
    .neq('status', 'cancelled');

  if (error) {
    console.error('Error checking availability:', error);
    return false;
  }

  if (!appointments || appointments.length === 0) {
    return true;
  }

  const [reqHours, reqMins] = time.split(':').map(Number);
  const requestedStart = reqHours * 60 + reqMins;
  const requestedEnd = requestedStart + duration;

  for (const apt of appointments) {
    let aptStart: number;
    let aptEnd: number;

    if (apt.start_time && apt.end_time) {
      const [sh, sm] = apt.start_time.substring(0, 5).split(':').map(Number);
      const [eh, em] = apt.end_time.substring(0, 5).split(':').map(Number);
      aptStart = sh * 60 + sm;
      aptEnd = eh * 60 + em;
    } else {
      const [sh, sm] = (apt.start_time?.substring(0, 5) || '00:00').split(':').map(Number);
      aptStart = sh * 60 + sm;
      aptEnd = aptStart + (apt.duration || 30);
    }

    // Standard interval-overlap test: two intervals [a,b) and [c,d) overlap iff a<d && c<b
    if (requestedStart < aptEnd && requestedEnd > aptStart) {
      console.log('Slot overlap detected:', {
        requested: `${time} + ${duration}min`,
        existing: `${apt.start_time?.substring(0, 5)}–${apt.end_time?.substring(0, 5)}`,
      });
      return false;
    }
  }

  return true;
}

/**
 * Generate a confirmation number from appointment ID
 */
function generateConfirmationNumber(appointmentId: string): string {
  // Take first 8 characters of UUID and format as XXX-XXXX
  const shortId = appointmentId.replace(/-/g, '').substring(0, 7).toUpperCase();
  return `APT-${shortId}`;
}

/*
 * Usage Example:
 *
 * const result = await bookAppointment({
 *   patient_id: 'uuid-here',
 *   provider_id: 'uuid-here',
 *   appointment_date: '2024-12-10',
 *   start_time: '14:00',
 *   appointment_type: 'General Checkup',
 *   reason: 'Annual checkup',
 *   duration: 30,
 * });
 *
 * if (result.success) {
 *   console.log('Booked! Confirmation:', result.confirmation_number);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 */
