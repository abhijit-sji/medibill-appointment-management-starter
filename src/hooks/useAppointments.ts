import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const DEMO_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

export interface AppointmentWithDetails {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  date: Date;
  time: string;
  type: string;
  provider: string;
  providerId: string;
  status: 'scheduled' | 'checked-in' | 'completed' | 'no-show' | 'cancelled';
  copay: number;
  duration: number;
  notes: string | null;
}

export function useAppointments() {
  return useQuery({
    queryKey: ['appointments'],
    queryFn: async (): Promise<AppointmentWithDetails[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients!inner(first_name, last_name, phone),
          providers!inner(name)
        `)
        .eq('clinic_id', DEMO_CLINIC_ID)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      return (data || []).map(apt => ({
        id: apt.id,
        patientId: apt.patient_id!,
        patientName: `${apt.patients.first_name} ${apt.patients.last_name}`,
        patientPhone: apt.patients.phone,
        date: new Date(`${apt.appointment_date}T${apt.start_time}`),
        time: formatTime(apt.start_time),
        type: apt.appointment_type || 'General Visit',
        provider: apt.providers.name,
        providerId: apt.provider_id!,
        status: apt.status as any || 'scheduled',
        copay: apt.copay_amount || 0,
        duration: apt.duration || 30,
        notes: apt.notes
      }));
    }
  });
}

export function useTodaysAppointments() {
  const today = new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['appointments', 'today', today],
    queryFn: async (): Promise<AppointmentWithDetails[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients!inner(first_name, last_name, phone),
          providers!inner(name)
        `)
        .eq('clinic_id', DEMO_CLINIC_ID)
        .eq('appointment_date', today)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true });

      if (error) throw error;

      return (data || []).map(apt => ({
        id: apt.id,
        patientId: apt.patient_id!,
        patientName: `${apt.patients.first_name} ${apt.patients.last_name}`,
        patientPhone: apt.patients.phone,
        date: new Date(`${apt.appointment_date}T${apt.start_time}`),
        time: formatTime(apt.start_time),
        type: apt.appointment_type || 'General Visit',
        provider: apt.providers.name,
        providerId: apt.provider_id!,
        status: apt.status as any || 'scheduled',
        copay: apt.copay_amount || 0,
        duration: apt.duration || 30,
        notes: apt.notes
      }));
    }
  });
}

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('clinic_id', DEMO_CLINIC_ID)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    }
  });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}
