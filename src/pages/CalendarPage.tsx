/**
 * Calendar Page - Updated with Real Supabase Data
 * Medibill Voice Sync Health
 */

 import { useState, Fragment, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAppointments, useProviders, useUpdateAppointment } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar as CalendarIcon, Clock, User, FileText, Plus, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Download, Search, Phone, Save, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { format, addDays, addMonths, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RescheduleDialog } from '@/components/appointments/RescheduleDialog';
import { AddAppointmentDialog } from '@/components/appointments/AddAppointmentDialog';
import { syncCalendar } from '@/services/google-calendar.service';
import { createProcedureFromAppointment } from '@/services/procedures.service';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Label } from '@/components/ui/label';
 import { Badge } from '@/components/ui/badge';
 import { useCalendarStats } from '@/hooks/useCalendarStats';
 import { supabase } from '@/integrations/supabase/client';
 import { Users, CalendarDays, CalendarCheck, UserCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { isNexHealthConfigured } from '@/lib/nexhealth-config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const localizer = momentLocalizer(moment);
 
 const DEMO_CLINIC_ID = '00000000-0000-0000-0000-000000000001';
const PROVIDER_SELECTION_KEY = 'calendar_provider_selection';

interface ScheduledAppointment {
  id: string;
  patientName: string;
  type: string;
  procedureName?: string | null;
  procedureCode?: string | null;
  time: string;
  duration: number;
  provider: string;
  providerId?: string;
  patientId?: string;
  appointmentTypeId?: string | null;
  source?: 'nexhealth' | 'platform';
  phone?: string;
  notes?: string;
  status?: string;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [selectedAppointment, setSelectedAppointment] = useState<ScheduledAppointment | null>(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showAddAppointmentDialog, setShowAddAppointmentDialog] = useState(false);
  const [syncingProviderId, setSyncingProviderId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
   const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(new Set());
   const [providerModalOpen, setProviderModalOpen] = useState(false);
   const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);
   const [loadingAlerts, setLoadingAlerts] = useState(false);
   const [runningAgent, setRunningAgent] = useState(false);
  const [recentSearchQuery, setRecentSearchQuery] = useState('');
  const [recentPage, setRecentPage] = useState(1);
  const [recentPageSize, setRecentPageSize] = useState(50);
  const [recentTimelineFilter, setRecentTimelineFilter] = useState('all');
  const [nexhealthConfigured, setNexhealthConfigured] = useState(false);
  const [syncingNexHealth, setSyncingNexHealth] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every 60 seconds for the time indicator
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate current time position (pixels from top of time grid, 40px per slot)
  // Returns -1 when current time is outside the visible 7:00 AM - 5:00 PM range
  const currentTimeOffset = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const startHour = 0; // grid starts at 00:00
    const endHour = 24; // grid ends at 24:00
    if (hours < startHour || hours >= endHour) return -1;
    const minutesSinceStart = (hours - startHour) * 60 + minutes;
    // Each 15-min slot = 40px, so 1 minute = 40/15 px
    return (minutesSinceStart / 15) * 40;
  }, [currentTime]);

  const isToday = useMemo(() => {
    const today = new Date();
    return format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  }, [selectedDate]);

  // Get user auth info
  const { user, userRoles, isAdmin, isSuperAdmin } = useAuth();
  const isProviderRole = userRoles.includes('provider');
  const isAdminUser = isAdmin() || isSuperAdmin();

  // Fetch real data from Supabase
  const { data: appointments = [], isLoading: loadingAppointments, error: appointmentsError, refetch: refetchAppointments } = useAppointments();
  const { data: providers = [], isLoading: loadingProviders } = useProviders();
  const updateAppointmentMutation = useUpdateAppointment();
   const { data: calendarStats, isLoading: loadingStats } = useCalendarStats();
   const { data: agentConfigs = [] } = useQuery({
     queryKey: ['agent-configurations', DEMO_CLINIC_ID],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('ai_agent_configurations')
         .select('agent_name, agent_type, is_active')
         .eq('clinic_id', DEMO_CLINIC_ID);
       if (error) throw error;
       return data || [];
     },
   });
 
   // Initialize selected providers when providers load (only active providers)
   useEffect(() => {
     if (providers.length > 0 && selectedProviderIds.size === 0) {
       // Filter to only active providers
       const activeProvidersList = providers.filter((p: any) => p.is_active !== false);
       
       // Check for saved preferences first
       const saved = localStorage.getItem(PROVIDER_SELECTION_KEY);
       if (saved) {
         try {
           const savedIds = JSON.parse(saved);
           // Validate that saved IDs still exist in active providers list
           const validIds = savedIds.filter((id: string) => 
             activeProvidersList.some((p: any) => p.id === id)
           );
           if (validIds.length > 0) {
             setSelectedProviderIds(new Set(validIds));
             return;
           }
         } catch (e) {
           console.error('Error loading saved provider selection:', e);
         }
       }
       // Default to first 4 active providers if no saved selection
       const defaultSelection = new Set(activeProvidersList.slice(0, 4).map((p: any) => p.id));
       setSelectedProviderIds(defaultSelection);
     }
   }, [providers]);
 
   // Fetch critical alerts on mount
   useEffect(() => {
     fetchCriticalAlerts();
   }, []);
 
   const fetchCriticalAlerts = async () => {
     setLoadingAlerts(true);
     try {
       const response = await supabase.functions.invoke('appointment-risk-agent', {
         body: { action: 'get_alerts', clinic_id: DEMO_CLINIC_ID }
       });
       setCriticalAlerts(response.data || []);
     } catch (error) {
       console.error('Error fetching alerts:', error);
     } finally {
       setLoadingAlerts(false);
     }
   };
 
   const runRiskAnalysis = async () => {
     setRunningAgent(true);
     try {
       const response = await supabase.functions.invoke('appointment-risk-agent', {
         body: { action: 'run_analysis', clinic_id: DEMO_CLINIC_ID }
       });
       toast.success(response.data?.summary || 'Analysis complete');
       fetchCriticalAlerts();
     } catch (error) {
       toast.error('Failed to run risk analysis');
     } finally {
       setRunningAgent(false);
     }
   };
 
   const dismissAlert = async (alertId: string) => {
     try {
       await supabase.functions.invoke('appointment-risk-agent', {
         body: { action: 'dismiss_alert', alert_id: alertId, clinic_id: DEMO_CLINIC_ID }
       });
       setCriticalAlerts(prev => prev.filter(a => a.id !== alertId));
       toast.success('Alert dismissed');
     } catch (error) {
       toast.error('Failed to dismiss alert');
     }
   };

  // Get user's provider ID if they are a provider (match by email)
  const userProvider = isProviderRole && user?.email 
    ? providers.find((p: any) => p.email?.toLowerCase() === user.email.toLowerCase())
    : null;
  const userProviderId = userProvider?.id;

  // Filter appointments by provider if user is a provider (not admin/superadmin)
  const filteredAppointments = (isAdmin || isSuperAdmin) 
    ? appointments 
    : (isProviderRole && userProviderId)
      ? appointments.filter((apt: any) => apt.provider_id === userProviderId)
      : appointments;

  const events = filteredAppointments.map((apt: any) => {
    // Parse appointment date and time
    const appointmentDateTime = new Date(`${apt.appointment_date}T${apt.start_time}`);
    const duration = apt.duration || 30;

    return {
      title: `${apt.patients?.first_name || ''} ${apt.patients?.last_name || ''} - ${apt.appointment_type || 'Appointment'}`,
      start: appointmentDateTime,
      end: new Date(appointmentDateTime.getTime() + duration * 60000),
      resource: apt
    };
  });

  const eventStyleGetter = (event: any) => {
    const colors: Record<string, string> = {
      scheduled: '#3b82f6',
      'checked-in': '#14b8a6',
      completed: '#10b981',
      'no-show': '#ef4444',
      cancelled: '#6b7280'
    };

    return {
      style: {
        backgroundColor: colors[event.resource.status] || '#3b82f6',
        borderRadius: '6px',
        border: 'none',
        color: 'white'
      }
    };
  };

  // Check NexHealth configuration on mount
  useEffect(() => {
    const checkNexHealthConfig = async () => {
      const configured = await isNexHealthConfigured();
      setNexhealthConfigured(configured);
    };
    checkNexHealthConfig();
  }, []);

  const saveProviderSelection = () => {
    const idsArray = Array.from(selectedProviderIds);
    localStorage.setItem(PROVIDER_SELECTION_KEY, JSON.stringify(idsArray));
    toast.success('Provider preferences saved');
    setProviderModalOpen(false);
  };

  const handleSyncNexHealth = async () => {
    setSyncingNexHealth(true);
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `https://qdnpztafkuprifwwqcgj.supabase.co/functions/v1/nexhealth-appointments?action=sync`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Synced ${data.synced || 0} appointments from NexHealth`);
        refetchAppointments();
      } else {
        toast.error(data.error || 'Failed to sync appointments');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync from NexHealth');
    } finally {
      setSyncingNexHealth(false);
    }
  };

  const handleSyncProvider = async (providerId: string) => {
    setSyncingProviderId(providerId);
    try {
      const result = await syncCalendar(providerId);
      toast.success(result.message || 'Calendar synced successfully');
      refetchAppointments();
    } catch (error: any) {
      console.error('Error syncing calendar:', error);
      toast.error(error?.message || 'Failed to sync calendar');
    } finally {
      setSyncingProviderId(null);
    }
  };

  const handleSyncAll = async () => {
    const connectedProviders = providers.filter((p: any) => p.google_sync_enabled);
    
    if (connectedProviders.length === 0) {
      toast.info('No providers with Google Calendar connected');
      return;
    }

    setSyncingAll(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < connectedProviders.length; i++) {
      const provider = connectedProviders[i];
      try {
        toast.loading(`Syncing ${i + 1} of ${connectedProviders.length} providers...`, { id: 'sync-all-calendar' });
        await syncCalendar(provider.id);
        successCount++;
      } catch (error: any) {
        console.error(`Error syncing provider ${provider.name}:`, error);
        errorCount++;
      }
    }

    toast.dismiss('sync-all-calendar');
    if (errorCount === 0) {
      toast.success(`Successfully synced ${successCount} provider${successCount !== 1 ? 's' : ''}`);
    } else {
      toast.warning(`Synced ${successCount} provider${successCount !== 1 ? 's' : ''}, ${errorCount} failed`);
    }
    
    setSyncingAll(false);
    refetchAppointments();
  };

  const handleCheckInOut = async (appointmentId: string, currentStatus: string) => {
    try {
      let updates: Record<string, any>;
      let message: string;
      
      if (currentStatus === 'checked-in') {
        // Check-Out: Mark as completed and log time
        updates = { 
          status: 'completed',
          checked_out_at: new Date().toISOString()
        };
        message = 'Patient checked out successfully';
        
        // Find the appointment details for procedure creation
        const appointment = scheduledAppointments.find(apt => apt.id === appointmentId);
        
        // Create procedure record on completion if appointment has procedure type
        if (appointment && appointment.appointmentTypeId && appointment.patientId && appointment.providerId) {
          try {
            const procedure = await createProcedureFromAppointment(
              appointmentId,
              appointment.patientId,
              appointment.providerId,
              appointment.appointmentTypeId,
              (appointment as any).appointmentDate || format(selectedDate, 'yyyy-MM-dd'),
            );
            
            if (procedure) {
              toast.success(`Procedure "${procedure.name}" added automatically`);
            }
          } catch (procError) {
            console.error('Error creating procedure:', procError);
            // Don't fail the check-out if procedure creation fails
          }
        }
      } else {
        // Check-In: Log check-in time
        updates = { 
          status: 'checked-in',
          checked_in_at: new Date().toISOString()
        };
        message = 'Patient checked in successfully';
      }

      await updateAppointmentMutation.mutateAsync({
        appointmentId,
        updates
      });
      toast.success(message);
      refetchAppointments();
    } catch (error: any) {
      console.error('Error updating appointment status:', error);
      toast.error(error?.message || 'Failed to update appointment status');
    }
  };

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Date navigation helpers
  const navigateDate = (days: number) => {
    setSelectedDate(prev => {
      if (viewMode === 'month') return addMonths(prev, days);
      const increment = viewMode === 'week' ? days * 7 : days;
      return addDays(prev, increment);
    });
  };

  const formatDateDisplay = () => {
    if (viewMode === 'month') {
      return format(selectedDate, 'MMMM yyyy');
    }
    if (viewMode === 'week') {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    return format(selectedDate, 'EEEE, MMMM d, yyyy');
  };

  // Get the day of week for selected date (or week start for week view)
  const getDayOfWeek = (date: Date) => {
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayOfWeek = getDayOfWeek(selectedDate);
  
  // For week view, get all days in the week
  const weekDays = viewMode === 'week' 
    ? eachDayOfInterval({
        start: startOfWeek(selectedDate, { weekStartsOn: 0 }),
        end: endOfWeek(selectedDate, { weekStartsOn: 0 })
      })
    : [selectedDate];

  // For month view, get full month grid (including partial weeks)
  const monthGridDays = (() => {
    if (viewMode !== 'month') return [];
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  })();

  // Helper to check if provider has configured hours for a specific day
  const providerHasConfiguredHoursForDay = (p: any, day: string): boolean => {
    if (!p.working_hours || typeof p.working_hours !== 'object' || Object.keys(p.working_hours).length === 0) {
      return false;
    }
    const workingHours = p.working_hours as Record<string, any>;
    const dayHours = workingHours[day];
    return dayHours?.enabled === true && dayHours?.start && dayHours?.end;
  };

  // Show ALL providers in the calendar, regardless of working hours configuration
  const allProviders = providers;

   // Filter providers based on selection (show all if none selected)
   const displayedProviders = providers.filter((p: any) => 
     selectedProviderIds.size === 0 || selectedProviderIds.has(p.id)
   );
  
  // For week view, identify providers who have hours on ANY day in the week
  // For day view, identify providers who have hours on the selected day
  const configuredProvidersToday = viewMode === 'week'
    ? providers.filter((p: any) => 
        weekDays.some(day => providerHasConfiguredHoursForDay(p, getDayOfWeek(day)))
      )
    : providers.filter((p: any) => 
        providerHasConfiguredHoursForDay(p, dayOfWeek)
      );
  
  const unconfiguredProviders = providers.filter((p: any) => 
    !configuredProvidersToday.includes(p)
  );

  // Show ALL providers in the calendar (not just those with configured hours)
   const activeProviders = displayedProviders;

   // Get provider names from displayed providers
  const providerNames = activeProviders.map((p: any) => p.name);

  // Filter appointments for selected date(s) and by provider role
   const todayAppointments = filteredAppointments.filter((apt: any) => {
     // Date filter
    if (viewMode === 'month') {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      const aptDate = new Date(apt.appointment_date + 'T00:00:00');
      if (aptDate < monthStart || aptDate > monthEnd) return false;
    } else if (viewMode === 'week') {
       if (!weekDays.some(day => apt.appointment_date === format(day, 'yyyy-MM-dd'))) return false;
     } else {
       if (apt.appointment_date !== selectedDateStr) return false;
    }
     // Provider filter (if selection is not empty)
     if (selectedProviderIds.size > 0 && !selectedProviderIds.has(apt.provider_id)) return false;
     return true;
  });

  // Show appointments for ALL providers (not just those with configured hours)
  // No need to filter by activeProviders since we're showing all providers now

  // Extended type for appointments with date (needed for week view)
  type AppointmentWithDate = ScheduledAppointment & { appointmentDate: string; checkedInAt?: string | null; checkedOutAt?: string | null };
  
  const scheduledAppointments: AppointmentWithDate[] = todayAppointments.map((apt: any) => ({
    id: apt.id,
    patientName: `${apt.patients?.first_name || ''} ${apt.patients?.last_name || ''}`.trim() || 'Unknown',
    type: apt.appointment_type || 'Appointment',
    procedureName: apt.appointment_types?.name || null,
    procedureCode: apt.appointment_types?.code || null,
    time: apt.start_time?.substring(0, 5) || '00:00', // Extract HH:MM
    duration: apt.duration || 30,
    provider: apt.providers?.name || 'Unknown Provider',
    providerId: apt.provider_id,
    patientId: apt.patient_id,
    appointmentTypeId: apt.appointment_type_id,
    source: apt.foreign_id ? 'nexhealth' : (apt.booking_source === 'nexhealth' ? 'nexhealth' : 'platform'),
    phone: apt.patients?.phone || '',
    notes: apt.notes || '',
    status: apt.status || 'scheduled',
    appointmentDate: apt.appointment_date, // Include date for week view matching
    checkedInAt: apt.checked_in_at,
    checkedOutAt: apt.checked_out_at
  }));

  const timeSlots = Array.from({ length: 96 }, (_, i) => {
    const hour = Math.floor(i / 4);
    const minute = (i % 4) * 15;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  // Provider avatar colors
  const PROVIDER_COLORS = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'
  ];

  const getProviderInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getProviderColor = (idx: number) => PROVIDER_COLORS[idx % PROVIDER_COLORS.length];

  // Appointment type color mapping for modern cards
  const getAppointmentTypeStyle = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('routine') || t.includes('checkup') || t.includes('cleaning'))
      return { bg: 'bg-sky-50 dark:bg-sky-950/40', border: 'border-l-sky-400', label: 'text-sky-600 dark:text-sky-400', labelBg: 'bg-sky-100 dark:bg-sky-900/40' };
    if (t.includes('follow') || t.includes('recall'))
      return { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-l-emerald-400', label: 'text-emerald-600 dark:text-emerald-400', labelBg: 'bg-emerald-100 dark:bg-emerald-900/40' };
    if (t.includes('consult') || t.includes('specialist'))
      return { bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-l-violet-400', label: 'text-violet-600 dark:text-violet-400', labelBg: 'bg-violet-100 dark:bg-violet-900/40' };
    if (t.includes('imaging') || t.includes('x-ray') || t.includes('scan'))
      return { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-l-amber-400', label: 'text-amber-600 dark:text-amber-400', labelBg: 'bg-amber-100 dark:bg-amber-900/40' };
    if (t.includes('surgery') || t.includes('extraction') || t.includes('procedure'))
      return { bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-l-rose-400', label: 'text-rose-600 dark:text-rose-400', labelBg: 'bg-rose-100 dark:bg-rose-900/40' };
    if (t.includes('virtual') || t.includes('tele'))
      return { bg: 'bg-yellow-50 dark:bg-yellow-950/40', border: 'border-l-yellow-400', label: 'text-yellow-600 dark:text-yellow-400', labelBg: 'bg-yellow-100 dark:bg-yellow-900/40' };
    if (t.includes('emergency') || t.includes('urgent'))
      return { bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-l-red-500', label: 'text-red-600 dark:text-red-400', labelBg: 'bg-red-100 dark:bg-red-900/40' };
    // Default
    return { bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-l-blue-400', label: 'text-blue-600 dark:text-blue-400', labelBg: 'bg-blue-100 dark:bg-blue-900/40' };
  };

  const getAppointmentColor = (providerId: string, status?: string, appointmentDate?: string) => {
    const isToday = appointmentDate === todayStr;
    
    // For TODAY'S appointments, use status-based colors
    if (isToday && status) {
      switch (status) {
        case 'checked-in':
          return 'bg-teal-100 border-teal-400 text-teal-900 dark:bg-teal-900/40 dark:border-teal-600 dark:text-teal-100';
        case 'completed':
          return 'bg-green-100 border-green-400 text-green-900 dark:bg-green-900/40 dark:border-green-600 dark:text-green-100';
        case 'cancelled':
          return 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-800/40 dark:border-gray-600 dark:text-gray-400';
        case 'no-show':
          return 'bg-red-100 border-red-300 text-red-900 dark:bg-red-900/40 dark:border-red-600 dark:text-red-100';
        case 'scheduled':
        default:
          return 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-100';
      }
    }
    
    // For other days, use provider-based colors
    const colorMap: Record<string, string> = {
      '00000000-0000-0000-0000-000000000101': 'bg-cyan-100 border-cyan-300 text-cyan-900 dark:bg-cyan-900/30 dark:border-cyan-700 dark:text-cyan-100',
      '00000000-0000-0000-0000-000000000102': 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-100',
      '00000000-0000-0000-0000-000000000103': 'bg-green-100 border-green-300 text-green-900 dark:bg-green-900/30 dark:border-green-700 dark:text-green-100',
      '00000000-0000-0000-0000-000000000104': 'bg-orange-100 border-orange-300 text-orange-900 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-100',
    };
    return colorMap[providerId] || 'bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-900/30 dark:border-gray-700 dark:text-gray-100';
  };

  const getAppointmentSpan = (duration: number) => {
    return Math.ceil(duration / 15);
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Break time helpers
  const getBreakAtTime = (provider: any, time: string, day: string) => {
    const workingHours = provider.working_hours as Record<string, any> | null;
    const dayHours = workingHours?.[day];
    if (!dayHours?.breaks || !Array.isArray(dayHours.breaks)) return null;
    const slotMinutes = timeToMinutes(time);
    return dayHours.breaks.find((b: any) => {
      const breakStart = timeToMinutes(b.start);
      return slotMinutes === breakStart;
    }) || null;
  };

  const isInBreakTime = (provider: any, time: string, day: string) => {
    const workingHours = provider.working_hours as Record<string, any> | null;
    const dayHours = workingHours?.[day];
    if (!dayHours?.breaks || !Array.isArray(dayHours.breaks)) return false;
    const slotMinutes = timeToMinutes(time);
    return dayHours.breaks.some((b: any) => {
      const breakStart = timeToMinutes(b.start);
      const breakEnd = timeToMinutes(b.end);
      return slotMinutes >= breakStart && slotMinutes < breakEnd;
    });
  };

  const getBreakSpan = (breakObj: any) => {
    const startMin = timeToMinutes(breakObj.start);
    const endMin = timeToMinutes(breakObj.end);
    return Math.ceil((endMin - startMin) / 15);
  };

  const isTimeSlotOccupied = (slotTime: string, provider: string) => {
    return scheduledAppointments.find(apt => {
      if (apt.provider !== provider) return false;
      const slotMinutes = timeToMinutes(slotTime);
      const aptStartMinutes = timeToMinutes(apt.time);
      return slotMinutes === aptStartMinutes;
    });
  };

  // Count appointments per provider for the day
  const getProviderAppointmentCount = (providerId: string) => {
    return scheduledAppointments.filter(apt => apt.providerId === providerId).length;
  };

  // Error handling
  if (appointmentsError) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Appointment Calendar</h1>
        <Card className="p-6">
          <div className="text-center text-destructive">
            <p className="font-semibold">Error loading appointments</p>
            <p className="text-sm text-muted-foreground mt-2">
              {appointmentsError instanceof Error ? appointmentsError.message : 'Unknown error'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Make sure database migrations have been run.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
     <div className="space-y-6">
       {/* Modernized Header with Gradient */}
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 -mx-6 -mt-6 px-6 py-6 mb-6 rounded-b-2xl">
         <div>
           <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
             Appointment Calendar
           </h1>
           <p className="text-muted-foreground mt-1">
             {loadingAppointments ? 'Loading...' : `${appointments.length} total appointments`}
          </p>
        </div>
        <div className="flex gap-2">
          {providers.some((p: any) => p.google_sync_enabled) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={loadingAppointments || syncingAll}>
                  <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
                  Sync Calendars
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Sync Google Calendar</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {providers
                  .filter((p: any) => {
                    // For providers, only show their own calendar
                    if (isProviderRole && userProviderId) {
                      return p.google_sync_enabled && p.id === userProviderId;
                    }
                    // For super_admin/admin, show all enabled providers
                    return p.google_sync_enabled;
                  })
                  .map((provider: any) => (
                    <DropdownMenuItem
                      key={provider.id}
                      onClick={() => handleSyncProvider(provider.id)}
                      disabled={syncingProviderId === provider.id || syncingAll}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${syncingProviderId === provider.id ? 'animate-spin' : ''}`} />
                      {provider.name}
                    </DropdownMenuItem>
                  ))}
                {/* Show "Sync All" for super_admin and admin users */}
                {(isSuperAdmin || isAdmin) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSyncAll}
                      disabled={syncingAll}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${syncingAll ? 'animate-spin' : ''}`} />
                      Sync All
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2" disabled={loadingAppointments}>
                <Plus className="h-4 w-4" />
                New Appointment
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowAddAppointmentDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Appointment
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSyncNexHealth}
                disabled={!nexhealthConfigured || syncingNexHealth}
              >
                <Download className={`h-4 w-4 mr-2 ${syncingNexHealth ? 'animate-bounce' : ''}`} />
                Sync NexHealth
                {!nexhealthConfigured && (
                  <span className="ml-1 text-xs text-muted-foreground">(Not configured)</span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

       <Tabs defaultValue="today" className="w-full">
         <TabsList className="w-full sm:w-auto flex-wrap">
           <TabsTrigger value="today">Schedule</TabsTrigger>
           <TabsTrigger value="recent">Recent Appointments</TabsTrigger>
         </TabsList>

        <TabsContent value="today" className="space-y-4">
           {/* Summary Cards */}
           <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
             <Card className="p-4">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                   <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                 </div>
                 <div>
                   <p className="text-2xl font-bold">{loadingStats ? '-' : calendarStats?.todayCount}</p>
                   <p className="text-xs text-muted-foreground">Today</p>
                 </div>
               </div>
             </Card>
             
             <Card className="p-4">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                   <CalendarCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                 </div>
                 <div>
                   <p className="text-2xl font-bold">{loadingStats ? '-' : calendarStats?.weekCount}</p>
                   <p className="text-xs text-muted-foreground">This Week</p>
                 </div>
               </div>
             </Card>

             <Card className="p-4">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                   <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                 </div>
                 <div>
                   <p className="text-2xl font-bold">{loadingStats ? '-' : calendarStats?.monthCount}</p>
                   <p className="text-xs text-muted-foreground">This Month</p>
                 </div>
               </div>
             </Card>

             <Card className="p-4">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                   <UserCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                 </div>
                 <div>
                   <p className="text-2xl font-bold">{loadingStats ? '-' : calendarStats?.checkedInCount}</p>
                    <p className="text-xs text-muted-foreground">Checked In Today</p>
                 </div>
               </div>
             </Card>

             <Card className="p-4">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                   <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                 </div>
                 <div>
                   <p className="text-2xl font-bold">{loadingStats ? '-' : calendarStats?.completedCount}</p>
                    <p className="text-xs text-muted-foreground">Completed Today</p>
                 </div>
               </div>
             </Card>
           </div>

           {/* Critical Alerts Panel */}
           {criticalAlerts.length > 0 && (
             <Card className="border-orange-200 dark:border-orange-800">
               <div className="p-4">
                 <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2">
                     <AlertTriangle className="h-5 w-5 text-orange-500" />
                     <h3 className="font-semibold">Critical Appointments Requiring Attention</h3>
                     <Badge variant="destructive">{criticalAlerts.length}</Badge>
                   </div>
                   <Button variant="outline" size="sm" onClick={runRiskAnalysis} disabled={runningAgent}>
                     <RefreshCw className={`h-4 w-4 mr-2 ${runningAgent ? 'animate-spin' : ''}`} />
                     Refresh Analysis
                   </Button>
                 </div>
                 <div className="space-y-3">
                   {criticalAlerts.slice(0, 5).map((alert: any) => (
                     <div key={alert.id} className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                       <Badge variant={alert.priority === 'critical' ? 'destructive' : 'secondary'}>
                         {alert.priority}
                       </Badge>
                       <div className="flex-1 min-w-0">
                         <p className="font-medium truncate">{alert.title}</p>
                         <p className="text-sm text-muted-foreground line-clamp-2">{alert.description}</p>
                         <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{alert.suggested_action}</p>
                       </div>
                       <Button variant="ghost" size="sm" onClick={() => dismissAlert(alert.id)}>
                         Dismiss
                       </Button>
                     </div>
                   ))}
                 </div>
               </div>
             </Card>
           )}

          <Card className="p-6 shadow-sm border-border/60">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
                    Today
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div>
                    <h2 className="text-lg font-bold leading-tight">{formatDateDisplay()}</h2>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    {(['day', 'week', 'month'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                          viewMode === mode 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-background text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Provider Filter */}
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setProviderModalOpen(true)}>
                    <Users className="h-4 w-4" />
                    Providers ({selectedProviderIds.size}/{providers.length})
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
            </div>

            {loadingAppointments || loadingProviders ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : allProviders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>No providers found. Please add providers to the system.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {viewMode === 'month' ? (
                  /* ===== MONTH VIEW ===== */
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="grid grid-cols-7 bg-muted/30 border-b">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center py-2 border-r last:border-r-0">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {monthGridDays.map((date) => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const isCurrentMonth = isSameMonth(date, selectedDate);
                        const isToday = dateStr === todayStr;
                        const dayApts = scheduledAppointments.filter(a => a.appointmentDate === dateStr);
                        return (
                          <button
                            key={dateStr}
                            onClick={() => { setSelectedDate(date); setViewMode('day'); }}
                            className={`min-h-[90px] p-2 border-r border-b last:border-r-0 text-left transition-colors hover:bg-muted/30 ${!isCurrentMonth ? 'opacity-40 bg-muted/10' : 'bg-background'}`}
                          >
                            <span className={`text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
                              {format(date, 'd')}
                            </span>
                            <div className="mt-1 space-y-0.5">
                              {dayApts.slice(0, 3).map(apt => {
                                const typeStyle = getAppointmentTypeStyle(apt.type);
                                return (
                                  <div key={apt.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate ${typeStyle.bg} ${typeStyle.label}`}>
                                    {apt.time} {apt.patientName}
                                  </div>
                                );
                              })}
                              {dayApts.length > 3 && (
                                <p className="text-[10px] text-muted-foreground font-medium pl-1">+{dayApts.length - 3} more</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : viewMode === 'week' ? (
                  /* ===== WEEK VIEW (day columns) ===== */
                  <div className="relative grid gap-0 min-w-[800px] rounded-xl border border-border/60 shadow-sm" style={{ gridTemplateColumns: '70px repeat(7, 1fr)' }}>
                    <div className="p-3 bg-muted/30 border-b border-r flex items-end">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</span>
                    </div>
                    {weekDays.map((date, dateIdx) => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const isToday = dateStr === todayStr;
                      return (
                        <div key={dateStr} className={`p-3 bg-muted/30 border-b text-center ${dateIdx < 6 ? 'border-r' : ''}`}>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{format(date, 'EEE')}</div>
                          <div className={`text-lg font-bold mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                            {format(date, 'd')}
                          </div>
                        </div>
                      );
                    })}
                    {timeSlots.map((time, timeIdx) => {
                      const isHourMark = time.endsWith(':00');
                      return (
                        <Fragment key={time}>
                          <div className={`text-xs px-2 py-1 border-r bg-background/80 flex items-start ${isHourMark ? 'border-t border-border/60 font-semibold text-foreground' : 'border-t border-border/20 text-muted-foreground/60'}`}>
                            {isHourMark ? format(new Date(`2000-01-01T${time}`), 'HH:mm') : ''}
                          </div>
                          {weekDays.map((date, dateIdx) => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const isTodayCol = dateStr === todayStr;
                            const weekDayOfWeek = getDayOfWeek(date);
                            const apt = scheduledAppointments.find(a => a.appointmentDate === dateStr && a.time === time);

                            // Break detection for week view
                            const providersForDay = activeProviders.filter((p: any) => providerHasConfiguredHoursForDay(p, weekDayOfWeek));
                            const providersOnBreak = providersForDay.filter((p: any) => isInBreakTime(p, time, weekDayOfWeek));
                            const allOnBreak = providersForDay.length > 0 && providersOnBreak.length === providersForDay.length;
                            const someOnBreak = providersOnBreak.length > 0 && !allOnBreak;
                            // Find the first provider's break that starts at this time (for span calculation)
                            const weekBreakAtTime = allOnBreak ? (() => {
                              for (const p of providersForDay) {
                                const b = getBreakAtTime(p, time, weekDayOfWeek);
                                if (b) return b;
                              }
                              return null;
                            })() : null;

                            return (
                              <div key={`${dateStr}-${time}`} className={`relative ${isHourMark ? 'border-t border-border/60' : 'border-t border-border/20'} ${dateIdx < 6 ? 'border-r border-border/40' : ''} h-[40px] ${isTodayCol ? 'bg-primary/[0.02]' : ''} ${someOnBreak && !apt ? 'bg-muted/10' : ''} ${!apt && !allOnBreak ? 'hover:bg-muted/20 transition-colors' : ''}`}>
                                {weekBreakAtTime && !apt && (
                                  <div
                                    className="absolute inset-x-0.5 top-0.5 rounded-md bg-muted/60 dark:bg-muted/30 border border-dashed border-muted-foreground/20 flex items-center justify-center overflow-hidden"
                                    style={{ height: `calc(${getBreakSpan(weekBreakAtTime)} * 40px - 4px)`, zIndex: 1, backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 4px, hsl(var(--muted-foreground) / 0.05) 4px, hsl(var(--muted-foreground) / 0.05) 8px)' }}
                                  >
                                    <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Break</span>
                                  </div>
                                )}
                                {apt && (() => {
                                  const typeStyle = getAppointmentTypeStyle(apt.type);
                                  const endMinutes = timeToMinutes(apt.time) + apt.duration;
                                  const endHour = Math.floor(endMinutes / 60).toString().padStart(2, '0');
                                  const endMin = (endMinutes % 60).toString().padStart(2, '0');
                                  return (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <motion.button
                                          initial={{ opacity: 0, scale: 0.95 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          className={`absolute inset-x-0.5 top-0.5 p-1.5 rounded-lg border-l-[3px] ${typeStyle.border} ${typeStyle.bg} text-left cursor-pointer hover:shadow-md transition-all overflow-hidden`}
                                          style={{ height: `calc(${getAppointmentSpan(apt.duration)} * 40px - 4px)`, zIndex: 2 }}
                                          onClick={() => setSelectedAppointment(apt)}
                                        >
                                          <span className="text-[10px] text-muted-foreground">{apt.time}</span>
                                          <p className="font-semibold text-xs leading-tight truncate text-foreground">{apt.patientName}</p>
                                          <p className={`text-[10px] truncate ${typeStyle.label}`}>{apt.type}</p>
                                          {apt.status === 'checked-in' && <span className="absolute top-1 right-1 w-2 h-2 bg-teal-500 rounded-full animate-pulse" />}
                                        </motion.button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-72" align="start">
                                        <div className="space-y-2">
                                          <h4 className="font-semibold flex items-center gap-2"><User className="h-4 w-4 text-primary" />{apt.patientName}</h4>
                                          <p className="text-sm text-muted-foreground">{apt.type} • {apt.time} - {endHour}:{endMin} • {apt.provider}</p>
                                          <div className="flex gap-2 pt-1">
                                            <Button size="sm" className="flex-1" onClick={() => { handleCheckInOut(apt.id, apt.status || 'scheduled'); setSelectedAppointment(null); }} disabled={updateAppointmentMutation.isPending || apt.status === 'completed'}>
                                              {apt.status === 'completed' ? 'Completed' : apt.status === 'checked-in' ? 'Check Out' : 'Check In'}
                                            </Button>
                                            <Button size="sm" variant="outline" className="flex-1" onClick={() => { setSelectedAppointment(apt); setShowRescheduleDialog(true); }}>Reschedule</Button>
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                   {/* Week view current time indicator */}
                  {(() => {
                    const todayIdx = weekDays.findIndex(d => format(d, 'yyyy-MM-dd') === todayStr);
                    if (todayIdx < 0 || currentTimeOffset < 0) return null;
                    const headerHeight = 52;
                    return (
                      <div className="absolute z-30 pointer-events-none" style={{ top: `${headerHeight + currentTimeOffset}px`, left: `calc(70px + ${todayIdx} * ((100% - 70px) / 7))`, width: `calc((100% - 70px) / 7)` }}>
                        <div className="relative flex items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1 shrink-0" />
                          <div className="flex-1 h-0.5 bg-destructive" />
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                ) : (
                  /* ===== DAY VIEW (responsive) ===== */
                  <div className="relative grid gap-0 rounded-xl border border-border/60 shadow-sm" style={{ gridTemplateColumns: `70px repeat(${providerNames.length}, minmax(100px, 1fr))` }}>
                    <div className="p-3 bg-muted/30 border-b border-r sticky top-0 z-10 flex items-end">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</span>
                    </div>
                    {activeProviders.map((provider: any, idx: number) => {
                      const aptCount = getProviderAppointmentCount(provider.id);
                      return (
                        <div key={provider.id} className={`p-3 bg-muted/30 border-b ${idx < activeProviders.length - 1 ? 'border-r' : ''} sticky top-0 z-10`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full ${getProviderColor(idx)} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
                              {getProviderInitials(provider.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs truncate">{provider.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate hidden sm:block">{provider.specialty || 'General'}</p>
                              <p className="text-[10px] text-muted-foreground">{aptCount} {aptCount === 1 ? 'slot' : 'slots'}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {timeSlots.map((time) => {
                      const isHourMark = time.endsWith(':00');
                      return (
                        <Fragment key={time}>
                          <div className={`text-xs px-2 py-1 border-r bg-background/80 flex items-start ${isHourMark ? 'border-t border-border/60 font-semibold text-foreground' : 'border-t border-border/20 text-muted-foreground/60'}`}>
                            {isHourMark ? format(new Date(`2000-01-01T${time}`), 'HH:mm') : ''}
                          </div>
                          {activeProviders.map((providerObj: any, providerIdx: number) => {
                            const provider = providerObj.name;
                            const apt = isTimeSlotOccupied(time, provider);
                            const shouldRender = apt && apt.time === time;
                            const breakAtTime = getBreakAtTime(providerObj, time, dayOfWeek);
                            const inBreak = !breakAtTime && isInBreakTime(providerObj, time, dayOfWeek);
                            return (
                              <div key={`${provider}-${time}`} className={`relative ${isHourMark ? 'border-t border-border/60' : 'border-t border-border/20'} ${providerIdx < providerNames.length - 1 ? 'border-r border-border/40' : ''} h-[40px] ${!shouldRender && !breakAtTime && !inBreak ? 'hover:bg-muted/20 transition-colors' : ''}`}>
                              {breakAtTime && !shouldRender && (
                                <div
                                  className="absolute inset-x-0.5 top-0.5 rounded-md bg-muted/60 dark:bg-muted/30 border border-dashed border-muted-foreground/20 flex items-center justify-center overflow-hidden"
                                  style={{ height: `calc(${getBreakSpan(breakAtTime)} * 40px - 4px)`, zIndex: 1, backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 4px, hsl(var(--muted-foreground) / 0.05) 4px, hsl(var(--muted-foreground) / 0.05) 8px)' }}
                                >
                                  <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Break</span>
                                </div>
                              )}
                              {shouldRender && (() => {
                                const typeStyle = getAppointmentTypeStyle(apt.type);
                                const endMinutes = timeToMinutes(apt.time) + apt.duration;
                                const endHour = Math.floor(endMinutes / 60).toString().padStart(2, '0');
                                const endMin = (endMinutes % 60).toString().padStart(2, '0');
                                const endTime = `${endHour}:${endMin}`;
                                return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <motion.button
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, delay: providerIdx * 0.03 }}
                                    className={`absolute inset-x-1 top-0.5 p-2 rounded-lg border-l-[3px] ${typeStyle.border} ${typeStyle.bg} text-left cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all overflow-hidden`}
                                    style={{ height: `calc(${getAppointmentSpan(apt.duration)} * 40px - 4px)`, zIndex: 2 }}
                                    onClick={() => setSelectedAppointment(apt)}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <span className={`text-[10px] font-bold uppercase tracking-wider ${typeStyle.label} truncate`}>{apt.type}</span>
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{apt.time} - {endTime}</span>
                                    </div>
                                    <p className="font-semibold text-xs leading-tight truncate mt-0.5 text-foreground">{apt.patientName}</p>
                                    {apt.notes && getAppointmentSpan(apt.duration) > 2 && (
                                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{apt.notes}</p>
                                    )}
                                    {apt.status === 'checked-in' && <span className="absolute bottom-1.5 right-1.5 w-2 h-2 bg-teal-500 rounded-full animate-pulse" title="Checked In" />}
                                    {apt.status === 'completed' && <span className="absolute bottom-1 right-1.5 text-green-600 dark:text-green-400 text-xs font-bold">✓</span>}
                                    {(apt.type.toLowerCase().includes('urgent') || apt.type.toLowerCase().includes('emergency')) && (
                                      <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[8px] font-bold px-1 py-0.5 rounded uppercase">Urgent</span>
                                    )}
                                  </motion.button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80" align="start">
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-lg flex items-center gap-2"><User className="h-4 w-4 text-primary" />{apt.patientName}</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex items-start gap-2"><FileText className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="font-medium">Visit Type</p><p className="text-muted-foreground">{apt.type}</p></div></div>
                                      <div className="flex items-start gap-2"><Clock className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="font-medium">Time</p><p className="text-muted-foreground">{apt.time} - {endTime} ({apt.duration} min)</p></div></div>
                                      <div className="flex items-start gap-2"><User className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="font-medium">Provider</p><p className="text-muted-foreground">{apt.provider}</p></div></div>
                                      {apt.phone && <div className="flex items-start gap-2"><Phone className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="font-medium">Phone</p><p className="text-muted-foreground">{apt.phone}</p></div></div>}
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                      <Button size="sm" className="flex-1" onClick={() => { handleCheckInOut(apt.id, apt.status || 'scheduled'); setSelectedAppointment(null); }} disabled={updateAppointmentMutation.isPending || apt.status === 'completed'}>
                                        {apt.status === 'completed' ? 'Completed' : apt.status === 'checked-in' ? 'Check Out' : 'Check In'}
                                      </Button>
                                      <Button size="sm" variant="outline" className="flex-1" onClick={() => { setSelectedAppointment(apt); setShowRescheduleDialog(true); }}>Reschedule</Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                                );
                              })()}
                              </div>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                    {/* Day view current time indicator */}
                    {isToday && currentTimeOffset >= 0 && (
                      <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${80 + currentTimeOffset}px` }}>
                        <div className="relative flex items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1 shrink-0" />
                          <div className="flex-1 h-0.5 bg-destructive" />
                        </div>
                      </div>
                    )}
                   </div>
                )}
              </div>
            )}

            {/* Current time indicator for Day view */}
          </Card>

        </TabsContent>



         {/* Recent Appointments Tab */}
         <TabsContent value="recent" className="space-y-4">
           <Card className="p-6">
             {/* Header with search and timeline filter */}
             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
               <div>
                 <h2 className="text-xl font-semibold">Recent & Completed Appointments</h2>
                 <p className="text-sm text-muted-foreground">Last 30 days and upcoming appointments</p>
               </div>
               <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                 <Select value={recentTimelineFilter} onValueChange={(v) => { setRecentTimelineFilter(v); setRecentPage(1); }}>
                   <SelectTrigger className="w-full sm:w-44">
                     <Filter className="h-4 w-4 mr-2 shrink-0" />
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All</SelectItem>
                     <SelectItem value="today">Today</SelectItem>
                     <SelectItem value="yesterday">Yesterday</SelectItem>
                     <SelectItem value="this_week">This Week</SelectItem>
                     <SelectItem value="last_week">Last Week</SelectItem>
                     <SelectItem value="last_30">Last 30 Days</SelectItem>
                     <SelectItem value="upcoming">Upcoming</SelectItem>
                   </SelectContent>
                 </Select>
                 <div className="relative w-full sm:w-72">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input
                     placeholder="Search patient, provider, type..."
                     value={recentSearchQuery}
                     onChange={(e) => { setRecentSearchQuery(e.target.value); setRecentPage(1); }}
                     className="pl-10"
                   />
                 </div>
               </div>
             </div>

             {/* Appointments list */}
             {loadingAppointments ? (
               <div className="space-y-3">
                 <Skeleton className="h-16 w-full" />
                 <Skeleton className="h-16 w-full" />
                 <Skeleton className="h-16 w-full" />
                 <Skeleton className="h-16 w-full" />
               </div>
             ) : (
               <div className="space-y-1">
                 {(() => {
                   const nowStr = new Date().toISOString().split('T')[0];
                   const nowDate = new Date(nowStr + 'T00:00:00');
                   const yesterdayStr = format(subDays(nowDate, 1), 'yyyy-MM-dd');
                   const tomorrowStr = format(addDays(nowDate, 1), 'yyyy-MM-dd');
                   const weekStartStr = format(startOfWeek(nowDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
                   const weekEndStr = format(endOfWeek(nowDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
                   const lastWeekStartStr = format(startOfWeek(subDays(nowDate, 7), { weekStartsOn: 0 }), 'yyyy-MM-dd');
                   const lastWeekEndStr = format(endOfWeek(subDays(nowDate, 7), { weekStartsOn: 0 }), 'yyyy-MM-dd');
                   const nextWeekEndStr = format(endOfWeek(addDays(nowDate, 7), { weekStartsOn: 0 }), 'yyyy-MM-dd');
                   const thirtyDaysAgoStr = format(subDays(nowDate, 30), 'yyyy-MM-dd');
                   const thirtyDaysFromNowStr = format(addDays(nowDate, 30), 'yyyy-MM-dd');

                   // Base window: last 30 days + next 30 days
                   let recentAppointments = appointments.filter((apt: any) => {
                     if (!apt.appointment_date) return false;
                     const aptDateStr = apt.appointment_date.split('T')[0];
                     return aptDateStr >= thirtyDaysAgoStr && aptDateStr <= thirtyDaysFromNowStr;
                   });

                   // Apply timeline filter
                   if (recentTimelineFilter !== 'all') {
                     recentAppointments = recentAppointments.filter((apt: any) => {
                       const aptDateStr = apt.appointment_date.split('T')[0];
                       switch (recentTimelineFilter) {
                         case 'today': return aptDateStr === nowStr;
                         case 'yesterday': return aptDateStr === yesterdayStr;
                         case 'this_week': return aptDateStr >= weekStartStr && aptDateStr <= weekEndStr;
                         case 'last_week': return aptDateStr >= lastWeekStartStr && aptDateStr <= lastWeekEndStr;
                         case 'last_30': return aptDateStr >= thirtyDaysAgoStr && aptDateStr <= nowStr;
                         case 'upcoming': return aptDateStr > nowStr;
                         default: return true;
                       }
                     });
                   }

                   // Apply search filter
                   if (recentSearchQuery.trim()) {
                     const query = recentSearchQuery.toLowerCase();
                     recentAppointments = recentAppointments.filter((apt: any) => {
                       const patientName = `${apt.patients?.first_name || ''} ${apt.patients?.last_name || ''}`.toLowerCase();
                       const providerName = (apt.providers?.name || '').toLowerCase();
                       const appointmentType = (apt.appointment_type || '').toLowerCase();
                       const status = (apt.status || '').toLowerCase();
                       return patientName.includes(query) || providerName.includes(query) || appointmentType.includes(query) || status.includes(query);
                     });
                   }

                   // Sort: upcoming first (ascending by date/time), then past (descending)
                   const sortedAppointments = [...recentAppointments].sort((a: any, b: any) => {
                     if (!a.appointment_date || !b.appointment_date) return 0;
                     const dateAStr = a.appointment_date.split('T')[0];
                     const dateBStr = b.appointment_date.split('T')[0];
                     const isAUpcoming = dateAStr >= nowStr;
                     const isBUpcoming = dateBStr >= nowStr;
                     if (isAUpcoming && isBUpcoming) {
                       const dc = dateAStr.localeCompare(dateBStr);
                       return dc !== 0 ? dc : (a.start_time || '').localeCompare(b.start_time || '');
                     }
                     if (!isAUpcoming && !isBUpcoming) {
                       const dc = dateBStr.localeCompare(dateAStr);
                       return dc !== 0 ? dc : (b.start_time || '').localeCompare(a.start_time || '');
                     }
                     return isAUpcoming ? -1 : 1;
                   });

                   if (sortedAppointments.length === 0) {
                     return (
                       <div className="p-8 text-center text-muted-foreground">
                         {recentSearchQuery || recentTimelineFilter !== 'all'
                           ? 'No appointments match your filters.'
                           : 'No appointments found in the last 30 days or next 30 days.'}
                       </div>
                     );
                   }

                   const totalCount = sortedAppointments.length;
                   const totalPages = Math.ceil(totalCount / recentPageSize);
                   const safePage = Math.min(Math.max(recentPage, 1), totalPages);
                   const paginatedAppointments = sortedAppointments.slice(
                     (safePage - 1) * recentPageSize,
                     safePage * recentPageSize
                   );

                   // Timeline group label
                   const getGroupLabel = (dateStr: string) => {
                     if (dateStr === nowStr) return 'Today';
                     if (dateStr === yesterdayStr) return 'Yesterday';
                     if (dateStr === tomorrowStr) return 'Tomorrow';
                     if (dateStr > nowStr) {
                       if (dateStr <= weekEndStr) return 'This Week';
                       if (dateStr <= nextWeekEndStr) return 'Next Week';
                       return 'Later';
                     }
                     if (dateStr >= weekStartStr) return 'Earlier This Week';
                     if (dateStr >= lastWeekStartStr && dateStr <= lastWeekEndStr) return 'Last Week';
                     return format(new Date(dateStr + 'T00:00:00'), 'EEE, MMM d, yyyy');
                   };

                   // Build ordered groups
                   const groups: { label: string; appointments: any[] }[] = [];
                   const labelIndexMap = new Map<string, number>();
                   for (const apt of paginatedAppointments) {
                     const dateStr = apt.appointment_date?.split('T')[0] || '';
                     const label = getGroupLabel(dateStr);
                     if (!labelIndexMap.has(label)) {
                       labelIndexMap.set(label, groups.length);
                       groups.push({ label, appointments: [apt] });
                     } else {
                       groups[labelIndexMap.get(label)!].appointments.push(apt);
                     }
                   }

                   // Status styling
                   const getStatusBorderColor = (status: string) => {
                     switch (status) {
                       case 'completed': return 'border-l-green-500';
                       case 'checked-in': return 'border-l-teal-500';
                       case 'cancelled': return 'border-l-gray-400';
                       case 'no-show': return 'border-l-red-500';
                       default: return 'border-l-blue-400';
                     }
                   };

                   const getCardBg = (status: string, isAptToday: boolean) => {
                     if (status === 'completed') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
                     if (status === 'checked-in') return 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800';
                     if (status === 'cancelled') return 'bg-gray-50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700';
                     if (status === 'no-show') return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
                     if (isAptToday) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
                     return 'bg-muted/30 border-border';
                   };

                   const getBookingSourceStyle = (source: string) => {
                     const s = (source || '').toLowerCase();
                     if (s === 'agent' || s === 'voice' || s === 'ai') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300';
                     if (s === 'nexhealth') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
                     return 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400';
                   };

                   const getBookingSourceLabel = (source: string) => {
                     const s = (source || '').toLowerCase();
                     if (s === 'agent' || s === 'voice' || s === 'ai') return 'Agent';
                     if (s === 'nexhealth') return 'NexHealth';
                     return source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Manual';
                   };

                   return (
                     <>
                       {groups.map((group) => (
                         <div key={group.label} className="mb-4">
                           {/* Sticky date group header */}
                           <div className="sticky top-0 z-10 flex items-center gap-2 px-2 py-1.5 mb-2 bg-muted/80 backdrop-blur-sm rounded-md">
                             <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
                             <span className="text-xs text-muted-foreground/60">({group.appointments.length})</span>
                           </div>
                            {group.appointments.map((apt: any) => (
                            <div key={apt.id} className="flex items-center gap-4 text-sm mb-2">
                              <div className="text-right">
                                <p className="font-medium">
                                  {apt.appointment_date
                                   ? format(new Date(apt.appointment_date.split('T')[0] + 'T00:00:00'), 'MMM dd, yyyy')
                                   : 'N/A'}
                               </p>
                               <p className="text-muted-foreground">{apt.start_time?.substring(0, 5) || 'N/A'}</p>
                             </div>
                             <div className="text-right min-w-[100px]">
                               <p className="text-muted-foreground">{apt.providers?.name || 'Unknown'}</p>
                               <Badge
                                 variant={
                                   apt.status === 'completed' ? 'default' :
                                   apt.status === 'checked-in' ? 'secondary' :
                                   apt.status === 'cancelled' ? 'destructive' :
                                   apt.status === 'no-show' ? 'destructive' : 'outline'
                                 }
                                 className="mt-1"
                               >
                                 {apt.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                 {apt.status || 'scheduled'}
                               </Badge>
                             </div>
                             <div className="text-right min-w-[90px]">
                               {apt.booking_source && (() => {
                                 const lower = apt.booking_source.toLowerCase();
                                 let label = apt.booking_source;
                                 if (lower.includes('agent')) {
                                   const activeAgent = agentConfigs.find((a: any) => a.is_active && a.agent_type === 'inbound');
                                   label = activeAgent ? `Agent ${activeAgent.agent_name}` : 'Agent';
                                 } else if (lower === 'manual') {
                                   label = 'Manual';
                                 } else if (lower === 'nexhealth') {
                                   label = 'NexHealth Sync';
                                 }
                                 return (
                                   <Badge variant="secondary" className="text-xs">
                                     {label}
                                   </Badge>
                                 );
                               })()}
                               {apt.created_at && (
                                 <p className="text-xs text-muted-foreground mt-1">
                                   {format(new Date(apt.created_at), 'MMM dd, yyyy h:mm a')}
                                 </p>
                               )}
                             </div>
                            </div>
                            ))}
                          </div>
                       ))}

                       {/* Pagination footer */}
                       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t mt-2">
                         <div className="flex items-center gap-2 text-sm text-muted-foreground">
                           <span>
                             Showing {(safePage - 1) * recentPageSize + 1}–{Math.min(safePage * recentPageSize, totalCount)} of {totalCount}
                           </span>
                           <Select value={String(recentPageSize)} onValueChange={(v) => { setRecentPageSize(Number(v)); setRecentPage(1); }}>
                             <SelectTrigger className="h-8 w-20">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="25">25</SelectItem>
                               <SelectItem value="50">50</SelectItem>
                               <SelectItem value="100">100</SelectItem>
                             </SelectContent>
                           </Select>
                           <span>per page</span>
                         </div>
                         <div className="flex gap-1">
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => setRecentPage(p => Math.max(1, p - 1))}
                             disabled={safePage <= 1}
                           >
                             <ChevronLeft className="h-4 w-4 mr-1" />
                             Previous
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => setRecentPage(p => Math.min(totalPages, p + 1))}
                             disabled={safePage >= totalPages}
                           >
                             Next
                             <ChevronRight className="h-4 w-4 ml-1" />
                           </Button>
                         </div>
                       </div>
                     </>
                   );
                 })()}
               </div>
             )}
           </Card>
        </TabsContent>
      </Tabs>

      {/* Provider Selection Modal */}
      <Dialog open={providerModalOpen} onOpenChange={setProviderModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Providers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Show/hide providers in the calendar</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm"
                  onClick={() => setSelectedProviderIds(new Set(providers.filter((p: any) => p.is_active !== false).map((p: any) => p.id)))}>
                  All
                </Button>
                <Button variant="ghost" size="sm"
                  onClick={() => setSelectedProviderIds(new Set())}>
                  None
                </Button>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {providers
                .filter((provider: any) => provider.is_active !== false)
                .map((provider: any) => (
                  <div key={provider.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`modal-provider-${provider.id}`}
                      checked={selectedProviderIds.has(provider.id)}
                      onCheckedChange={(checked) => {
                        const newSelection = new Set(selectedProviderIds);
                        if (checked) {
                          newSelection.add(provider.id);
                        } else {
                          newSelection.delete(provider.id);
                        }
                        setSelectedProviderIds(newSelection);
                      }}
                    />
                    <Label htmlFor={`modal-provider-${provider.id}`} className="text-sm cursor-pointer flex-1">
                      {provider.name}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({provider.specialty || 'General'})
                      </span>
                    </Label>
                  </div>
                ))}
            </div>
            <div className="flex gap-2 border-t pt-3">
              <Button variant="outline" size="sm"
                onClick={() => setSelectedProviderIds(new Set(providers.filter((p: any) => p.is_active !== false).slice(0, 2).map((p: any) => p.id)))}>
                2 Providers
              </Button>
              <Button variant="outline" size="sm"
                onClick={() => setSelectedProviderIds(new Set(providers.filter((p: any) => p.is_active !== false).slice(0, 4).map((p: any) => p.id)))}>
                4 Providers
              </Button>
              <Button size="sm" className="ml-auto" onClick={saveProviderSelection}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAppointmentDetails} onOpenChange={setShowAppointmentDetails}>
        <DialogContent className="max-w-md" aria-describedby="appointment-details">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          <p id="appointment-details" className="sr-only">
            Detailed information about the selected appointment
          </p>
          {selectedAppointment && (
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  {selectedAppointment.patientName}
                </h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Visit Type</p>
                    <p className="text-muted-foreground">{selectedAppointment.type}</p>
                    {selectedAppointment.procedureName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Procedure: {selectedAppointment.procedureName}
                        {selectedAppointment.procedureCode && (
                          <span className="ml-1 opacity-70">({selectedAppointment.procedureCode})</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Time</p>
                    <p className="text-muted-foreground">{selectedAppointment.time} ({selectedAppointment.duration} minutes)</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Provider</p>
                    <p className="text-muted-foreground">{selectedAppointment.provider}</p>
                  </div>
                </div>
                {selectedAppointment.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Phone</p>
                      <p className="text-muted-foreground">{selectedAppointment.phone}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Source</p>
                    <Badge 
                      variant={selectedAppointment.source === 'nexhealth' ? 'default' : 'secondary'}
                    >
                      {selectedAppointment.source === 'nexhealth' ? 'NexHealth' : 'Platform'}
                    </Badge>
                  </div>
                </div>
                {selectedAppointment.status === 'checked-in' && (selectedAppointment as any).checkedInAt && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-teal-600 dark:text-teal-400">Checked In</p>
                      <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                        {format(new Date((selectedAppointment as any).checkedInAt), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                )}
                {selectedAppointment.status === 'completed' && (selectedAppointment as any).checkedOutAt && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-600 dark:text-green-400">Completed</p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Checked out at {format(new Date((selectedAppointment as any).checkedOutAt), 'h:mm a')}
                      </p>
                      {(selectedAppointment as any).checkedInAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Checked in at {format(new Date((selectedAppointment as any).checkedInAt), 'h:mm a')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    if (selectedAppointment) {
                      handleCheckInOut(selectedAppointment.id, selectedAppointment.status || 'scheduled');
                      setShowAppointmentDetails(false);
                    }
                  }}
                  disabled={updateAppointmentMutation.isPending || selectedAppointment?.status === 'completed'}
                  variant={selectedAppointment?.status === 'checked-in' ? 'default' : 'default'}
                >
                  {updateAppointmentMutation.isPending 
                    ? (selectedAppointment?.status === 'checked-in' ? 'Checking out...' : 'Checking in...')
                    : selectedAppointment?.status === 'completed'
                    ? 'Completed'
                    : (selectedAppointment?.status === 'checked-in' ? 'Check Out' : 'Check In')
                  }
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setShowAppointmentDetails(false);
                    setShowRescheduleDialog(true);
                  }}
                >
                  Reschedule
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <RescheduleDialog
        open={showRescheduleDialog}
        onOpenChange={setShowRescheduleDialog}
        appointment={selectedAppointment ? {
          id: selectedAppointment.id,
          provider: selectedAppointment.provider,
          patientName: selectedAppointment.patientName,
          time: selectedAppointment.time,
          date: selectedDateStr,
        } : null}
        onSuccess={() => {
          refetchAppointments();
          setSelectedAppointment(null);
        }}
      />

      {/* Add Appointment Dialog */}
      <AddAppointmentDialog
        open={showAddAppointmentDialog}
        onOpenChange={setShowAddAppointmentDialog}
        onSuccess={() => {
          refetchAppointments();
        }}
      />
    </div>
  );
}
