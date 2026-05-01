import { Action, PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { buildTeamSaga } from './saga';
import { BuildTeamState } from './types';
import { Employee, EmployeeFilters } from '../../../Employees/slice/types';

export const initialState: BuildTeamState = {
  loading: false,
  error: null,
  employees: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {
    gender: "",
    department: "",
    job_title: "",
    job_level: "",
    sort_by: "",
    search: "",
  },
  selectedManager: null,
  selectedSubordinateIds: [],
  assignSuccess: false,
  existingTeam: [],
};

const slice = createSlice({
  name: 'buildTeam',
  initialState,
  reducers: {
    // Add this:
    setExistingTeam(state, action: PayloadAction<Employee[]>) {
      state.existingTeam = action.payload;
    },
    // Actions for filtering/pagination of subordinates
    setFilters(state, action: PayloadAction<Partial<EmployeeFilters>>) {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 1; // Reset to page 1 on filter change
    },
    resetFilters(state) {
      state.filters = initialState.filters;
      state.pagination.page = 1;
    },
    resetState(state) {
      return initialState;
    },
    setPage(state, action: PayloadAction<number>) {
      state.pagination.page = action.payload;
    },

    // Subordinate Fetching
    fetchSubordinatesRequest(state) {
      state.loading = true;
      state.error = null;
    },
    fetchSubordinatesSuccess(state, action: PayloadAction<{ employees: Employee[]; total: number }>) {
      state.loading = false;
      state.employees = action.payload.employees;
      state.pagination.total = action.payload.total;
      state.pagination.totalPages = Math.ceil(action.payload.total / state.pagination.limit);
    },
    fetchSubordinatesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // Manager Fetching
    fetchManagerRequest(state, _action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
      state.selectedManager = null;
    },
    fetchManagerSuccess(state, action: PayloadAction<Employee>) {
      state.loading = false;
      state.selectedManager = action.payload;
    },
    fetchManagerFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // Subordinate Selection
    toggleSubordinateSelection(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (state.selectedSubordinateIds.includes(id)) {
        state.selectedSubordinateIds = state.selectedSubordinateIds.filter(empId => empId !== id);
      } else {
        state.selectedSubordinateIds.push(id);
      }
    },
    selectAllSubordinates(state) {
      // Selects all currently visible employees
      const visibleIds = state.employees.map(e => e.id);
      const allSelected = visibleIds.every(id => state.selectedSubordinateIds.includes(id));

      if (allSelected) {
        // Deselect all visible
        state.selectedSubordinateIds = state.selectedSubordinateIds.filter(id => !visibleIds.includes(id));
      } else {
        // Select all visible (union)
        const newIds = visibleIds.filter(id => !state.selectedSubordinateIds.includes(id));
        state.selectedSubordinateIds = [...state.selectedSubordinateIds, ...newIds];
      }
    },
    clearSubordinateSelection(state) {
      state.selectedSubordinateIds = [];
    },
    setSelectedSubordinateIds(state, action: PayloadAction<string[]>) {
      state.selectedSubordinateIds = action.payload;
    },

    // Assignment Action
    assignTeamRequest(state, _action: PayloadAction<{ managerId: string; employeeIds: string[] }>) {
      state.loading = true;
      state.error = null;
      state.assignSuccess = false;
    },
    assignTeamSuccess(state) {
      state.loading = false;
      state.assignSuccess = true;
      state.selectedSubordinateIds = []; // Clear selection on success
    },
    assignTeamFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
      state.assignSuccess = false;
    },
    resetAssignSuccess(state) {
      state.assignSuccess = false;
    }
  },
});

export const { actions: buildTeamActions } = slice;

export const useBuildTeamSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: buildTeamSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
