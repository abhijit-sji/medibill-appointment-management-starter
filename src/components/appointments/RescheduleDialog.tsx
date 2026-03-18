/**
 * Reschedule Dialog Component
 * Allows rescheduling an appointment to a new date and time
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useUpdateAppointment } from '@/hooks/useData';
import { getAvailableSlots } from '@/services/appointments.service';
import { getAllProviders, getProviderById } from '@/services/providers.service';
import { cn } from '@/lib/utils';

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    provider: string;
    patientName: string;
    time: string;
    date?: string;
  } | null;
  onSuccess?: () => void;
}

export function RescheduleDialog({ open, onOpenChange, appointment, onSuccess }: RescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<Array<{ start_time: string; end_time: string; is_available: boolean }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const updateAppointmentMutation = useUpdateAppointment();

  // Helper function to check if provider has any configured hours
  function providerHasAnyHoursConfigured(p: any): boolean {
    const wh = p?.working_hours;
    if (!wh || typeof wh !== 'object') return false;
    return Object.values(wh).some((d: any) => d?.enabled === true && d?.start && d?.end);
  }

  // Load providers
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const data = await getAllProviders();
        setProviders(data);
        // Find provider by name and set as default
        if (appointment?.provider && data.length > 0) {
          const provider = data.find(p => p.name === appointment.provider);
          if (provider) {
            setSelectedProviderId(provider.id);
          } else {
            setSelectedProviderId(data[0].id);
          }
        } else if (data.length > 0) {
          setSelectedProviderId(data[0].id);
        }
      } catch (error) {
        console.error('Error loading providers:', error);
      }
    };
    if (open) {
      loadProviders();
    }
  }, [open, appointment]);

  // Load provider details when provider changes
  useEffect(() => {
    const loadProvider = async () => {
      if (selectedProviderId) {
        try {
          const provider = await getProviderById(selectedProviderId);
          setSelectedProvider(provider);
          // Reset selected time when provider changes
          setSelectedTime('');
        } catch (error) {
          console.error('Error loading provider:', error);
        }
      }
    };
    loadProvider();
  }, [selectedProviderId]);

  // Load available slots when date or provider changes
  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedDate || !selectedProviderId) {
        setAvailableSlots([]);
        return;
      }

      setLoadingSlots(true);
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        // Use provider's slot_duration if available, otherwise default to 30
        const slotDuration = selectedProvider?.slot_duration || 30;
        // Exclude current appointment when rescheduling
        const slots = await getAvailableSlots(selectedProviderId, dateStr, slotDuration, appointment?.id);
        setAvailableSlots(slots);
      } catch (error: any) {
        console.error('Error loading available slots:', error);
        toast.error(error?.message || 'Failed to load available time slots');
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [selectedDate, selectedProviderId, selectedProvider]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && appointment) {
      if (appointment.date) {
        setSelectedDate(new Date(appointment.date));
      } else {
        setSelectedDate(new Date());
      }
      setSelectedTime('');
    } else if (!open) {
      setSelectedDate(undefined);
      setSelectedTime('');
      setAvailableSlots([]);
    }
  }, [open, appointment]);

  // Helper function to add minutes to a time string (HH:MM format)
  const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + minutesToAdd;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  // Function to check if a date should be disabled (provider not available)
  const isDateDisabled = (date: Date): boolean => {
    if (!selectedProvider?.working_hours) return true; // Disable if no working hours
    
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
    const workingHours = selectedProvider.working_hours as Record<string, any>;
    const dayHours = workingHours[dayOfWeek];
    
    // Disable if day is not explicitly enabled with start/end times
    return !(dayHours?.enabled === true && dayHours?.start && dayHours?.end);
  };

  const handleReschedule = async () => {
    if (!appointment || !selectedDate || !selectedTime || !selectedProviderId) {
      toast.error('Please select a date, time, and provider');
      return;
    }

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      // Use provider's slot_duration instead of hardcoded 30
      const slotDuration = selectedProvider?.slot_duration || 30;
      
      // Extract time from selectedTime (may include seconds)
      const timeStr = selectedTime.length >= 5 ? selectedTime.substring(0, 5) : selectedTime;
      const endTimeStr = addMinutesToTime(timeStr, slotDuration);
      const endTime = `${endTimeStr}:00`;

      await updateAppointmentMutation.mutateAsync({
        appointmentId: appointment.id,
        updates: {
          appointment_date: dateStr,
          start_time: `${timeStr}:00`,
          end_time: endTime,
          duration: slotDuration,
        }
      });

      toast.success('Appointment rescheduled successfully');
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error rescheduling appointment:', error);
      toast.error(error?.message || 'Failed to reschedule appointment');
    }
  };

  const availableTimeSlots = availableSlots.filter(slot => slot.is_available);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
          <DialogDescription>
            Reschedule appointment for {appointment?.patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => {
                  const hasHours = providerHasAnyHoursConfigured(provider);
                  return (
                    <SelectItem 
                      key={provider.id} 
                      value={provider.id}
                      disabled={!hasHours}
                    >
                      {provider.name} {provider.specialty ? `- ${provider.specialty}` : ''}
                      {!hasHours && ' (needs hours)'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      // Reset time when date changes
                      setSelectedTime('');
                      setSelectedDate(date);
                    }
                  }}
                  disabled={(date) => {
                    // Disable past dates
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (date < today) return true;
                    // Disable dates where provider is not available
                    if (selectedProviderId) {
                      return isDateDisabled(date);
                    }
                    return false;
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label>Time</Label>
            {loadingSlots ? (
              <div className="text-sm text-muted-foreground">Loading available times...</div>
            ) : availableTimeSlots.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {selectedDate 
                  ? `No available time slots for ${format(selectedDate, 'MMMM d, yyyy')}. The provider may not be working this day or all slots are booked.`
                  : 'Please select a date first'}
              </div>
            ) : (
              <Select value={selectedTime} onValueChange={(value) => {
                setSelectedTime(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time">
                    {selectedTime ? (selectedTime.length >= 5 ? selectedTime.substring(0, 5) : selectedTime) : 'Select time'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {availableTimeSlots.map((slot) => {
                    const timeValue = slot.start_time;
                    const timeDisplay = timeValue.length >= 5 ? timeValue.substring(0, 5) : timeValue;
                    return (
                      <SelectItem key={timeValue} value={timeValue}>
                        {timeDisplay}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={!selectedDate || !selectedTime || !selectedProviderId || updateAppointmentMutation.isPending}
          >
            {updateAppointmentMutation.isPending ? 'Rescheduling...' : 'Reschedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

