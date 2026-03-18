/**
 * Availabilities Page
 * Manage provider availability schedules
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  Calendar,
  Users,
  AlertTriangle,
  CalendarOff,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  useAvailabilities,
  useAvailabilityStats,
  useCreateAvailability,
  useUpdateAvailability,
  useDeleteAvailability,
  useSetProviderWeeklySchedule,
  useProviderOverrides,
  useCreateOverride,
  useDeleteOverride,
  useSyncAvailabilitiesFromNexHealth,
  type ProviderAvailability,
} from '@/hooks/useAvailabilities';
import { useProviders } from '@/hooks/useProviders';
import { DAYS_OF_WEEK } from '@/services/availabilities.service';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export default function Availabilities() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [selectedAvailability, setSelectedAvailability] = useState<ProviderAvailability | null>(null);
  const [scheduleProvider, setScheduleProvider] = useState<string>('');

  // Form states
  const [addForm, setAddForm] = useState({
    provider_id: '',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
  });

  const [overrideForm, setOverrideForm] = useState({
    provider_id: '',
    override_date: '',
    override_type: 'unavailable' as 'unavailable' | 'modified_hours' | 'additional_hours',
    start_time: '',
    end_time: '',
    reason: '',
  });

  const [weeklySchedule, setWeeklySchedule] = useState<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }[]>(DAYS_OF_WEEK.map((day) => ({
    day_of_week: day.value,
    start_time: '09:00',
    end_time: '17:00',
    is_active: day.value >= 1 && day.value <= 5, // Mon-Fri active by default
  })));

  // Fetch data
  const {
    data: availabilities,
    isLoading,
    refetch,
  } = useAvailabilities(selectedProviderId !== 'all' ? selectedProviderId : undefined);
  const { data: stats } = useAvailabilityStats();
  const { data: providers } = useProviders();
  const { data: overrides } = useProviderOverrides(
    scheduleProvider || undefined,
    new Date().toISOString().split('T')[0]
  );

  const createMutation = useCreateAvailability();
  const deleteMutation = useDeleteAvailability();
  const setScheduleMutation = useSetProviderWeeklySchedule();
  const createOverrideMutation = useCreateOverride();
  const syncMutation = useSyncAvailabilitiesFromNexHealth();

  // Group availabilities by provider
  const groupedAvailabilities = useMemo(() => {
    if (!availabilities) return {};

    const grouped: Record<string, ProviderAvailability[]> = {};
    availabilities.forEach((avail) => {
      const key = avail.provider_id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(avail);
    });

    // Sort each provider's availabilities by day
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => a.day_of_week - b.day_of_week);
    });

    return grouped;
  }, [availabilities]);

  // Filter by search
  const filteredProviderIds = useMemo(() => {
    if (!searchQuery) return Object.keys(groupedAvailabilities);

    const searchLower = searchQuery.toLowerCase();
    return Object.keys(groupedAvailabilities).filter((providerId) => {
      const availabilities = groupedAvailabilities[providerId];
      const providerName = availabilities[0]?.provider_name || '';
      return providerName.toLowerCase().includes(searchLower);
    });
  }, [groupedAvailabilities, searchQuery]);

  const handleAddAvailability = async () => {
    await createMutation.mutateAsync({
      provider_id: addForm.provider_id,
      day_of_week: addForm.day_of_week,
      start_time: addForm.start_time,
      end_time: addForm.end_time,
    });
    setShowAddDialog(false);
    setAddForm({
      provider_id: '',
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
    });
  };

  const handleDelete = (availability: ProviderAvailability) => {
    setSelectedAvailability(availability);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (selectedAvailability) {
      await deleteMutation.mutateAsync(selectedAvailability.id);
      setShowDeleteDialog(false);
      setSelectedAvailability(null);
    }
  };

  const openScheduleSheet = (providerId: string, existingSchedule?: ProviderAvailability[]) => {
    setScheduleProvider(providerId);
    
    // Initialize schedule from existing or default
    if (existingSchedule && existingSchedule.length > 0) {
      const schedule = DAYS_OF_WEEK.map((day) => {
        const existing = existingSchedule.find((a) => a.day_of_week === day.value);
        return {
          day_of_week: day.value,
          start_time: existing?.start_time?.substring(0, 5) || '09:00',
          end_time: existing?.end_time?.substring(0, 5) || '17:00',
          is_active: existing?.is_active ?? false,
        };
      });
      setWeeklySchedule(schedule);
    } else {
      setWeeklySchedule(DAYS_OF_WEEK.map((day) => ({
        day_of_week: day.value,
        start_time: '09:00',
        end_time: '17:00',
        is_active: day.value >= 1 && day.value <= 5,
      })));
    }

    setShowScheduleSheet(true);
  };

  const saveWeeklySchedule = async () => {
    await setScheduleMutation.mutateAsync({
      providerId: scheduleProvider,
      schedule: weeklySchedule,
    });
    setShowScheduleSheet(false);
  };

  const handleAddOverride = async () => {
    await createOverrideMutation.mutateAsync({
      provider_id: overrideForm.provider_id,
      override_date: overrideForm.override_date,
      override_type: overrideForm.override_type,
      start_time: overrideForm.start_time || null,
      end_time: overrideForm.end_time || null,
      reason: overrideForm.reason || null,
    });
    setShowOverrideDialog(false);
    setOverrideForm({
      provider_id: '',
      override_date: '',
      override_type: 'unavailable',
      start_time: '',
      end_time: '',
      reason: '',
    });
  };

  const handleSync = async () => {
    await syncMutation.mutateAsync(undefined);
    setShowSyncDialog(false);
  };

  const getDayName = (dayOfWeek: number) => {
    return DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label || '';
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Availabilities</h1>
          <p className="text-muted-foreground">
            Manage provider availability schedules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowSyncDialog(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync from NexHealth
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setOverrideForm({ ...overrideForm, provider_id: '' });
              setShowOverrideDialog(true);
            }}
          >
            <CalendarOff className="mr-2 h-4 w-4" />
            Add Override
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Availability
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Providers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats?.totalProviders ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                With Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{stats?.providersWithSchedule ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Slots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold">{stats?.totalSlots ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Upcoming Overrides
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold">{stats?.upcomingOverrides ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Provider Schedules</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search providers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {providers?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredProviderIds.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No availabilities found</h3>
              <p className="text-muted-foreground mb-4">
                Set up provider schedules to enable booking
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Availability
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProviderIds.map((providerId) => {
                const providerAvailabilities = groupedAvailabilities[providerId];
                const providerName = providerAvailabilities[0]?.provider_name || 'Unknown Provider';

                return (
                  <Card key={providerId} className="overflow-hidden">
                    <div className="flex items-center justify-between p-4 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{providerName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {providerAvailabilities.length} day(s) available
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openScheduleSheet(providerId, providerAvailabilities)
                          }
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Schedule
                        </Button>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day) => {
                          const dayAvail = providerAvailabilities.find(
                            (a) => a.day_of_week === day.value
                          );
                          return (
                            <div
                              key={day.value}
                              className={`px-3 py-2 rounded-lg text-sm ${
                                dayAvail?.is_active
                                  ? 'bg-green-50 border border-green-200 text-green-700'
                                  : 'bg-gray-50 border border-gray-200 text-gray-400'
                              }`}
                            >
                              <div className="font-medium">{day.short}</div>
                              {dayAvail?.is_active ? (
                                <div className="text-xs">
                                  {formatTime(dayAvail.start_time)} -{' '}
                                  {formatTime(dayAvail.end_time)}
                                </div>
                              ) : (
                                <div className="text-xs">Off</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Availability Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Availability</DialogTitle>
            <DialogDescription>
              Add a single availability slot for a provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={addForm.provider_id}
                onValueChange={(value) =>
                  setAddForm((prev) => ({ ...prev, provider_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select
                value={String(addForm.day_of_week)}
                onValueChange={(value) =>
                  setAddForm((prev) => ({ ...prev, day_of_week: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={String(day.value)}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={addForm.start_time}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, start_time: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={addForm.end_time}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, end_time: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddAvailability}
              disabled={createMutation.isPending || !addForm.provider_id}
            >
              Add Availability
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weekly Schedule Sheet */}
      <Sheet open={showScheduleSheet} onOpenChange={setShowScheduleSheet}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit Weekly Schedule</SheetTitle>
            <SheetDescription>
              Set the weekly working hours for this provider
            </SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-4">
            {weeklySchedule.map((day, index) => (
              <div
                key={day.day_of_week}
                className={`p-3 rounded-lg border ${
                  day.is_active ? 'bg-green-50/50 border-green-200' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-medium">{getDayName(day.day_of_week)}</Label>
                  <Switch
                    checked={day.is_active}
                    onCheckedChange={(checked) => {
                      const newSchedule = [...weeklySchedule];
                      newSchedule[index].is_active = checked;
                      setWeeklySchedule(newSchedule);
                    }}
                  />
                </div>
                {day.is_active && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={day.start_time}
                      onChange={(e) => {
                        const newSchedule = [...weeklySchedule];
                        newSchedule[index].start_time = e.target.value;
                        setWeeklySchedule(newSchedule);
                      }}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={day.end_time}
                      onChange={(e) => {
                        const newSchedule = [...weeklySchedule];
                        newSchedule[index].end_time = e.target.value;
                        setWeeklySchedule(newSchedule);
                      }}
                      className="flex-1"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowScheduleSheet(false)}>
              Cancel
            </Button>
            <Button onClick={saveWeeklySchedule} disabled={setScheduleMutation.isPending}>
              Save Schedule
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Override Dialog */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Schedule Override</DialogTitle>
            <DialogDescription>
              Add an exception to the regular schedule (e.g., day off, modified hours)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={overrideForm.provider_id}
                onValueChange={(value) =>
                  setOverrideForm((prev) => ({ ...prev, provider_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={overrideForm.override_date}
                onChange={(e) =>
                  setOverrideForm((prev) => ({ ...prev, override_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Override Type</Label>
              <Select
                value={overrideForm.override_type}
                onValueChange={(value: any) =>
                  setOverrideForm((prev) => ({ ...prev, override_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unavailable">Unavailable (Day Off)</SelectItem>
                  <SelectItem value="modified_hours">Modified Hours</SelectItem>
                  <SelectItem value="additional_hours">Additional Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {overrideForm.override_type !== 'unavailable' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={overrideForm.start_time}
                    onChange={(e) =>
                      setOverrideForm((prev) => ({ ...prev, start_time: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={overrideForm.end_time}
                    onChange={(e) =>
                      setOverrideForm((prev) => ({ ...prev, end_time: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={overrideForm.reason}
                onChange={(e) =>
                  setOverrideForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="e.g., Vacation, Conference, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddOverride}
              disabled={
                createOverrideMutation.isPending ||
                !overrideForm.provider_id ||
                !overrideForm.override_date
              }
            >
              Add Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Availability</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this availability? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sync Dialog */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync from NexHealth</DialogTitle>
            <DialogDescription>
              This will fetch provider availabilities from NexHealth and sync them to your
              local database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSync} disabled={syncMutation.isPending}>
              {syncMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Start Sync
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


