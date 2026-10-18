'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Goes back one page in the browser history. */
export function BackButton() {
  return (
    <Button variant="outline" className="w-full" onClick={() => window.history.back()}>
      <ArrowLeft className="h-4 w-4 mr-2" />
      Go Back
    </Button>
  );
}
