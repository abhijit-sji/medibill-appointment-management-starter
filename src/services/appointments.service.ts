/**
 * Appointments Service
 * Handles all appointment-related database operations
 * Medibill Voice Sync Health
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/lib/database.types';

type Appointment = Database['public']['Tables']['appointments']['Row'];
type AppointmentInsert = Database['public']['Tables']['appointments']['Insert'];
type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];

const DEFAULT_CLINIC_ID = '00000000-0000-0000-0000-000000000001'; // Demo clinic

export interface AppointmentWithDetails extends Appointment {
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
  };
  provider?: {
    id: string;
    name: string;
    specialty: string | null;
  };
  appointment_types?: {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
  } | null;
}

/**
 * Get all appointments for a clinic
 */
export async function getAllAppointments(clinicId: string = DEFAULT_CLINIC_ID) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patients:patient_id (id, first_name, last_name, phone, email),
      providers:provider_id (id, name, specialty),
      appointment_types:appointment_type_id (id, name, code, description)
    `)
    .eq('clinic_id', clinicId)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching appointments:', error);
    throw error;
  }

  return data;
}

/**
 * Get appointments for a specific date
 */
export async function getAppointmentsByDate(
  date: string, // YYYY-MM-DD format
  clinicId: string = DEFAULT_CLINIC_ID
) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patients:patient_id (id, first_name, last_name, phone, email),
      providers:provider_id (id, name, specialty),
      appointment_types:appointment_type_id (id, name, code, description)
    `)
    .eq('clinic_id', clinicId)
    .eq('appointment_date', date)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching appointments by date:', error);
    throw error;
  }

  return data;
}

/**
 * Get appointments for a specific provider on a date
 */
export async function getProviderAppointments(
  providerId: string,
  date: string,
  clinicId: string = DEFAULT_CLINIC_ID
) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patients:patient_id (id, first_name, last_name, phone, email)
    `)
    .eq('clinic_id', clinicId)
    .eq('provider_id', providerId)
    .eq('appointment_date', date)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching provider appointments:', error);
    throw error;
  }

  return data;
}

/**
 * Get a single appointment by ID
 */
export async function getAppointmentById(appointmentId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients (id, first_name, last_name, phone, email, dob),
      provider:providers (id, name, specialty)
    `)
    .eq('id', appointmentId)
    .single();

  if (error) {
    console.error('Error fetching appointment:', error);
    throw error;
  }

  return data as AppointmentWithDetails;
}

/**
 * Create a new appointment
 */
export async function createAppointment(
  appointment: Omit<AppointmentInsert, 'id' | 'created_at' | 'updated_at'>,
  clinicId: string = DEFAULT_CLINIC_ID
) {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      ...appointment,
      clinic_id: clinicId,
    })
    .select(`
      *,
      patient:patients (id, first_name, last_name, phone, email),
      provider:providers (id, name, specialty)
    `)
    .single();

  if (error) {
    console.error('Error creating appointment:', error);
    throw error;
  }

  // Mark any matching leads as booked (best-effort, non-blocking)
  if (data?.patient_id) {
    const patientId = data.patient_id;
    const orParts: string[] = [`patient_id.eq.${patientId}`];
    if (data.patient?.phone) orParts.push(`phone.eq.${data.patient.phone}`);
    if (data.patient?.email) orParts.push(`email.eq.${data.patient.email}`);

    supabase
      .from('leads' as any)
      .update({
        status: 'booked',
        appointment_id: data.id,
        patient_id: patientId,
        last_contacted_at: new Date().toISOString(),
      } as any)
      .eq('clinic_id', clinicId)
      .or(orParts.join(','))
      .not('status', 'in', '("lost")')
      .then(({ error: leadErr }) => {
        if (leadErr) console.error('createAppointment: failed to update lead status', leadErr);
      });
  }

  return data as AppointmentWithDetails;
}

/**
 * Update an appointment
 */
export async function updateAppointment(
  appointmentId: string,
  updates: AppointmentUpdate
) {
  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', appointmentId)
    .select(`
      *,
      patient:patients (id, first_name, last_name, phone, email),
      provider:providers (id, name, specialty)
    `)
    .single();

  if (error) {
    console.error('Error updating appointment:', error);
    throw error;
  }

  return data as AppointmentWithDetails;
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(
  appointmentId: string,
  cancellationReason?: string
) {
  const result = await updateAppointment(appointmentId, {
    status: 'cancelled',
    cancellation_reason: cancellationReason,
  });

  // Revert any leads that were booked for this appointment back to "qualified"
  if (result?.patient_id) {
    supabase
      .from('leads' as any)
      .update({ status: 'qualified', appointment_id: null } as any)
      .eq('appointment_id', appointmentId)
      .then(({ error: leadErr }) => {
        if (leadErr) console.error('cancelAppointment: failed to revert lead status', leadErr);
      });
  }

  return result;
}

/**
 * Check if a time slot is available
 */
export async function isSlotAvailable(
  providerId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: string
) {
  let query = supabase
    .from('appointments')
    .select('id')
    .eq('provider_id', providerId)
    .eq('appointment_date', date)
    .neq('status', 'cancelled')
    .or(
      `and(start_time.lte.${startTime},end_time.gt.${startTime}),and(start_time.lt.${endTime},end_time.gte.${endTime}),and(start_time.gte.${startTime},end_time.lte.${endTime})`
    );

  if (excludeAppointmentId) {
    query = query.neq('id', excludeAppointmentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error checking slot availability:', error);
    throw error;
  }

  return data.length === 0;
}

/**
 * Get available time slots for a provider on a date
 */
export async function getAvailableSlots(
  providerId: string,
  date: string,
  slotDuration: number = 30, // minutes
  excludeAppointmentId?: string // For rescheduling - exclude current appointment
) {
  // Get provider details including working hours
  const { getProviderById } = await import('@/services/providers.service');
  const provider = await getProviderById(providerId);
  
  if (!provider) {
    throw new Error('Provider not found');
  }

  // Get provider's working hours for the day of week
  // Parse date string (YYYY-MM-DD) to avoid timezone issues
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day); // month is 0-indexed
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = daysOfWeek[dateObj.getDay()];
  
  const workingHours = provider.working_hours as Record<string, any> | null;
  const dayHours = workingHours?.[dayName];
  
  // Strict check: If provider has no working hours configured for this day, return empty slots
  if (!dayHours || dayHours.enabled !== true || !dayHours.start || !dayHours.end) {
    // Provider is not available on this day - return empty slots
    return [];
  }
  
  const workingHoursConfig = {
    start: dayHours.start,
    end: dayHours.end,
  };

  // Use provider's slot duration if available
  const actualSlotDuration = provider.slot_duration || slotDuration;

  // Get existing appointments (excluding the one being rescheduled)
  let appointments = await getProviderAppointments(providerId, date);
  
  // Filter out the appointment being rescheduled
  if (excludeAppointmentId) {
    appointments = appointments.filter(apt => apt.id !== excludeAppointmentId);
  }

  // Generate all possible slots
  const slots = [];
  let currentTime = workingHoursConfig.start;

  // Helper to convert time string to minutes for comparison
  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const startMinutes = timeToMinutes(workingHoursConfig.start);
  const endMinutes = timeToMinutes(workingHoursConfig.end);

  while (timeToMinutes(currentTime) < endMinutes) {
    const [hours, minutes] = currentTime.split(':').map(Number);
    const slotEndMinutes = minutes + actualSlotDuration;
    const slotEndHours = hours + Math.floor(slotEndMinutes / 60);
    const endTime = `${String(slotEndHours).padStart(2, '0')}:${String(
      slotEndMinutes % 60
    ).padStart(2, '0')}`;

    // Don't create slots that go past working hours
    if (timeToMinutes(endTime) > endMinutes) {
      break;
    }

    // Check if slot conflicts with existing appointment
    const isAvailable = !appointments.some((apt) => {
      // Extract HH:MM from appointment times (they may be in HH:MM:SS format)
      const aptStart = apt.start_time?.substring(0, 5) || apt.start_time || '00:00';
      const aptEnd = apt.end_time?.substring(0, 5) || apt.end_time || '00:00';
      
      // Use the timeToMinutes function defined above
      const slotStartMin = timeToMinutes(currentTime);
      const slotEndMin = timeToMinutes(endTime);
      const aptStartMin = timeToMinutes(aptStart);
      const aptEndMin = timeToMinutes(aptEnd);
      
      // Check for overlap
      return (
        (slotStartMin >= aptStartMin && slotStartMin < aptEndMin) ||
        (slotEndMin > aptStartMin && slotEndMin <= aptEndMin) ||
        (slotStartMin <= aptStartMin && slotEndMin >= aptEndMin)
      );
    });

    slots.push({
      start_time: currentTime,
      end_time: endTime,
      is_available: isAvailable,
    });

    // Move to next slot
    const nextMinutes = minutes + actualSlotDuration;
    currentTime = `${String(hours + Math.floor(nextMinutes / 60)).padStart(
      2,
      '0'
    )}:${String(nextMinutes % 60).padStart(2, '0')}`;
  }

  return slots;
}

/**
 * Get appointment statistics
 */
export async function getAppointmentStats(clinicId: string = DEFAULT_CLINIC_ID) {
  const today = new Date().toISOString().split('T')[0];

  // Today's appointments
  const { count: todayCount, error: todayError } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('appointment_date', today)
    .neq('status', 'cancelled');

  if (todayError) {
    console.error('Error fetching today appointments:', todayError);
    throw todayError;
  }

  // This week's appointments
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  const { count: weekCount, error: weekError } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .gte('appointment_date', startOfWeek.toISOString().split('T')[0])
    .lte('appointment_date', endOfWeek.toISOString().split('T')[0])
    .neq('status', 'cancelled');

  if (weekError) {
    console.error('Error fetching week appointments:', weekError);
    throw weekError;
  }

  // Completed appointments
  const { count: completedCount, error: completedError } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('status', 'completed');

  if (completedError) {
    console.error('Error fetching completed appointments:', completedError);
    throw completedError;
  }

  // No-shows
  const { count: noShowCount, error: noShowError } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('status', 'no_show');

  if (noShowError) {
    console.error('Error fetching no-show appointments:', noShowError);
    throw noShowError;
  }

  return {
    today: todayCount || 0,
    thisWeek: weekCount || 0,
    completed: completedCount || 0,
    noShows: noShowCount || 0,
  };
}
