import { Action, PayloadAction, createSlice } from '@reduxjs/toolkit';
import { useInjectReducer, useInjectSaga } from 'redux-injectors';
import { assignManagerSaga } from './saga';
import { AssignManagerState } from './types';
import { Employee } from '../../../Employees/slice/types';

export const initialState: AssignManagerState = {
  loading: false,
  error: null,
  managerSearchQuery: "",
  managerSuggestions: [],
  existingManagers: [],
  selectedManager: null,
};

const slice = createSlice({
  name: 'assignManager',
  initialState,
  reducers: {
    // Manager Selection
    setManagerSearchQuery(state, action: PayloadAction<string>) {
      state.managerSearchQuery = action.payload;
    },
    searchManagersRequest(state, _action: PayloadAction<string>) {
      // Typically searching happens via saga debouncing or direct API call
    },
    searchManagersSuccess(state, action: PayloadAction<Employee[]>) {
      state.managerSuggestions = action.payload;
    },
    setSelectedManager(state, action: PayloadAction<Employee | null>) {
      state.selectedManager = action.payload;
      state.managerSearchQuery = action.payload ? action.payload.full_name : "";
      state.managerSuggestions = []; // Clear suggestions on selection
    },
    clearSelectedManager(state) {
      state.selectedManager = null;
      state.managerSearchQuery = "";
    },
    resetState(state) {
      state.loading = false;
      state.error = null;
      state.managerSearchQuery = "";
      state.managerSuggestions = [];
      state.existingManagers = [];
      state.selectedManager = null;
    },

    // Existing Managers
    fetchExistingManagersRequest(state) {
      // loading state handled generally or we can add specific loading
    },
    fetchExistingManagersSuccess(state, action: PayloadAction<Employee[]>) {
      state.existingManagers = action.payload;
    },
    fetchExistingManagersFailure(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },

    // Fetch Single Manager for Assignment (Reload Support) - still useful if we want to pre-load for some reason, 
    // but BuildTeam handles its own fetching. 
    // We can keep it or remove it. Since AssignManager is now ONLY step 1, we might not need to recover from URL here anymore 
    // because selection IMMEDIATELY navigates away.
    // Let's keep it minimal.
  },
});

export const { actions: assignManagerActions } = slice;

export const useAssignManagerSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: assignManagerSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
