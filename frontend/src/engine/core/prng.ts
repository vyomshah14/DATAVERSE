/**
 * SplitMix64 Deterministic Seeded Pseudo-Random Number Generator.
 * Conforms to DATAVERSE Architecture Decision Record DECISION-005.
 * Never use Math.random() for simulation decisions.
 */
export class SplitMix64 {
  private state: bigint;

  constructor(seed: bigint | string) {
    if (typeof seed === 'string') {
      // Handles hex prefix e.g. "0x4f3a9b1c7e8d2f10"
      this.state = BigInt(seed);
    } else {
      this.state = seed;
    }
  }

  /**
   * Advances PRNG state and returns next 64-bit unsigned integer as BigInt.
   */
  public nextUint64(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
  }

  /**
   * Returns uniform floating-point number in interval [0, 1).
   * Extracts upper 53 bits for exact IEEE-754 mantissa mapping.
   */
  public nextFloat(): number {
    const uint64 = this.nextUint64();
    const mantissa = Number(uint64 >> 11n);
    return mantissa / 9007199254740992; // 2^53
  }

  /**
   * Returns pseudo-random integer in range [min, max] inclusive.
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  /**
   * Returns the current internal 64-bit state formatted as canonical 16-char hex string.
   */
  public getStateHex(): string {
    return '0x' + this.state.toString(16).padStart(16, '0');
  }
}
