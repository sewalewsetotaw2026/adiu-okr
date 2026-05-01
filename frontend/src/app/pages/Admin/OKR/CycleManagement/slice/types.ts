export type CycleStatus = "planning" | "open" | "closed";

export interface Cycle {
  id: number;
  name: string;
  quarter_label?: string;
  start_date: string;
  end_date: string;
  description?: string;
  status: CycleStatus;
}

export interface CycleState {
  loading: boolean;
  error: string | null;
  cycles: Cycle[];
  currentCycle: Cycle | null;
  success: boolean;
}

/* ================= PAYLOADS ================= */

export interface CreateCyclePayload {
  name: string;
  quarter_label?: string;
  start_date: string;
  end_date: string;
  description?: string;
}

export interface UpdateCyclePayload {
  id: number;
  data: Partial<CreateCyclePayload>;
}

export interface CycleIdPayload {
  id: number;
}
