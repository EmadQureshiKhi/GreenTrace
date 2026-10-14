'use client';

import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { Building, Edit, Loader2, LogIn, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HcsTransactionDisplay } from '@/components/ui/hcs-transaction-display';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useSema } from './sema-context';
import { isDemoClient } from './sema-demo-data';
import { ConfirmDialog, EmptyState } from './sema-shared';
import { runWithToast } from './sema-utils';
import type { ClientInput, SemaClient } from './sema-types';
import { formatDate } from '@/lib/format';

interface SemaAdminPanelProps {
  isOpenClientForm: boolean;
  setIsOpenClientForm: Dispatch<SetStateAction<boolean>>;
}

const SIZES = [
  { value: 'Small', label: 'Small (1-50 employees)' },
  { value: 'Medium', label: 'Medium (51-250 employees)' },
  { value: 'Large', label: 'Large (251-1000 employees)' },
  { value: 'Enterprise', label: 'Enterprise (1000+ employees)' },
];

const EMPTY_FORM: ClientInput = { name: '', description: '', industry: '', size: 'Medium', status: 'active' };

export default function SemaAdminPanel({ isOpenClientForm, setIsOpenClientForm }: SemaAdminPanelProps) {
  const { clients, activeClient, setActiveClient, addClient, updateClient, deleteClient, latestClientHcsTx } = useSema();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [editingClient, setEditingClient] = useState<SemaClient | null>(null);
  const [deleting, setDeleting] = useState<SemaClient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ClientInput>(EMPTY_FORM);

  const ownClients = clients.filter((c) => !isDemoClient(c));

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingClient(null);
    setIsOpenClientForm(false);
  };

  const handleEdit = (client: SemaClient) => {
    setFormData({
      name: client.name,
      description: client.description ?? '',
      industry: client.industry ?? '',
      size: client.size ?? 'Medium',
      status: client.status === 'inactive' ? 'inactive' : 'active',
    });
    setEditingClient(client);
    setIsOpenClientForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const ok = editingClient
      ? await runWithToast(() => updateClient(editingClient.id, formData), { title: 'Organization updated', description: formData.name })
      : await runWithToast(() => addClient(formData), { title: 'Organization added', description: `${formData.name} is now selected.` });
    setIsSaving(false);
    if (ok) resetForm();
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <EmptyState
          icon={Building}
          title="Sign in to manage organizations"
          action={
            <Button onClick={openAuthModal}>
              <LogIn className="mr-2 h-4 w-4" /> Sign in
            </Button>
          }
        >
          Your organizations and their assessments are private to your account. The demo organization stays available without signing in.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {isOpenClientForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingClient ? 'Edit organization' : 'Add organization'}</CardTitle>
            <CardDescription>The organization whose stakeholders and material topics you assess</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client-name">Organization name</Label>
                  <Input
                    id="client-name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Acme Manufacturing Ltd"
                    required
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-industry">Industry</Label>
                  <Input
                    id="client-industry"
                    value={formData.industry}
                    onChange={(e) => setFormData((prev) => ({ ...prev, industry: e.target.value }))}
                    placeholder="e.g. Manufacturing"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-size">Size</Label>
                  <Select value={formData.size} onValueChange={(value) => setFormData((prev) => ({ ...prev, size: value }))}>
                    <SelectTrigger id="client-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'active' | 'inactive') => setFormData((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger id="client-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-description">Description</Label>
                <Input
                  id="client-description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="What the organization does, sites, scope of the assessment"
                  maxLength={500}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isSaving || !formData.name.trim()}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingClient ? 'Save changes' : 'Add organization'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Your organizations</CardTitle>
              <CardDescription>Each organization has its own stakeholders, topics and reports</CardDescription>
            </div>
            {!isOpenClientForm && (
              <Button onClick={() => setIsOpenClientForm(true)} className="self-start sm:self-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add organization
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {ownClients.length === 0 ? (
            <EmptyState icon={Building} title="No organizations yet">
              Add the first organization you want to assess. Until then you can explore the demo organization.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {ownClients.map((client) => (
                <div key={client.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="break-words font-medium">{client.name}</h4>
                      <Badge variant={client.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                        {client.status}
                      </Badge>
                      {activeClient?.id === client.id && <Badge variant="outline">Selected</Badge>}
                    </div>
                    {client.description && <p className="text-sm text-muted-foreground">{client.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {client.industry && <span>Industry: {client.industry}</span>}
                      {client.size && <span>Size: {client.size}</span>}
                      <span>Created {formatDate(client.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {activeClient?.id !== client.id && (
                      <Button variant="outline" size="sm" onClick={() => setActiveClient(client)}>
                        Select
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${client.name}`} onClick={() => handleEdit(client)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete ${client.name}`} onClick={() => setDeleting(client)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <HcsTransactionDisplay
        transaction={latestClientHcsTx}
        title="Organization audit log"
        description="Latest organization change logged to Hedera Consensus Service"
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'organization'}?`}
        description="This permanently deletes the organization with its stakeholders, topics, responses, reports and GRI drafts."
        onConfirm={async () => {
          if (deleting) await deleteClient(deleting.id);
        }}
      />
    </div>
  );
}
