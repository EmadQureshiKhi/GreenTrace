import { cn } from '@/lib/utils';

export const LOGO_URL = '/logo.png';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center', className)}>
      <img src={LOGO_URL} alt="" className="-mt-1 h-12 w-16 object-contain" />
      <span className="-ml-3 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
        Green<span className="text-green-800 dark:text-green-500">Trace</span>
      </span>
    </span>
  );
}
