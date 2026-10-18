import { describe, expect, it } from 'vitest';
import { advanceCursor, transactionsIn } from '../exchange-scan';

const log = (transaction_hash: string, timestamp: string) => ({ transaction_hash, timestamp });

describe('transactionsIn', () => {
  it('lists each transaction once, in consensus order, with its last log time', () => {
    const logs = [log('0xa', '100.1'), log('0xa', '100.1'), log('0xb', '101.5'), log('0xa', '100.2')];
    expect(transactionsIn(logs)).toEqual([
      { hash: '0xa', timestamp: '100.2' },
      { hash: '0xb', timestamp: '101.5' },
    ]);
  });

  it('is empty for no logs', () => {
    expect(transactionsIn([])).toEqual([]);
  });
});

describe('advanceCursor', () => {
  it('moves past done and declined transactions', () => {
    expect(advanceCursor('99.0', [{ timestamp: '100.0', outcome: 'done' }, { timestamp: '101.0', outcome: 'declined' }])).toBe('101.0');
  });

  it('stops before the first transaction to retry, so the next run sees it again', () => {
    expect(
      advanceCursor('99.0', [
        { timestamp: '100.0', outcome: 'done' },
        { timestamp: '101.0', outcome: 'retry' },
        { timestamp: '102.0', outcome: 'done' },
      ]),
    ).toBe('100.0');
  });

  it('keeps the cursor when the first transaction must be retried', () => {
    expect(advanceCursor('99.0', [{ timestamp: '100.0', outcome: 'retry' }])).toBe('99.0');
  });
});
