/**
 * Edit Operatory Dialog
 * Dialog form for editing existing operatories
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
import { Loader2, MapPin } from 'lucide-react';
import { updateOperatory, OPERATORY_TYPES, type Operatory, type OperatoryUpdate } from '@/services/operatories.service';
import { getInstitutionLocations, type InstitutionLocation } from '@/services/institutions.service';

interface EditOperatoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatory: Operatory | null;
}

export function EditOperatoryDialog({ open, onOpenChange, operatory }: EditOperatoryDialogProps) {
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState<OperatoryUpdate>({});

  // Fetch locations for the operatory's institution
  const { data: locations } = useQuery({
    queryKey: ['institution-locations', operatory?.institution_id],
    queryFn: () => getInstitutionLocations(operatory!.institution_id),
    enabled: !!operatory?.institution_id,
  });

  // Populate form when operatory changes
  useEffect(() => {
    if (operatory) {
      setFormData({
        name: operatory.name,
        description: operatory.description || '',
        foreign_id: operatory.foreign_id || '',
        location_id: operatory.location_id || undefined,
        is_active: operatory.is_active,
        is_bookable: operatory.is_bookable,
        operatory_type: operatory.operatory_type,
        capacity: operatory.capacity,
      });
    }
  }, [operatory]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: OperatoryUpdate }) =>
      updateOperatory(id, updates),
    onSuccess: () => {
      toast.success('Operatory updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['operatories'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update operatory');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      toast.error('Operatory name is required');
      return;
    }
    
    if (!operatory) return;

    updateMutation.mutate({ id: operatory.id, updates: formData });
  };

  if (!operatory) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Edit Operatory
            </DialogTitle>
            <DialogDescription>
              Update the operatory details.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Location Selection */}
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Select
                value={formData.location_id?.toString() || '__none__'}
                onValueChange={(value) => setFormData({ ...formData, location_id: value === '__none__' ? undefined : parseInt(value) })}
                disabled={!locations?.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder={locations?.length ? 'Select location' : 'No locations available'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No specific location</SelectItem>
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
                value={formData.name || ''}
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
                  value={formData.operatory_type || 'general'}
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
                  value={formData.capacity || 1}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            {/* Foreign ID */}
            <div className="grid gap-2">
              <Label htmlFor="foreign_id">EMR ID</Label>
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
                  checked={formData.is_active ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_bookable"
                  checked={formData.is_bookable ?? true}
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
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

