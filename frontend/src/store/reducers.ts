import { combineReducers, Reducer } from "@reduxjs/toolkit";
import authReducer from "../app/slice/authSlice";
import onboardingReducer from "../app/slice/onboardingSlice";
import userReducer from "../app/slice/userSlice";
import employeeReducer from "../app/slice/employeeSlice";
import employmentReducer from "../app/slice/employmentSlice";
import adminReducer from "../app/slice/adminSlice";
import leaveReducer from "../app/slice/leaveSlice";
import celebrationReducer from "../app/slice/celebrationSlice";

// Base reducers that are always included
const baseReducers = {
  auth: authReducer,
  onboarding: onboardingReducer,
  user: userReducer,
  employee: employeeReducer,
  employment: employmentReducer,
  admin: adminReducer,
  leave: leaveReducer,
  celebration: celebrationReducer,
};

/**
 * Merges the main reducer with the router state and dynamically injected reducers
 */
export function createReducer(
  injectedReducers: Record<string, Reducer> = {},
): Reducer {
  const appReducer = combineReducers({
    ...baseReducers,
    ...injectedReducers,
  });

  return (state, action) => {
    if (action.type === "auth/logout") {
      // Reset all sub-states to undefined so that they re-initialize to their default values
      state = undefined;
    }
    return appReducer(state, action);
  };
}
