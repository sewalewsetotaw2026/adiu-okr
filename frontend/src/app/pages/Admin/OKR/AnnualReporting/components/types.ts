export type ExportFormat = "PDF" | "CSV" | "XLSX";

export type Archive = {
  id: number | string;
  quarter_name?: string;
  archived_at?: string;
  cycle?: {
    name?: string;
    start_date?: string;
    end_date?: string;
    quarter_label?: string;
  };
  snapshots?: any[];
  score?: number;
  completion_rate?: number;
  total_objectives?: number;
  total_key_results?: number;
};

export type AnnualStats = {
  avgScore: number | null;
  avgCompletion: number | null;
  totalObjectives: number;
  totalKRs: number;
  trend: number | null;
  quarters: number;
};
