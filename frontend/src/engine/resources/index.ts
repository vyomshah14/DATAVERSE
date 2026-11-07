/**
 * Compute & Memory Resource Accounting Module (Phase 4).
 */
export interface ResourceUtilization {
  cpuCyclesConsumed: number;
  memoryBytesAllocated: number;
  isOomCrash: boolean;
}
