/**
 * Availabilities Service
 * Handles provider availability-related database operations
 */

import { supabase } from '@/integrations/supabase/client';

const DEFAULT_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

export interface ProviderAvailability {
  id: string;
  provider_id: string;
  location_id: number | null;
  operatory_id: number | null;
  clinic_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  effective_from: string;
  effective_until: string | null;
  is_active: boolean;
  appointment_type_ids: string[] | null;
  slot_duration_minutes: number;
  buffer_minutes: number;
  foreign_id: string | null;
  foreign_id_type: string;
  nexhealth_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  provider_name?: string;
  location_name?: string;
  operatory_name?: string;
}

export interface ProviderAvailabilityOverride {
  id: string;
  provider_id: string;
  override_date: string;
  override_type: 'unavailable' | 'modified_hours' | 'additional_hours';
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  location_id: number | null;
  operatory_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityInsert {
  provider_id: string;
  location_id?: number | null;
  operatory_id?: number | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  effective_from?: string;
  effective_until?: string | null;
  is_active?: boolean;
  appointment_type_ids?: string[] | null;
  slot_duration_minutes?: number;
  buffer_minutes?: number;
}

export interface AvailabilityUpdate extends Partial<AvailabilityInsert> {}

export interface OverrideInsert {
  provider_id: string;
  override_date: string;
  override_type: 'unavailable' | 'modified_hours' | 'additional_hours';
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
  location_id?: number | null;
  operatory_id?: number | null;
}

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

/**
 * Get all provider availabilities
 */
export async function getAllAvailabilities(
  providerId?: string
): Promise<ProviderAvailability[]> {
  let query = supabase
    .from('provider_availabilities' as any)
    .select(`
      *,
      providers:provider_id(name),
      institution_locations:location_id(name),
      operatories:operatory_id(name)
    `)
    .order('provider_id')
    .order('day_of_week');

  if (providerId) {
    query = query.eq('provider_id', providerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching availabilities:', error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    ...item,
    provider_name: item.providers?.name || null,
    location_name: item.institution_locations?.name || null,
    operatory_name: item.operatories?.name || null,
  }));
}

/**
 * Get availabilities for a specific provider
 */
export async function getProviderAvailabilities(
  providerId: string
): Promise<ProviderAvailability[]> {
  return getAllAvailabilities(providerId);
}

/**
 * Get availability by ID
 */
export async function getAvailabilityById(id: string): Promise<ProviderAvailability | null> {
  const { data, error } = await supabase
    .from('provider_availabilities' as any)
    .select(`
      *,
      providers:provider_id(name),
      institution_locations:location_id(name),
      operatories:operatory_id(name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching availability:', error);
    throw error;
  }

  if (!data) return null;

  const record = data as unknown as Record<string, unknown>;
  return {
    ...record,
    provider_name: (record as any).providers?.name || null,
    location_name: (record as any).institution_locations?.name || null,
    operatory_name: (record as any).operatories?.name || null,
  } as ProviderAvailability;
}

/**
 * Create an availability
 */
export async function createAvailability(
  availability: AvailabilityInsert
): Promise<ProviderAvailability> {
  const { data, error } = await supabase
    .from('provider_availabilities' as any)
    .insert({
      ...availability,
      clinic_id: DEFAULT_CLINIC_ID,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating availability:', error);
    throw error;
  }

  return data as unknown as ProviderAvailability;
}

/**
 * Update an availability
 */
export async function updateAvailability(
  id: string,
  updates: AvailabilityUpdate
): Promise<ProviderAvailability> {
  const { data, error } = await supabase
    .from('provider_availabilities' as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating availability:', error);
    throw error;
  }

  return data as unknown as ProviderAvailability;
}

/**
 * Delete an availability
 */
export async function deleteAvailability(id: string): Promise<void> {
  const { error } = await supabase
    .from('provider_availabilities' as any)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting availability:', error);
    throw error;
  }
}

/**
 * Bulk create availabilities for a provider (weekly schedule)
 */
export async function setProviderWeeklySchedule(
  providerId: string,
  schedule: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }[]
): Promise<ProviderAvailability[]> {
  // Delete existing availabilities for this provider
  await supabase
    .from('provider_availabilities' as any)
    .delete()
    .eq('provider_id', providerId);

  // Insert new schedule
  const availabilities = schedule
    .filter((s) => s.is_active)
    .map((s) => ({
      provider_id: providerId,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_active: true,
      clinic_id: DEFAULT_CLINIC_ID,
    }));

  if (availabilities.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('provider_availabilities' as any)
    .insert(availabilities)
    .select();

  if (error) {
    console.error('Error setting weekly schedule:', error);
    throw error;
  }

  return data as unknown as ProviderAvailability[];
}

// =====================
// OVERRIDES
// =====================

/**
 * Get overrides for a provider
 */
export async function getProviderOverrides(
  providerId: string,
  startDate?: string,
  endDate?: string
): Promise<ProviderAvailabilityOverride[]> {
  let query = supabase
    .from('provider_availability_overrides' as any)
    .select('*')
    .eq('provider_id', providerId)
    .order('override_date');

  if (startDate) {
    query = query.gte('override_date', startDate);
  }
  if (endDate) {
    query = query.lte('override_date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching overrides:', error);
    throw error;
  }

  return data as unknown as ProviderAvailabilityOverride[];
}

/**
 * Create an override
 */
export async function createOverride(
  override: OverrideInsert
): Promise<ProviderAvailabilityOverride> {
  const { data, error } = await supabase
    .from('provider_availability_overrides' as any)
    .insert(override)
    .select()
    .single();

  if (error) {
    console.error('Error creating override:', error);
    throw error;
  }

  return data as unknown as ProviderAvailabilityOverride;
}

/**
 * Delete an override
 */
export async function deleteOverride(id: string): Promise<void> {
  const { error } = await supabase
    .from('provider_availability_overrides' as any)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting override:', error);
    throw error;
  }
}

/**
 * Sync availabilities from NexHealth
 */
export async function syncAvailabilitiesFromNexHealth(
  providerId?: string
): Promise<{
  success: boolean;
  synced: number;
  errors: number;
  message: string;
}> {
  let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nexhealth-availabilities?action=sync`;
  if (providerId) {
    url += `&provider_id=${providerId}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to sync availabilities');
  }

  return await response.json();
}

/**
 * Get availability stats
 */
export async function getAvailabilityStats(): Promise<{
  totalProviders: number;
  providersWithSchedule: number;
  totalSlots: number;
  upcomingOverrides: number;
}> {
  // Get unique providers with availabilities
  const { data: availabilities, error: availError } = await supabase
    .from('provider_availabilities' as any)
    .select('provider_id, id')
    .eq('is_active', true);

  if (availError) throw availError;

  const uniqueProviders = new Set((availabilities || []).map((a: any) => a.provider_id));

  // Get total providers
  const { count: totalProviders, error: providerError } = await supabase
    .from('providers')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (providerError) throw providerError;

  // Get upcoming overrides
  const today = new Date().toISOString().split('T')[0];
  const { count: upcomingOverrides, error: overrideError } = await supabase
    .from('provider_availability_overrides' as any)
    .select('*', { count: 'exact', head: true })
    .gte('override_date', today);

  if (overrideError) throw overrideError;

  return {
    totalProviders: totalProviders || 0,
    providersWithSchedule: uniqueProviders.size,
    totalSlots: (availabilities || []).length,
    upcomingOverrides: upcomingOverrides || 0,
  };
}

