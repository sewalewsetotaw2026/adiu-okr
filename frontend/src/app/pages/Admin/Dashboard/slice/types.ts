export interface DashboardStats {
  totalEmployees: number;
  totalDepartments: number;
  activeEmployees: number;
  inactiveEmployees: number;
  totalManagers: number;
  genderDist: GenderDist;
  empTypeDist: EmpTypeDist;
  deptDist: DeptDist;
  jobLevelDist: JobLevelDist;
  managerDist: ManagerDist;
  departmentBreakdown: Record<
    string,
    {
      gender: GenderDist;
      jobLevels: JobLevelDist;
      empTypes: EmpTypeDist;
      probation: Record<string, number>;
    }
  >;
  tenureDistribution: Record<string, number>;
  probationStatus: Record<string, number>;
  educationDist: Record<string, number>;
  ageDist: Record<string, number>;
  hiringTrends: Record<string, number>;
}

export interface DashboardState {
  loading: boolean;
  error: string | null;
  stats: DashboardStats;
}

export interface GenderDist {
  male: number;
  female: number;
}

export interface EmpTypeDist {
  [key: string]: number;
}

export interface DeptDist {
  [key: string]: number;
}

export interface JobLevelDist {
  [key: string]: number;
}

export interface ManagerDist {
  [key: string]: number;
}
