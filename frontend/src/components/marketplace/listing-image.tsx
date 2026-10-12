'use client';

import { Leaf } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Remote project photo with a branded fallback block when there is no image or it fails to load. */
export function ListingImage({ src, alt, label, className }: { src: string | null; alt: string; label?: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn('flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-green-600 to-emerald-700 text-white', className)}
      >
        <Leaf className="h-8 w-8 opacity-90" />
        {label && <span className="px-4 text-center text-xs font-semibold tracking-wide text-green-50">{label}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={cn('h-full w-full bg-muted object-cover', className)}
    />
  );
}
