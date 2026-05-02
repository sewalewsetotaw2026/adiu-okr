export interface TeamMember {
  id: number;
  employee_id: string;
  employee: {
    id: string;
    full_name: string;
    email: string | null;
    gender: string;
    date_of_birth: string;
    place_of_work: string | null;
    phones: Array<{ phone_number: string }>;
    employments: Array<{
      department: { name: string };
      jobTitle: { title: string; level: string };
    }>;
  };
  department: { name: string };
  jobTitle: { title: string; level: string };
}

export interface ManagerState {
  isManager: boolean;
  teamMembers: TeamMember[];
  teamLeaveApplications: any[]; // Ideally reuse LeaveApplication type
  teamOnLeaveToday: any[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    total: number;
  };
}

export interface GetTeamLayoutPayload {
  // empty or filters
}

export interface GetTeamLeaveApplicationsPayload {
  status?: string;
  page?: number;
  limit?: number;
}
