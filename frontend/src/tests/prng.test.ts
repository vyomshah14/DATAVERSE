import { describe, it, expect } from 'vitest';
import { SplitMix64 } from '../engine/core/prng';

describe('SplitMix64 Deterministic PRNG', () => {
  it('produces identical pseudo-random stream from identical seed', () => {
    const seed = '0x4f3a9b1c7e8d2f10';
    const rngA = new SplitMix64(seed);
    const rngB = new SplitMix64(seed);

    for (let i = 0; i < 100; i++) {
      expect(rngA.nextUint64()).toBe(rngB.nextUint64());
    }
  });

  it('produces distinct pseudo-random streams from different seeds', () => {
    const rngA = new SplitMix64('0x4f3a9b1c7e8d2f10');
    const rngB = new SplitMix64('0xaaaaaaaaaaaaaaa1');

    const sampleA = Array.from({ length: 5 }, () => rngA.nextUint64());
    const sampleB = Array.from({ length: 5 }, () => rngB.nextUint64());

    expect(sampleA).not.toEqual(sampleB);
  });

  it('generates uniform float values strictly within [0, 1)', () => {
    const rng = new SplitMix64('0x1234567890abcdef');

    for (let i = 0; i < 500; i++) {
      const val = rng.nextFloat();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('generates integer values within specified bounds inclusive', () => {
    const rng = new SplitMix64('0x9876543210fedcba');
    const min = 10;
    const max = 25;

    for (let i = 0; i < 200; i++) {
      const val = rng.nextInt(min, max);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('preserves complete 64-bit precision via hex state representation', () => {
    const seed = '0x0000000000000042';
    const rng = new SplitMix64(seed);
    expect(rng.getStateHex()).toBe('0x0000000000000042');

    rng.nextUint64();
    const stateHex = rng.getStateHex();
    expect(stateHex.startsWith('0x')).toBe(true);
    expect(stateHex.length).toBe(18); // '0x' + 16 hex chars
  });
});
