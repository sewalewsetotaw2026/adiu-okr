import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { useInjectReducer, useInjectSaga } from "redux-injectors";
import { companyObjectivesSaga } from "./saga";
import {
  CompanyObjectivesState,
  CompanyObjective,
  CreateCompanyObjectivePayload,
  UpdateCompanyObjectivePayload,
  ObjectiveIdPayload,
} from "./types";

export const initialState: CompanyObjectivesState = {
  loading: false,
  error: null,
  objectives: [],
  success: false,
};

const slice = createSlice({
  name: "companyObjectives",
  initialState,
  reducers: {
    /* FETCH */
    fetchObjectivesRequest(
      state,
      _action: PayloadAction<{ cycle_id: number }>,
    ) {
      state.loading = true;
      state.error = null;
    },
    fetchObjectivesSuccess(state, action: PayloadAction<CompanyObjective[]>) {
      state.loading = false;
      state.objectives = action.payload;
    },
    fetchObjectivesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    /* CREATE */
    createObjectiveRequest(
      state,
      _action: PayloadAction<CreateCompanyObjectivePayload>,
    ) {
      state.loading = true;
    },
    createObjectiveSuccess(state) {
      state.loading = false;
      state.success = true;
    },
    createObjectiveFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    /* UPDATE */
    updateObjectiveRequest(
      state,
      _action: PayloadAction<UpdateCompanyObjectivePayload>,
    ) {
      state.loading = true;
    },
    updateObjectiveSuccess(state) {
      state.loading = false;
      state.success = true;
    },
    updateObjectiveFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    /* DELETE */
    deleteObjectiveRequest(state, _action: PayloadAction<ObjectiveIdPayload>) {
      state.loading = true;
    },
    deleteObjectiveSuccess(state) {
      state.loading = false;
    },
    deleteObjectiveFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const { actions: companyObjectivesActions } = slice;

export const useCompanyObjectivesSlice = () => {
  useInjectReducer({ key: slice.name, reducer: slice.reducer });
  useInjectSaga({ key: slice.name, saga: companyObjectivesSaga });
  return { actions: slice.actions };
};

export default slice.reducer;
