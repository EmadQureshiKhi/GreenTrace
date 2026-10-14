'use client';

import { Building, Check, ChevronDown, LogIn, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { useSema } from './sema-context';
import { isDemoClient } from './sema-demo-data';

export function SemaClientSelector() {
  const { clients, activeClient, setActiveClient, setActiveSemaModule, setOpenAdminClientForm } = useSema();
  const { isAuthenticated, openAuthModal } = useAuth();

  const handleAddNewClient = () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    setActiveSemaModule('admin');
    setOpenAdminClientForm(true);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-auto w-full justify-between gap-3 py-2 sm:w-64">
          <span className="flex min-w-0 items-center gap-2">
            <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 text-left">
              <span className="block truncate font-medium">{activeClient?.name ?? 'Loading organizations...'}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {isDemoClient(activeClient) ? 'Demo, sample data' : activeClient?.industry || 'Organization'}
              </span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-2rem))]">
        <DropdownMenuLabel>Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {clients.map((client) => (
          <DropdownMenuItem key={client.id} onClick={() => setActiveClient(client)} className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate font-medium">{client.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[client.industry, client.size].filter(Boolean).join(' / ') || 'No details'}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {isDemoClient(client) && (
                <Badge variant="secondary" className="text-xs">
                  Demo
                </Badge>
              )}
              {client.status === 'inactive' && (
                <Badge variant="outline" className="text-xs">
                  Inactive
                </Badge>
              )}
              {activeClient?.id === client.id && <Check className="h-4 w-4 text-primary" />}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleAddNewClient}>
          {isAuthenticated ? <Plus className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
          {isAuthenticated ? 'Add organization' : 'Sign in to add an organization'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
