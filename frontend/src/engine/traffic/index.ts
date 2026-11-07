/**
 * Traffic Workload Generation Module (Phase 4).
 */
export interface TrafficProfile {
  name: string;
  type: 'poisson' | 'burst' | 'constant';
  ratePerSec: number;
}
