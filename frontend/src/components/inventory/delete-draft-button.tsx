'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDeleteInventory } from '@/hooks/use-api';
import { toast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/format';

/** Discards a draft inventory. Certified inventories are permanent and never show this. */
export function DeleteDraftButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteInventory();
  const router = useRouter();

  const confirm = async () => {
    try {
      await remove.mutateAsync(id);
      toast({ title: 'Draft deleted', description: 'Its bills stay in your account and can be used in another inventory.' });
      router.push('/inventories');
    } catch (error) {
      toast({ title: 'Could not delete the draft', description: errorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} className="w-full text-muted-foreground hover:text-red-600 sm:w-auto">
        <Trash2 className="mr-2 h-4 w-4" />
        Delete draft
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this draft inventory?</DialogTitle>
            <DialogDescription>
              The inventory and its audits are removed. The bills you uploaded and their AI readings stay in your account, and their Hedera records remain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
