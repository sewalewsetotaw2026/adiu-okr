import { Employee } from '../../slice/types';

export interface PromotionState {
  loading: boolean;
  error: string | null;
  success: boolean;
  employee: Employee | null;
}
