/**
 * Availabilities Hooks
 * React Query hooks for provider availability operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllAvailabilities,
  getProviderAvailabilities,
  getAvailabilityById,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  setProviderWeeklySchedule,
  getProviderOverrides,
  createOverride,
  deleteOverride,
  syncAvailabilitiesFromNexHealth,
  getAvailabilityStats,
  type ProviderAvailability,
  type ProviderAvailabilityOverride,
  type AvailabilityInsert,
  type AvailabilityUpdate,
  type OverrideInsert,
} from '@/services/availabilities.service';
import { useToast } from '@/hooks/use-toast';

export type { ProviderAvailability, ProviderAvailabilityOverride, AvailabilityInsert, OverrideInsert };

/**
 * Hook to fetch all availabilities
 */
export function useAvailabilities(providerId?: string) {
  return useQuery({
    queryKey: ['availabilities', providerId],
    queryFn: () => getAllAvailabilities(providerId),
  });
}

/**
 * Hook to fetch availabilities for a specific provider
 */
export function useProviderAvailabilities(providerId: string | undefined) {
  return useQuery({
    queryKey: ['provider-availabilities', providerId],
    queryFn: () => (providerId ? getProviderAvailabilities(providerId) : []),
    enabled: !!providerId,
  });
}

/**
 * Hook to fetch a single availability
 */
export function useAvailability(id: string | undefined) {
  return useQuery({
    queryKey: ['availability', id],
    queryFn: () => (id ? getAvailabilityById(id) : null),
    enabled: !!id,
  });
}

/**
 * Hook to fetch availability stats
 */
export function useAvailabilityStats() {
  return useQuery({
    queryKey: ['availability-stats'],
    queryFn: getAvailabilityStats,
  });
}

/**
 * Hook to create an availability
 */
export function useCreateAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: AvailabilityInsert) => createAvailability(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['availabilities'] });
      queryClient.invalidateQueries({ queryKey: ['provider-availabilities', variables.provider_id] });
      queryClient.invalidateQueries({ queryKey: ['availability-stats'] });
      toast({
        title: 'Success',
        description: 'Availability created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create availability',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to update an availability
 */
export function useUpdateAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AvailabilityUpdate }) =>
      updateAvailability(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availabilities'] });
      queryClient.invalidateQueries({ queryKey: ['provider-availabilities'] });
      toast({
        title: 'Success',
        description: 'Availability updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update availability',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete an availability
 */
export function useDeleteAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteAvailability(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availabilities'] });
      queryClient.invalidateQueries({ queryKey: ['provider-availabilities'] });
      queryClient.invalidateQueries({ queryKey: ['availability-stats'] });
      toast({
        title: 'Success',
        description: 'Availability deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete availability',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to set weekly schedule for a provider
 */
export function useSetProviderWeeklySchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      providerId,
      schedule,
    }: {
      providerId: string;
      schedule: {
        day_of_week: number;
        start_time: string;
        end_time: string;
        is_active: boolean;
      }[];
    }) => setProviderWeeklySchedule(providerId, schedule),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['availabilities'] });
      queryClient.invalidateQueries({ queryKey: ['provider-availabilities', variables.providerId] });
      queryClient.invalidateQueries({ queryKey: ['availability-stats'] });
      toast({
        title: 'Success',
        description: 'Weekly schedule updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update weekly schedule',
        variant: 'destructive',
      });
    },
  });
}

// =====================
// OVERRIDES
// =====================

/**
 * Hook to fetch overrides for a provider
 */
export function useProviderOverrides(
  providerId: string | undefined,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ['provider-overrides', providerId, startDate, endDate],
    queryFn: () => (providerId ? getProviderOverrides(providerId, startDate, endDate) : []),
    enabled: !!providerId,
  });
}

/**
 * Hook to create an override
 */
export function useCreateOverride() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: OverrideInsert) => createOverride(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['provider-overrides', variables.provider_id] });
      queryClient.invalidateQueries({ queryKey: ['availability-stats'] });
      toast({
        title: 'Success',
        description: 'Override created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create override',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete an override
 */
export function useDeleteOverride() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteOverride(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['availability-stats'] });
      toast({
        title: 'Success',
        description: 'Override deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete override',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to sync availabilities from NexHealth
 */
export function useSyncAvailabilitiesFromNexHealth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (providerId?: string) => syncAvailabilitiesFromNexHealth(providerId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['availabilities'] });
      queryClient.invalidateQueries({ queryKey: ['provider-availabilities'] });
      queryClient.invalidateQueries({ queryKey: ['availability-stats'] });
      toast({
        title: 'Sync Complete',
        description: result.message || `Synced ${result.synced} availabilities`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync availabilities from NexHealth',
        variant: 'destructive',
      });
    },
  });
}


