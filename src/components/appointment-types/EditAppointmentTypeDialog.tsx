/**
 * Edit Appointment Type Dialog
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useUpdateAppointmentType, type AppointmentType } from '@/hooks/useAppointmentTypes';
import { useInstitutions } from '@/hooks/useInstitutions';
import { useLocationsByInstitution } from '@/hooks/useLocations';
import { useOperatories } from '@/hooks/useOperatories';
import { APPOINTMENT_CATEGORIES } from '@/services/appointment-types.service';
import { Loader2 } from 'lucide-react';

interface EditAppointmentTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentType: AppointmentType | null;
}

export function EditAppointmentTypeDialog({
  open,
  onOpenChange,
  appointmentType,
}: EditAppointmentTypeDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    duration_minutes: 30,
    buffer_before: 0,
    buffer_after: 0,
    default_price: '',
    category: 'general',
    color: '#3B82F6',
    is_bookable_online: true,
    is_active: true,
    requires_deposit: false,
    deposit_amount: '',
    max_per_day: '',
    min_notice_hours: 24,
    max_advance_days: 90,
    institution_id: '',
    location_id: '',
    operatory_id: '',
  });

  const updateMutation = useUpdateAppointmentType();
  const { data: institutions } = useInstitutions();
  const { data: locations } = useLocationsByInstitution(
    formData.institution_id ? parseInt(formData.institution_id) : undefined
  );
  const { data: operatories } = useOperatories();

  useEffect(() => {
    if (appointmentType) {
      setFormData({
        name: appointmentType.name || '',
        code: appointmentType.code || '',
        description: appointmentType.description || '',
        duration_minutes: appointmentType.duration_minutes || 30,
        buffer_before: appointmentType.buffer_before || 0,
        buffer_after: appointmentType.buffer_after || 0,
        default_price: appointmentType.default_price?.toString() || '',
        category: appointmentType.category || 'general',
        color: appointmentType.color || '#3B82F6',
        is_bookable_online: appointmentType.is_bookable_online ?? true,
        is_active: appointmentType.is_active ?? true,
        requires_deposit: appointmentType.requires_deposit ?? false,
        deposit_amount: appointmentType.deposit_amount?.toString() || '',
        max_per_day: appointmentType.max_per_day?.toString() || '',
        min_notice_hours: appointmentType.min_notice_hours || 24,
        max_advance_days: appointmentType.max_advance_days || 90,
        institution_id: appointmentType.institution_id?.toString() || '',
        location_id: appointmentType.location_id?.toString() || '',
        operatory_id: appointmentType.operatory_id?.toString() || '',
      });
    }
  }, [appointmentType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appointmentType) return;

    await updateMutation.mutateAsync({
      id: appointmentType.id,
      data: {
        name: formData.name,
        code: formData.code || null,
        description: formData.description || null,
        duration_minutes: formData.duration_minutes,
        buffer_before: formData.buffer_before,
        buffer_after: formData.buffer_after,
        default_price: formData.default_price ? parseFloat(formData.default_price) : null,
        category: formData.category,
        color: formData.color,
        is_bookable_online: formData.is_bookable_online,
        is_active: formData.is_active,
        requires_deposit: formData.requires_deposit,
        deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : null,
        max_per_day: formData.max_per_day ? parseInt(formData.max_per_day) : null,
        min_notice_hours: formData.min_notice_hours,
        max_advance_days: formData.max_advance_days,
        institution_id: formData.institution_id ? parseInt(formData.institution_id) : null,
        location_id: formData.location_id ? parseInt(formData.location_id) : null,
        operatory_id: formData.operatory_id ? parseInt(formData.operatory_id) : null,
      },
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Appointment Type</DialogTitle>
          <DialogDescription>
            Update appointment type details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Regular Checkup"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                }
                placeholder="e.g., CHECKUP"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this appointment type"
              rows={2}
            />
          </div>

          {/* Duration & Category */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes) *</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                max={480}
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, duration_minutes: parseInt(e.target.value) || 30 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Buffer Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buffer_before">Buffer Before (min)</Label>
              <Input
                id="buffer_before"
                type="number"
                min={0}
                max={60}
                value={formData.buffer_before}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, buffer_before: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buffer_after">Buffer After (min)</Label>
              <Input
                id="buffer_after"
                type="number"
                min={0}
                max={60}
                value={formData.buffer_after}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, buffer_after: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default_price">Default Price ($)</Label>
              <Input
                id="default_price"
                type="number"
                min={0}
                step={0.01}
                value={formData.default_price}
                onChange={(e) => setFormData((prev) => ({ ...prev, default_price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_per_day">Max Per Day (per provider)</Label>
              <Input
                id="max_per_day"
                type="number"
                min={1}
                value={formData.max_per_day}
                onChange={(e) => setFormData((prev) => ({ ...prev, max_per_day: e.target.value }))}
                placeholder="Unlimited"
              />
            </div>
          </div>

          {/* Booking Constraints */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_notice">Min Notice (hours)</Label>
              <Input
                id="min_notice"
                type="number"
                min={0}
                value={formData.min_notice_hours}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, min_notice_hours: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_advance">Max Advance (days)</Label>
              <Input
                id="max_advance"
                type="number"
                min={1}
                value={formData.max_advance_days}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, max_advance_days: parseInt(e.target.value) || 90 }))
                }
              />
            </div>
          </div>

          {/* Associations */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Institution</Label>
              <Select
                value={formData.institution_id || '__none__'}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, institution_id: value === '__none__' ? '' : value, location_id: '' }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select institution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {institutions?.map((inst) => (
                    <SelectItem key={inst.id} value={String(inst.id)}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={formData.location_id || '__none__'}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, location_id: value === '__none__' ? '' : value }))}
                disabled={!formData.institution_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operatory</Label>
              <Select
                value={formData.operatory_id || '__none__'}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, operatory_id: value === '__none__' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select operatory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {operatories?.map((op) => (
                    <SelectItem key={op.id} value={String(op.id)}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">
                  This appointment type can be used for booking
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Bookable Online</Label>
                <p className="text-sm text-muted-foreground">
                  Patients can book this type online
                </p>
              </div>
              <Switch
                checked={formData.is_bookable_online}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_bookable_online: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Requires Deposit</Label>
                <p className="text-sm text-muted-foreground">
                  A deposit is required when booking
                </p>
              </div>
              <Switch
                checked={formData.requires_deposit}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, requires_deposit: checked }))
                }
              />
            </div>
            {formData.requires_deposit && (
              <div className="ml-4 space-y-2">
                <Label htmlFor="deposit_amount">Deposit Amount ($)</Label>
                <Input
                  id="deposit_amount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.deposit_amount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, deposit_amount: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-32"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending || !formData.name}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

