/**
 * Add Operatory Dialog
 * Dialog form for creating new operatories
 * Medibill Voice Sync Health
 */

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, MapPin, Plus } from 'lucide-react';
import { createOperatory, OPERATORY_TYPES, type OperatoryInsert } from '@/services/operatories.service';
import { getAllInstitutions, getInstitutionLocations, type Institution, type InstitutionLocation } from '@/services/institutions.service';
import { AddLocationDialog } from '@/components/institutions/AddLocationDialog';

interface AddOperatoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultInstitutionId?: number;
}

export function AddOperatoryDialog({ open, onOpenChange, defaultInstitutionId }: AddOperatoryDialogProps) {
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState<OperatoryInsert>({
    institution_id: defaultInstitutionId || 0,
    location_id: undefined,
    name: '',
    description: '',
    foreign_id: '',
    is_active: true,
    is_bookable: true,
    operatory_type: 'general',
    capacity: 1,
  });

  // State for Add Location dialog
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false);

  // Fetch institutions
  const { data: institutions } = useQuery({
    queryKey: ['institutions'],
    queryFn: getAllInstitutions,
  });

  // Fetch locations for selected institution
  const { data: locations } = useQuery({
    queryKey: ['institution-locations', formData.institution_id],
    queryFn: () => getInstitutionLocations(formData.institution_id),
    enabled: formData.institution_id > 0,
  });

  // Reset location when institution changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, location_id: undefined }));
  }, [formData.institution_id]);

  // Set default institution when prop changes
  useEffect(() => {
    if (defaultInstitutionId) {
      setFormData(prev => ({ ...prev, institution_id: defaultInstitutionId }));
    }
  }, [defaultInstitutionId]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createOperatory,
    onSuccess: () => {
      toast.success('Operatory created successfully!');
      queryClient.invalidateQueries({ queryKey: ['operatories'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create operatory');
    },
  });

  const resetForm = () => {
    setFormData({
      institution_id: defaultInstitutionId || 0,
      location_id: undefined,
      name: '',
      description: '',
      foreign_id: '',
      is_active: true,
      is_bookable: true,
      operatory_type: 'general',
      capacity: 1,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Operatory name is required');
      return;
    }
    
    if (!formData.institution_id) {
      toast.error('Please select an institution');
      return;
    }

    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Add New Operatory
            </DialogTitle>
            <DialogDescription>
              Create a new operatory (room/chair) for appointment booking.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Institution Selection */}
            <div className="grid gap-2">
              <Label htmlFor="institution">Institution *</Label>
              <Select
                value={formData.institution_id?.toString() || ''}
                onValueChange={(value) => setFormData({ ...formData, institution_id: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select institution" />
                </SelectTrigger>
                <SelectContent>
                  {institutions?.map((inst: Institution) => (
                    <SelectItem key={inst.id} value={inst.id.toString()}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Selection */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="location">Location</Label>
                {formData.institution_id > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setShowAddLocationDialog(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Location
                  </Button>
                )}
              </div>
              <Select
                value={formData.location_id?.toString() || ''}
                onValueChange={(value) => setFormData({ ...formData, location_id: value ? parseInt(value) : undefined })}
                disabled={!formData.institution_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={locations?.length ? 'Select location' : 'No locations - Add one first'} />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((loc: InstitutionLocation) => (
                    <SelectItem key={loc.id} value={loc.id.toString()}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Room 1, Chair A, Hygiene Bay 2"
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            {/* Type and Capacity */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.operatory_type}
                  onValueChange={(value) => setFormData({ ...formData, operatory_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            {/* Foreign ID */}
            <div className="grid gap-2">
              <Label htmlFor="foreign_id">EMR ID (Optional)</Label>
              <Input
                id="foreign_id"
                value={formData.foreign_id || ''}
                onChange={(e) => setFormData({ ...formData, foreign_id: e.target.value })}
                placeholder="External system ID"
              />
            </div>

            {/* Switches */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_bookable"
                  checked={formData.is_bookable}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_bookable: checked })}
                />
                <Label htmlFor="is_bookable" className="cursor-pointer">Bookable</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Operatory
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Add Location Dialog */}
      <AddLocationDialog
        open={showAddLocationDialog}
        onOpenChange={setShowAddLocationDialog}
        defaultInstitutionId={formData.institution_id}
        onLocationCreated={(locationId) => {
          // Refresh locations and select the new one
          queryClient.invalidateQueries({ queryKey: ['institution-locations', formData.institution_id] });
          setFormData((prev) => ({ ...prev, location_id: locationId }));
        }}
      />
    </Dialog>
  );
}

