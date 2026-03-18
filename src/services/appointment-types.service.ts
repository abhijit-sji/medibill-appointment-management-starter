/**
 * Appointment Types Service
 * Handles all appointment type-related database operations
 */

import { supabase } from '@/integrations/supabase/client';

const DEFAULT_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

export interface AppointmentType {
  id: string;
  institution_id: number | null;
  location_id: number | null;
  operatory_id: number | null;
  clinic_id: string;
  name: string;
  description: string | null;
  code: string | null;
  duration_minutes: number;
  buffer_before: number;
  buffer_after: number;
  default_price: number | null;
  is_bookable_online: boolean;
  requires_deposit: boolean;
  deposit_amount: number | null;
  max_per_day: number | null;
  min_notice_hours: number;
  max_advance_days: number;
  foreign_id: string | null;
  foreign_id_type: string;
  nexhealth_synced_at: string | null;
  category: string;
  color: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  institution_name?: string;
  location_name?: string;
  operatory_name?: string;
}

export interface AppointmentTypeInsert {
  institution_id?: number | null;
  location_id?: number | null;
  operatory_id?: number | null;
  name: string;
  description?: string | null;
  code?: string | null;
  duration_minutes?: number;
  buffer_before?: number;
  buffer_after?: number;
  default_price?: number | null;
  is_bookable_online?: boolean;
  requires_deposit?: boolean;
  deposit_amount?: number | null;
  max_per_day?: number | null;
  min_notice_hours?: number;
  max_advance_days?: number;
  category?: string;
  color?: string;
  icon?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface AppointmentTypeUpdate extends Partial<AppointmentTypeInsert> {}

export interface GetAppointmentTypesFilters {
  institutionId?: number;
  locationId?: number;
  category?: string;
  isActive?: boolean;
  isBookableOnline?: boolean;
}

/**
 * Get all appointment types
 */
export async function getAllAppointmentTypes(
  filters: GetAppointmentTypesFilters = {}
): Promise<AppointmentType[]> {
  let query = supabase
    .from('appointment_types' as any)
    .select(`
      *,
      institutions:institution_id(name),
      institution_locations:location_id(name),
      operatories:operatory_id(name)
    `)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (filters.institutionId) {
    query = query.eq('institution_id', filters.institutionId);
  }
  if (filters.locationId) {
    query = query.eq('location_id', filters.locationId);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }
  if (filters.isBookableOnline !== undefined) {
    query = query.eq('is_bookable_online', filters.isBookableOnline);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching appointment types:', error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    ...item,
    institution_name: item.institutions?.name || null,
    location_name: item.institution_locations?.name || null,
    operatory_name: item.operatories?.name || null,
  }));
}

/**
 * Get appointment type by ID
 */
export async function getAppointmentTypeById(id: string): Promise<AppointmentType | null> {
  const { data, error } = await supabase
    .from('appointment_types' as any)
    .select(`
      *,
      institutions:institution_id(name),
      institution_locations:location_id(name),
      operatories:operatory_id(name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching appointment type:', error);
    throw error;
  }

  if (!data) return null;

  const record = data as unknown as Record<string, unknown>;
  return {
    ...record,
    institution_name: (record as any).institutions?.name || null,
    location_name: (record as any).institution_locations?.name || null,
    operatory_name: (record as any).operatories?.name || null,
  } as AppointmentType;
}

/**
 * Create an appointment type
 */
export async function createAppointmentType(
  appointmentType: AppointmentTypeInsert
): Promise<AppointmentType> {
  const { data, error } = await supabase
    .from('appointment_types' as any)
    .insert({
      ...appointmentType,
      clinic_id: DEFAULT_CLINIC_ID,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating appointment type:', error);
    throw error;
  }

  return data as unknown as AppointmentType;
}

/**
 * Update an appointment type
 */
export async function updateAppointmentType(
  id: string,
  updates: AppointmentTypeUpdate
): Promise<AppointmentType> {
  const { data, error } = await supabase
    .from('appointment_types' as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating appointment type:', error);
    throw error;
  }

  return data as unknown as AppointmentType;
}

/**
 * Delete an appointment type
 */
export async function deleteAppointmentType(id: string): Promise<void> {
  const { error } = await supabase
    .from('appointment_types' as any)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting appointment type:', error);
    throw error;
  }
}

/**
 * Get appointment type statistics
 */
export async function getAppointmentTypeStats(): Promise<{
  total: number;
  active: number;
  bookableOnline: number;
  byCategory: Record<string, number>;
}> {
  const { data, error } = await supabase
    .from('appointment_types' as any)
    .select('id, is_active, is_bookable_online, category');

  if (error) {
    console.error('Error fetching appointment type stats:', error);
    throw error;
  }

  const types = data || [];
  const byCategory: Record<string, number> = {};

  types.forEach((t: any) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
  });

  return {
    total: types.length,
    active: types.filter((t: any) => t.is_active).length,
    bookableOnline: types.filter((t: any) => t.is_bookable_online).length,
    byCategory,
  };
}

/**
 * Get categories
 */
export const APPOINTMENT_CATEGORIES = [
  { value: 'general', label: 'General', color: '#6B7280' },
  { value: 'examination', label: 'Examination', color: '#10B981' },
  { value: 'hygiene', label: 'Hygiene', color: '#8B5CF6' },
  { value: 'consultation', label: 'Consultation', color: '#F59E0B' },
  { value: 'surgical', label: 'Surgical', color: '#DC2626' },
  { value: 'emergency', label: 'Emergency', color: '#EF4444' },
  { value: 'orthodontic', label: 'Orthodontic', color: '#EC4899' },
  { value: 'pediatric', label: 'Pediatric', color: '#14B8A6' },
];

/**
 * Sync appointment types from NexHealth
 */
export async function syncAppointmentTypesFromNexHealth(): Promise<{
  success: boolean;
  synced: number;
  errors: number;
  message: string;
}> {
  const { data, error } = await supabase.functions.invoke('nexhealth-appointment-types', {
    body: {},
    method: 'GET',
  });

  // Build URL with action=sync
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nexhealth-appointment-types?action=sync`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to sync appointment types');
  }

  return await response.json();
}

/**
 * Fetch appointment types from NexHealth (without syncing)
 */
export async function fetchNexHealthAppointmentTypes(): Promise<any[]> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nexhealth-appointment-types?action=list`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch appointment types from NexHealth');
  }

  const data = await response.json();
  return data.data || [];
}

