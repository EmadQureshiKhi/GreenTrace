import { describe, expect, it } from 'vitest';
import { canonicalJson, hashCanonical, sha256Hex } from '../hashing';

describe('canonicalJson', () => {
  it('is independent of key order at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: 2 } })).toBe(canonicalJson({ a: { c: 2, d: [1, { y: 2, z: 1 }] }, b: 1 }));
  });

  it('drops undefined values like JSON.stringify', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe('sha256Hex', () => {
  it('matches the known digest of "abc"', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes canonical JSON', async () => {
    expect(await hashCanonical({ b: 2, a: 1 })).toBe(await sha256Hex('{"a":1,"b":2}'));
  });
});
