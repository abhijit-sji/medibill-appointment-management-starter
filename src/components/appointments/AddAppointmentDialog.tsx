/**
 * Add Appointment Dialog Component
 * Allows creating a new appointment with optional NexHealth integration
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createSystemNotification } from '@/services/system-notifications.service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Clock, Search, User, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useCreateAppointment } from '@/hooks/useData';
import { useAppointmentTypes } from '@/hooks/useAppointmentTypes';
import { getAvailableSlots } from '@/services/appointments.service';
import { getAllProviders, getProviderById } from '@/services/providers.service';
import { searchPatients } from '@/services/patients.service';
import { createAndSyncAppointment, fetchNexHealthAppointmentSlots } from '@/services/nexhealth-appointments.service';
import { mapLocalTypeToNexHealth } from '@/services/nexhealth-appointment-types.service';
import { getPatientNexHealthId, getProviderNexHealthId, validateNexHealthIds } from '@/lib/transformers/nexhealth.appointment';
import { cn } from '@/lib/utils';
import type { NexHealthAppointmentSlot } from '@/lib/schemas/appointment.schema';

interface AddAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddAppointmentDialog({ open, onOpenChange, onSuccess }: AddAppointmentDialogProps) {
  const { clinicId } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [appointmentType, setAppointmentType] = useState<string>('');
  const [selectedAppointmentTypeId, setSelectedAppointmentTypeId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<Array<{ start_time: string; end_time: string; is_available: boolean }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [useNexHealth, setUseNexHealth] = useState(false);
  const [nexhealthSlots, setNexhealthSlots] = useState<NexHealthAppointmentSlot[]>([]);
  const [selectedNexHealthSlot, setSelectedNexHealthSlot] = useState<NexHealthAppointmentSlot | null>(null);
  const [isBookingNexHealth, setIsBookingNexHealth] = useState(false);
  const [nexhealthValidation, setNexhealthValidation] = useState<{ valid: boolean; error?: string }>({ valid: false });
  const createAppointmentMutation = useCreateAppointment();
  
  // Fetch appointment types from database
  const { data: appointmentTypes, isLoading: loadingAppointmentTypes } = useAppointmentTypes({ 
    isActive: true 
  });

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
        
        // Choose first provider with valid configured hours (any day) OR for selected date's day-of-week
        if (data.length > 0) {
          const selectedDateDay = selectedDate 
            ? ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()]
            : null;
          
          // First, try to find provider with hours for selected date's day
          let defaultProvider = selectedDateDay
            ? data.find(p => {
                const wh = p?.working_hours;
                if (!wh || typeof wh !== 'object') return false;
                const dayHours = wh[selectedDateDay];
                return dayHours?.enabled === true && dayHours?.start && dayHours?.end;
              })
            : null;
          
          // If not found, find any provider with configured hours
          if (!defaultProvider) {
            defaultProvider = data.find(p => providerHasAnyHoursConfigured(p));
          }
          
          // Fallback to first provider
          const providerToSelect = defaultProvider || data[0];
          setSelectedProviderId(providerToSelect.id);
          setSelectedProvider(providerToSelect);
        }
      } catch (error) {
        console.error('Error loading providers:', error);
      }
    };
    if (open) {
      loadProviders();
    }
  }, [open, selectedDate]);

  // Load provider details when provider changes
  useEffect(() => {
    const loadProvider = async () => {
      if (selectedProviderId) {
        try {
          const provider = await getProviderById(selectedProviderId);
          setSelectedProvider(provider);
          // Reset selected time when provider changes
          setSelectedTime('');
          setSelectedNexHealthSlot(null);
        } catch (error) {
          console.error('Error loading provider:', error);
        }
      }
    };
    loadProvider();
  }, [selectedProviderId]);

  // Validate NexHealth IDs when patient/provider changes
  useEffect(() => {
    if (useNexHealth && selectedPatientId && selectedProvider) {
      const patient = searchResults.find(p => p.id === selectedPatientId);
      if (patient) {
        const validation = validateNexHealthIds(patient, selectedProvider);
        setNexhealthValidation({ valid: validation.valid, error: validation.error });
      }
    } else {
      setNexhealthValidation({ valid: false });
    }
  }, [useNexHealth, selectedPatientId, selectedProvider, searchResults]);

  // Load available slots when date or provider changes
  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedDate || !selectedProviderId) {
        setAvailableSlots([]);
        setNexhealthSlots([]);
        return;
      }

      setLoadingSlots(true);
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        
        if (useNexHealth && selectedProvider?.foreign_id) {
          // Fetch slots from NexHealth
          const providerNexHealthId = getProviderNexHealthId(selectedProvider);
          if (providerNexHealthId) {
            const slots = await fetchNexHealthAppointmentSlots({
              providerNexHealthId,
              startDate: dateStr,
              days: 1,
            });
            // Filter slots for selected date
            const filteredSlots = slots.filter(slot => slot.time.startsWith(dateStr));
            setNexhealthSlots(filteredSlots);
            setAvailableSlots([]);
          }
        } else {
          // Use local slot generation
          const slotDuration = selectedProvider?.slot_duration || 30;
          const slots = await getAvailableSlots(selectedProviderId, dateStr, slotDuration);
          setAvailableSlots(slots);
          setNexhealthSlots([]);
        }
      } catch (error) {
        console.error('Error loading available slots:', error);
        toast.error('Failed to load available time slots');
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [selectedDate, selectedProviderId, selectedProvider, useNexHealth]);

  // Search patients
  useEffect(() => {
    const search = async () => {
      if (patientSearch.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const results = await searchPatients(patientSearch);
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching patients:', error);
      } finally {
        setSearching(false);
      }
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [patientSearch]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedDate(new Date());
      setSelectedTime('');
      setSelectedPatientId('');
      setPatientSearch('');
      setSearchResults([]);
      setAppointmentType('');
      setSelectedAppointmentTypeId('');
      setNotes('');
      setAvailableSlots([]);
      setNexhealthSlots([]);
      setSelectedNexHealthSlot(null);
      setUseNexHealth(false);
      setNexhealthValidation({ valid: false });
    }
  }, [open]);

  const handleCreate = async () => {
    if (!selectedDate || !selectedProviderId || !selectedPatientId) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check time selection based on booking mode
    if (useNexHealth && !selectedNexHealthSlot) {
      toast.error('Please select a time slot');
      return;
    }
    if (!useNexHealth && !selectedTime) {
      toast.error('Please select a time');
      return;
    }

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // NexHealth booking path
      if (useNexHealth && selectedNexHealthSlot && nexhealthValidation.valid) {
        setIsBookingNexHealth(true);
        
        const patient = searchResults.find(p => p.id === selectedPatientId);
        const patientNexHealthId = getPatientNexHealthId(patient);
        const providerNexHealthId = getProviderNexHealthId(selectedProvider);

        if (!patientNexHealthId || !providerNexHealthId) {
          toast.error('Missing NexHealth IDs');
          setIsBookingNexHealth(false);
          return;
        }

        // Get appointment type ID from NexHealth
        const appointmentTypeId = await mapLocalTypeToNexHealth(appointmentType);
        
        // Extract time from the slot
        const slotTime = new Date(selectedNexHealthSlot.time);
        const startTime = `${String(slotTime.getHours()).padStart(2, '0')}:${String(slotTime.getMinutes()).padStart(2, '0')}`;

        await createAndSyncAppointment({
          patientNexHealthId,
          providerNexHealthId,
          appointmentDate: dateStr,
          startTime,
          operatoryId: selectedNexHealthSlot.operatory_id,
          appointmentTypeId: appointmentTypeId || undefined,
          localPatientId: selectedPatientId,
          localProviderId: selectedProviderId,
          appointmentType,
          notes: notes || undefined,
        });

        toast.success('Appointment booked via NexHealth and synced locally');
        const patientName = patient
          ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown Patient'
          : 'Unknown Patient';
        createSystemNotification({
          title: 'New Appointment Booked',
          message: `${patientName} with ${selectedProvider?.name || 'Unknown Provider'} on ${dateStr} at ${startTime}`,
          type: 'info',
          category: 'appointment',
          link: '/calendar',
          clinic_id: clinicId || undefined,
        }).catch(() => {});
        setIsBookingNexHealth(false);
        onSuccess?.();
        onOpenChange(false);
        return;
      }

      // Local booking path
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const slotDuration = selectedProvider?.slot_duration || 30;
      const endMinutes = minutes + slotDuration;
      const endHours = hours + Math.floor(endMinutes / 60);
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`;

      await createAppointmentMutation.mutateAsync({
        patient_id: selectedPatientId,
        provider_id: selectedProviderId,
        appointment_date: dateStr,
        start_time: `${selectedTime}:00`,
        end_time: endTime,
        duration: slotDuration,
        appointment_type: appointmentType,
        appointment_type_id: selectedAppointmentTypeId || null,
        status: 'scheduled',
        notes: notes || null,
      });

      toast.success('Appointment created successfully');
      const localPatient = searchResults.find(p => p.id === selectedPatientId);
      const localPatientName = localPatient
        ? `${localPatient.first_name || ''} ${localPatient.last_name || ''}`.trim() || 'Unknown Patient'
        : 'Unknown Patient';
      createSystemNotification({
        title: 'New Appointment Booked',
        message: `${localPatientName} with ${selectedProvider?.name || 'Unknown Provider'} on ${dateStr} at ${selectedTime}`,
        type: 'info',
        category: 'appointment',
        link: '/calendar',
        clinic_id: clinicId || undefined,
      }).catch(() => {});
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      toast.error(error?.message || 'Failed to create appointment');
      setIsBookingNexHealth(false);
    }
  };

  const availableTimeSlots = availableSlots.filter(slot => slot.is_available);
  const selectedPatient = searchResults.find(p => p.id === selectedPatientId);

  // Function to check if a date should be disabled (provider not available)
  const isDateDisabled = (date: Date): boolean => {
    if (!selectedProvider?.working_hours) return true; // Disable if no working hours
    
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
    const workingHours = selectedProvider.working_hours as Record<string, any>;
    const dayHours = workingHours[dayOfWeek];
    
    // Disable if day is not explicitly enabled with start/end times
    return !(dayHours?.enabled === true && dayHours?.start && dayHours?.end);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Appointment</DialogTitle>
          <DialogDescription>
            Create a new appointment for a patient
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Patient Search */}
          <div className="space-y-2">
            <Label>Patient *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {selectedPatient && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <User className="h-4 w-4" />
                <span className="text-sm">
                  {selectedPatient.first_name} {selectedPatient.last_name}
                  {selectedPatient.phone && ` • ${selectedPatient.phone}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedPatientId('');
                    setPatientSearch('');
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
            {searching && (
              <div className="text-sm text-muted-foreground">Searching...</div>
            )}
            {!selectedPatient && searchResults.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {searchResults.map((patient) => (
                  <div
                    key={patient.id}
                    className="p-2 hover:bg-muted cursor-pointer"
                    onClick={() => {
                      setSelectedPatientId(patient.id);
                      setPatientSearch(`${patient.first_name} ${patient.last_name}`);
                      setSearchResults([]);
                    }}
                  >
                    <div className="font-medium">
                      {patient.first_name} {patient.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {patient.phone} {patient.email && `• ${patient.email}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <Label>Provider *</Label>
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
            {selectedProvider && !providerHasAnyHoursConfigured(selectedProvider) && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                This provider has no working hours configured. Please configure availability in the Providers page.
              </div>
            )}
          </div>

          {/* NexHealth Integration Toggle */}
          {selectedProvider?.foreign_id && (
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                {useNexHealth ? (
                  <Cloud className="h-4 w-4 text-primary" />
                ) : (
                  <CloudOff className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="nexhealth-toggle" className="cursor-pointer">
                    Book via NexHealth
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Sync appointment to practice EHR
                  </p>
                </div>
              </div>
              <Switch
                id="nexhealth-toggle"
                checked={useNexHealth}
                onCheckedChange={setUseNexHealth}
              />
            </div>
          )}

          {/* NexHealth Validation Warning */}
          {useNexHealth && !nexhealthValidation.valid && nexhealthValidation.error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
              {nexhealthValidation.error}
            </div>
          )}

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Date *</Label>
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
                    setSelectedDate(date);
                    setSelectedTime('');
                    setSelectedNexHealthSlot(null);
                  }}
                  disabled={(date) => {
                    // Disable past dates
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (date < today) return true;
                    // Disable dates where provider is not available (for local booking)
                    if (selectedProviderId && !useNexHealth) {
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
            <Label>Time *</Label>
            {loadingSlots ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading available times...
              </div>
            ) : useNexHealth ? (
              // NexHealth slots
              nexhealthSlots.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {selectedDate 
                    ? 'No available slots from NexHealth for this date'
                    : 'Please select a date first'}
                </div>
              ) : (
                <Select 
                  value={selectedNexHealthSlot?.time || ''} 
                  onValueChange={(value) => {
                    const slot = nexhealthSlots.find(s => s.time === value);
                    setSelectedNexHealthSlot(slot || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {nexhealthSlots.map((slot) => {
                      const slotTime = new Date(slot.time);
                      const timeStr = `${String(slotTime.getHours()).padStart(2, '0')}:${String(slotTime.getMinutes()).padStart(2, '0')}`;
                      return (
                        <SelectItem key={slot.time} value={slot.time}>
                          {timeStr}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )
            ) : (
              // Local slots
              availableTimeSlots.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {selectedDate 
                    ? (selectedProvider && isDateDisabled(selectedDate) 
                        ? 'Provider is not available on this day' 
                        : 'No available time slots for this date (all slots may be booked)')
                    : 'Please select a date first'}
                </div>
              ) : (
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTimeSlots.map((slot) => (
                      <SelectItem key={slot.start_time} value={slot.start_time}>
                        {slot.start_time.substring(0, 5)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            )}
          </div>

          {/* Appointment Type */}
          <div className="space-y-2">
            <Label>Appointment Type</Label>
            <Select
              value={selectedAppointmentTypeId}
              onValueChange={(value) => {
                setSelectedAppointmentTypeId(value);
                // Also set the name for backward compatibility
                const type = appointmentTypes?.find(t => t.id === value);
                if (type) setAppointmentType(type.name);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select appointment type" />
              </SelectTrigger>
              <SelectContent>
                {loadingAppointmentTypes ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : appointmentTypes && appointmentTypes.length > 0 ? (
                  appointmentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} ({type.duration_minutes} min)
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No appointment types available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this appointment..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {useNexHealth && (
            <Badge variant="outline" className="text-primary border-primary">
              <Cloud className="h-3 w-3 mr-1" />
              NexHealth Booking
            </Badge>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !selectedDate || 
                !selectedProviderId || 
                !selectedPatientId || 
                (useNexHealth ? (!selectedNexHealthSlot || !nexhealthValidation.valid) : !selectedTime) ||
                createAppointmentMutation.isPending ||
                isBookingNexHealth
              }
            >
              {isBookingNexHealth ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : createAppointmentMutation.isPending ? (
                'Creating...'
              ) : useNexHealth ? (
                'Book via NexHealth'
              ) : (
                'Create Appointment'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

