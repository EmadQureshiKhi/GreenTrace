'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/format';
import type { Retirement } from '@/lib/types';
import { requestRetirement } from '@/lib/wallet';
import { useRetire } from './use-api';

// Hooks for the certificates area.

export type RetirementPhase = 'idle' | 'wallet' | 'network' | 'recording' | 'done' | 'error';

interface RetirementState {
  phase: RetirementPhase;
  /** Hash of the on-chain retirement request, once the wallet has sent it and it is mined. */
  txHash: string | null;
  retirement: Retirement | null;
  error: string | null;
  /** The phase that failed, so the UI can mark the right step. */
  failedAt: 'wallet' | 'network' | 'recording' | null;
}

const initial: RetirementState = { phase: 'idle', txHash: null, retirement: null, error: null, failedAt: null };

/**
 * Runs a retirement end to end: the linked wallet calls the exchange contract, then the server verifies
 * the event, burns the credits and logs the retirement. If recording fails after the transaction is mined,
 * `retryRecording` resubmits the same hash; the server is idempotent per hash, so nothing is retired twice.
 */
export function useRetirementFlow() {
  const { mutateAsync: submitRetirement } = useRetire();
  const [state, setState] = useState<RetirementState>(initial);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useCallback((next: Partial<RetirementState>) => {
    if (mounted.current) setState((prev) => ({ ...prev, ...next }));
  }, []);

  const record = useCallback(
    async (txHash: string): Promise<Retirement | null> => {
      update({ phase: 'recording', txHash, error: null, failedAt: null });
      try {
        const retirement = await submitRetirement(txHash);
        update({ phase: 'done', retirement });
        return retirement;
      } catch (error) {
        update({ phase: 'error', error: errorMessage(error), failedAt: 'recording' });
        return null;
      }
    },
    [submitRetirement, update],
  );

  const start = useCallback(
    async (walletAddress: string, tonnes: number, certificateId: string): Promise<Retirement | null> => {
      update({ ...initial, phase: 'wallet' });
      let txHash: string;
      let submitted = false;
      try {
        txHash = await requestRetirement(walletAddress, tonnes, certificateId, {
          onSubmitted: (hash) => {
            submitted = true;
            update({ phase: 'network', txHash: hash });
          },
        });
      } catch (error) {
        update({ phase: 'error', error: errorMessage(error), failedAt: submitted ? 'network' : 'wallet' });
        return null;
      }
      return record(txHash);
    },
    [record, update],
  );

  const retryRecording = useCallback(() => (state.txHash ? record(state.txHash) : Promise.resolve(null)), [record, state.txHash]);

  const reset = useCallback(() => update(initial), [update]);

  return { ...state, busy: state.phase === 'wallet' || state.phase === 'network' || state.phase === 'recording', start, retryRecording, reset };
}

/** Copies text to the clipboard and reports success for a short moment. */
export function useCopyToClipboard(resetAfterMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return false;
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetAfterMs);
      return true;
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
