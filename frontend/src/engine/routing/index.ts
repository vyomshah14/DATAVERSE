/**
 * Deterministic Routing & Load Balancing Module (Phase 4).
 * Adheres to DECISION-003: Intra-tick dynamic score calculation.
 */
export interface RoutingDecision {
  requestId: string;
  assignedNodeId: string;
  calculatedScore: number;
}
