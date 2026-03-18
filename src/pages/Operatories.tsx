/**
 * Operatories Management Page
 * Admin portal to view, create, edit, and delete operatories
 * Superadmin can manage operatories across all institutions
 * Medibill Voice Sync Health
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  Loader2,
  Search,
  Building2,
  CheckCircle2,
  XCircle,
  Calendar,
  Filter,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import {
  getAllOperatories,
  deleteOperatory,
  getOperatoryStats,
  OPERATORY_TYPES,
  type OperatoryWithRelations,
} from '@/services/operatories.service';
import { getAllInstitutions, getInstitutionLocations, type Institution } from '@/services/institutions.service';
import { syncNexHealthOperatories } from '@/services/nexhealth-operatories.service';
import { AddOperatoryDialog } from '@/components/operatories/AddOperatoryDialog';
import { EditOperatoryDialog } from '@/components/operatories/EditOperatoryDialog';

export default function Operatories() {
  const queryClient = useQueryClient();
  const { isSuperAdmin, isAdmin } = useAuth();
  const canManage = isSuperAdmin || isAdmin;

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterInstitution, setFilterInstitution] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOperatory, setSelectedOperatory] = useState<OperatoryWithRelations | null>(null);
  const [operatoryToDelete, setOperatoryToDelete] = useState<OperatoryWithRelations | null>(null);
  const [syncInstitutionId, setSyncInstitutionId] = useState<string>('');
  const [syncLocationId, setSyncLocationId] = useState<string>('');
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  // Fetch all operatories
  const {
    data: operatories,
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ['operatories'],
    queryFn: getAllOperatories,
  });

  // Fetch institutions for filter
  const { data: institutions } = useQuery({
    queryKey: ['institutions'],
    queryFn: getAllInstitutions,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['operatories', 'stats'],
    queryFn: getOperatoryStats,
  });

  // Fetch locations for selected sync institution
  const { data: syncLocations } = useQuery({
    queryKey: ['institution-locations', syncInstitutionId],
    queryFn: () => getInstitutionLocations(parseInt(syncInstitutionId)),
    enabled: !!syncInstitutionId,
  });

  // NexHealth Sync mutation
  const syncMutation = useMutation({
    mutationFn: () => {
      if (!syncLocationId || !syncInstitutionId) {
        throw new Error('Please select an institution and location');
      }
      return syncNexHealthOperatories(parseInt(syncLocationId), parseInt(syncInstitutionId));
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || `Synced ${result.synced} operatories from NexHealth`);
        queryClient.invalidateQueries({ queryKey: ['operatories'] });
        setShowSyncDialog(false);
        setSyncInstitutionId('');
        setSyncLocationId('');
      } else {
        toast.error(result.error || 'Sync failed');
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to sync operatories from NexHealth');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteOperatory,
    onSuccess: () => {
      toast.success('Operatory deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['operatories'] });
      setShowDeleteDialog(false);
      setOperatoryToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to delete operatory');
    },
  });

  // Filter operatories
  const filteredOperatories = operatories?.filter((op) => {
    const matchesSearch =
      searchQuery === '' ||
      op.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.institution_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesInstitution =
      filterInstitution === 'all' || op.institution_id.toString() === filterInstitution;

    const matchesType = filterType === 'all' || op.operatory_type === filterType;

    return matchesSearch && matchesInstitution && matchesType;
  });

  // Handlers
  const handleEdit = (operatory: OperatoryWithRelations) => {
    setSelectedOperatory(operatory);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (operatory: OperatoryWithRelations) => {
    setOperatoryToDelete(operatory);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (operatoryToDelete) {
      deleteMutation.mutate(operatoryToDelete.id);
    }
  };

  const getTypeLabel = (type: string) => {
    const found = OPERATORY_TYPES.find((t) => t.value === type);
    return found?.label || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading operatories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Operatories</h1>
        <Card className="p-6">
          <div className="text-center text-destructive">
            <p className="font-semibold">Error loading operatories</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Operatories
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage rooms and chairs for appointment booking
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button variant="outline" onClick={() => setShowSyncDialog(true)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync from NexHealth
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Operatory
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync NexHealth
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <MapPin className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bookable</p>
                  <p className="text-2xl font-bold">{stats.bookable}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Inactive</p>
                  <p className="text-2xl font-bold">{stats.inactive}</p>
                </div>
                <XCircle className="h-8 w-8 text-gray-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search operatories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterInstitution} onValueChange={setFilterInstitution}>
              <SelectTrigger className="w-[200px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Institution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Institutions</SelectItem>
                {institutions?.map((inst: Institution) => (
                  <SelectItem key={inst.id} value={inst.id.toString()}>
                    {inst.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {OPERATORY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Operatories Table */}
      <Card>
        <CardHeader>
          <CardTitle>Operatories List</CardTitle>
          <CardDescription>
            {filteredOperatories?.length || 0} operatories found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!filteredOperatories || filteredOperatories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No operatories found</p>
              {canManage && (
                <Button variant="outline" className="mt-4" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Operatory
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOperatories.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{op.name}</p>
                          {op.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {op.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{op.institution_name || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{op.location_name || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {getTypeLabel(op.operatory_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{op.capacity}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant={op.is_active ? 'default' : 'secondary'}>
                          {op.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {op.is_bookable && (
                          <Badge variant="outline" className="text-green-600 border-green-600/30">
                            Bookable
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(op)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(op)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <AddOperatoryDialog open={showAddDialog} onOpenChange={setShowAddDialog} />

      {/* Edit Dialog */}
      <EditOperatoryDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        operatory={selectedOperatory}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Operatory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{operatoryToDelete?.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* NexHealth Sync Dialog */}
      <AlertDialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sync Operatories from NexHealth</AlertDialogTitle>
            <AlertDialogDescription>
              Select an institution and location to sync operatories from NexHealth. This will
              import all operatories for the selected location.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Institution</label>
              <Select
                value={syncInstitutionId}
                onValueChange={(value) => {
                  setSyncInstitutionId(value);
                  setSyncLocationId('');
                }}
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Select
                value={syncLocationId}
                onValueChange={setSyncLocationId}
                disabled={!syncInstitutionId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      syncInstitutionId ? 'Select location' : 'Select institution first'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {syncLocations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id.toString()}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSyncInstitutionId('');
                setSyncLocationId('');
              }}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={!syncInstitutionId || !syncLocationId || syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

