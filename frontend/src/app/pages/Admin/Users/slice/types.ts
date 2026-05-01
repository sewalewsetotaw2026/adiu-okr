/* Types for Users slice: User, Role, EmployeeRef, UsersState */

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface EmployeeRef {
  id: string; // Employee ID like "EMP-123"
  full_name: string;
  gender?: string;
  profile_picture_url?: string;
}

export interface User {
  id: number;
  email: string;
  role_id: number;
  profile_picture_url?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  employee: EmployeeRef | null;
  role: Role | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UsersState {
  loading: boolean;
  error: string | null;
  users: User[];
  pagination: Pagination;
}
