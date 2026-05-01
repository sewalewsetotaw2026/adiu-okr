import { RootState } from "../../../store/types/RootState";
import { Celebration } from "../../models/celebration";

export const selectActiveCelebrations = (state: RootState) =>
  state.celebration?.activeCelebrations || [];

export const selectCelebrationById = (id: string) => (state: RootState) =>
  state.celebration?.activeCelebrations.find((c: Celebration) => c.id === id);

export const selectCelebrationLoading = (state: RootState) =>
  state.celebration?.loading || false;

export const selectCelebrationError = (state: RootState) =>
  state.celebration?.error || null;

/**
 * Get celebrations visible to the current user
 * Based on visibility rules:
 * - Birthday/Promotion: shown to all except the celebrating employee
 * - Anniversary: shown only to the celebrating employee
 */
export const selectVisibleCelebrations = (currentUserId: string) => (
  state: RootState
) => {
  const celebrations = state.celebration?.activeCelebrations || [];
  return celebrations.filter((celebration: Celebration) => {
    // Skip dismissed celebrations
    if (celebration.isDismissed) return false;

    if (celebration.visibility === "public") {
      // Birthday and Promotion: show to everyone (including the celebrating employee)
      return true;
    } else {
      // Anniversary: show only to the celebrating employee
      return celebration.employeeId === currentUserId;
    }
  });
};

/**
 * Get celebrations for a specific employee (used on their profile)
 */
export const selectUserCelebrations = (userId: string) => (state: RootState) =>
  state.celebration?.activeCelebrations.filter(
    (c: Celebration) => c.employeeId === userId
  ) || [];

