export interface JobTitle {
  id: number;
  title: string;
  level?: string;
  description?: string;
}

export interface JobTitlesState {
  loading: boolean;
  error: string | null;
  jobTitles: JobTitle[];
}
