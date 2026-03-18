/**
 * Operatories Service
 * Handles all operatory-related database operations
 * Medibill Voice Sync Health
 */

import { supabase } from '@/integrations/supabase/client';

// Operatory type based on the database schema
export interface Operatory {
  id: number;
  institution_id: number;
  location_id: number | null;
  name: string;
  description: string | null;
  foreign_id: string | null;
  is_active: boolean;
  is_bookable: boolean;
  operatory_type: string;
  capacity: number;
  appointment_types: string[];
  appt_categories: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OperatoryWithRelations extends Operatory {
  institution_name?: string;
  location_name?: string;
}

export interface OperatoryInsert {
  institution_id: number;
  location_id?: number;
  name: string;
  description?: string;
  foreign_id?: string;
  is_active?: boolean;
  is_bookable?: boolean;
  operatory_type?: string;
  capacity?: number;
  appointment_types?: string[];
  appt_categories?: string[];
  metadata?: Record<string, any>;
}

export interface OperatoryUpdate extends Partial<Omit<OperatoryInsert, 'institution_id'>> {}

// Operatory types for the dropdown
export const OPERATORY_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'hygiene', label: 'Hygiene' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'imaging', label: 'Imaging/X-Ray' },
  { value: 'pediatric', label: 'Pediatric' },
  { value: 'orthodontic', label: 'Orthodontic' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
];

// Type-safe table accessor
const operatoriesTable = () => (supabase as any).from('operatories');

/**
 * Get all operatories
 */
export async function getAllOperatories(): Promise<OperatoryWithRelations[]> {
  const { data, error } = await operatoriesTable()
    .select(`
      *,
      institutions:institution_id(name),
      institution_locations:location_id(name)
    `)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching operatories:', error);
    throw error;
  }

  return (data || []).map((op: any) => ({
    ...op,
    institution_name: op.institutions?.name || null,
    location_name: op.institution_locations?.name || null,
    institutions: undefined,
    institution_locations: undefined,
  })) as OperatoryWithRelations[];
}

/**
 * Get operatories by institution
 */
export async function getOperatoriesByInstitution(institutionId: number): Promise<OperatoryWithRelations[]> {
  const { data, error } = await operatoriesTable()
    .select(`
      *,
      institution_locations:location_id(name)
    `)
    .eq('institution_id', institutionId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching operatories by institution:', error);
    throw error;
  }

  return (data || []).map((op: any) => ({
    ...op,
    location_name: op.institution_locations?.name || null,
    institution_locations: undefined,
  })) as OperatoryWithRelations[];
}

/**
 * Get operatories by location
 */
export async function getOperatoriesByLocation(locationId: number): Promise<Operatory[]> {
  const { data, error } = await operatoriesTable()
    .select('*')
    .eq('location_id', locationId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching operatories by location:', error);
    throw error;
  }

  return (data || []) as Operatory[];
}

/**
 * Get operatory by ID
 */
export async function getOperatoryById(id: number): Promise<OperatoryWithRelations | null> {
  const { data, error } = await operatoriesTable()
    .select(`
      *,
      institutions:institution_id(name),
      institution_locations:location_id(name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching operatory:', error);
    throw error;
  }

  return {
    ...data,
    institution_name: data.institutions?.name || null,
    location_name: data.institution_locations?.name || null,
    institutions: undefined,
    institution_locations: undefined,
  } as OperatoryWithRelations;
}

/**
 * Create a new operatory
 */
export async function createOperatory(operatory: OperatoryInsert): Promise<Operatory> {
  const { data, error } = await operatoriesTable()
    .insert(operatory)
    .select()
    .single();

  if (error) {
    console.error('Error creating operatory:', error);
    throw error;
  }

  return data as Operatory;
}

/**
 * Update an operatory
 */
export async function updateOperatory(id: number, updates: OperatoryUpdate): Promise<Operatory> {
  const { data, error } = await operatoriesTable()
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating operatory:', error);
    throw error;
  }

  return data as Operatory;
}

/**
 * Delete an operatory
 */
export async function deleteOperatory(id: number): Promise<void> {
  const { error } = await operatoriesTable()
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting operatory:', error);
    throw error;
  }
}

/**
 * Get operatory statistics
 */
export async function getOperatoryStats() {
  const { data, error } = await operatoriesTable()
    .select('is_active, is_bookable, operatory_type');

  if (error) {
    console.error('Error fetching operatory stats:', error);
    throw error;
  }

  const stats = {
    total: data?.length || 0,
    active: 0,
    inactive: 0,
    bookable: 0,
    byType: {} as Record<string, number>,
  };

  (data || []).forEach((op: any) => {
    if (op.is_active) stats.active++;
    else stats.inactive++;
    if (op.is_bookable) stats.bookable++;
    
    const type = op.operatory_type || 'general';
    stats.byType[type] = (stats.byType[type] || 0) + 1;
  });

  return stats;
}

/**
 * Search operatories by name
 */
export async function searchOperatories(query: string, institutionId?: number): Promise<OperatoryWithRelations[]> {
  let queryBuilder = operatoriesTable()
    .select(`
      *,
      institutions:institution_id(name),
      institution_locations:location_id(name)
    `)
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(50);

  if (institutionId) {
    queryBuilder = queryBuilder.eq('institution_id', institutionId);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('Error searching operatories:', error);
    throw error;
  }

  return (data || []).map((op: any) => ({
    ...op,
    institution_name: op.institutions?.name || null,
    location_name: op.institution_locations?.name || null,
    institutions: undefined,
    institution_locations: undefined,
  })) as OperatoryWithRelations[];
}

