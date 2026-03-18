/**
 * Appointment Types Hooks
 * React Query hooks for appointment type operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllAppointmentTypes,
  getAppointmentTypeById,
  createAppointmentType,
  updateAppointmentType,
  deleteAppointmentType,
  getAppointmentTypeStats,
  syncAppointmentTypesFromNexHealth,
  fetchNexHealthAppointmentTypes,
  type AppointmentType,
  type AppointmentTypeInsert,
  type AppointmentTypeUpdate,
  type GetAppointmentTypesFilters,
} from '@/services/appointment-types.service';
import { useToast } from '@/hooks/use-toast';

export type { AppointmentType, AppointmentTypeInsert, AppointmentTypeUpdate };

/**
 * Hook to fetch all appointment types
 */
export function useAppointmentTypes(filters: GetAppointmentTypesFilters = {}) {
  return useQuery({
    queryKey: ['appointment-types', filters],
    queryFn: () => getAllAppointmentTypes(filters),
  });
}

/**
 * Hook to fetch a single appointment type
 */
export function useAppointmentType(id: string | undefined) {
  return useQuery({
    queryKey: ['appointment-type', id],
    queryFn: () => (id ? getAppointmentTypeById(id) : null),
    enabled: !!id,
  });
}

/**
 * Hook to fetch appointment type statistics
 */
export function useAppointmentTypeStats() {
  return useQuery({
    queryKey: ['appointment-type-stats'],
    queryFn: getAppointmentTypeStats,
  });
}

/**
 * Hook to create an appointment type
 */
export function useCreateAppointmentType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: AppointmentTypeInsert) => createAppointmentType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-types'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-type-stats'] });
      toast({
        title: 'Success',
        description: 'Appointment type created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create appointment type',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to update an appointment type
 */
export function useUpdateAppointmentType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AppointmentTypeUpdate }) =>
      updateAppointmentType(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['appointment-types'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-type', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['appointment-type-stats'] });
      toast({
        title: 'Success',
        description: 'Appointment type updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update appointment type',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete an appointment type
 */
export function useDeleteAppointmentType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteAppointmentType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-types'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-type-stats'] });
      toast({
        title: 'Success',
        description: 'Appointment type deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete appointment type',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to sync appointment types from NexHealth
 */
export function useSyncAppointmentTypesFromNexHealth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: syncAppointmentTypesFromNexHealth,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['appointment-types'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-type-stats'] });
      toast({
        title: 'Sync Complete',
        description: result.message || `Synced ${result.synced} appointment types`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync appointment types from NexHealth',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to fetch appointment types from NexHealth (preview before sync)
 */
export function useNexHealthAppointmentTypes() {
  return useQuery({
    queryKey: ['nexhealth-appointment-types'],
    queryFn: fetchNexHealthAppointmentTypes,
    enabled: false, // Only run when manually triggered
  });
}


