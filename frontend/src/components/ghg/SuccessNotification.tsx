'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, Leaf, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatKg, formatTonnes } from '@/lib/format';

interface SuccessNotificationProps {
  isVisible: boolean;
  onClose: () => void;
  emissionAmount: number;
  fuelType: string;
  totalEmissions: number;
  scope: string;
}

const DURATION_MS = 3000;

const SuccessNotification = ({ isVisible, onClose, emissionAmount, fuelType, totalEmissions, scope }: SuccessNotificationProps) => {
  // The parent passes a new onClose on every render; keep the latest without restarting the timer.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => close.current(), DURATION_MS);
    return () => clearTimeout(timer);
  }, [isVisible, emissionAmount, fuelType]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 80, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 80, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed right-4 top-20 z-50 w-[calc(100vw-2rem)] max-w-sm"
          role="status"
        >
          <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl">
            <div className="h-1 bg-muted">
              <motion.div
                key={`${fuelType}-${emissionAmount}`}
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: DURATION_MS / 1000, ease: 'linear' }}
              />
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Entry added</p>
                    <p className="text-xs text-muted-foreground">{scope}</p>
                  </div>
                </div>
                <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/40">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">+{formatKg(emissionAmount)} CO2e</p>
                  <p className="truncate text-xs text-green-700 dark:text-green-300">{fuelType}</p>
                </div>
                <Leaf className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>New total</span>
                <span className="font-medium text-foreground">{formatTonnes(totalEmissions)} CO2e</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuccessNotification;
