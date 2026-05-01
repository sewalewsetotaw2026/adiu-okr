import React from "react";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../slice/authSlice/selectors";
import { selectActiveCelebrations } from "../../slice/celebrationSlice/selectors";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { CelebrationBanner } from "./CelebrationBanner";

import { Celebration } from "../../models/celebration";

/**
 * CelebrationManager component
 * Manages the display of celebration overlays and banners
 * based on active celebrations and user context
 */
export const CelebrationManager: React.FC = () => {
  // Get celebrations directly from Redux store (not filtered by context)
  const allCelebrations = useSelector(selectActiveCelebrations);

  const currentUser = useSelector(selectAuthUser);
  const [currentOverlayId, setCurrentOverlayId] = React.useState<string | null>(
    null,
  );

  // Filter celebrations locally - show public ones and private ones for current user
  const activeCelebrations = React.useMemo(() => {
    // Robustly get user ID as string
    const user = currentUser as any;
    const userId =
      user?.employee_id?.toString() ||
      user?.employee?.id?.toString() ||
      user?.id?.toString() ||
      "";

    return allCelebrations.filter((c: Celebration) => {
      if (c.isDismissed) return false;
      const celebrationUserId = c.employeeId.toString();

      if (c.visibility === "public") return true;
      return celebrationUserId === userId; // Strict string comparison
    });
  }, [allCelebrations, currentUser]);

  // Find the first non-dismissed celebration for overlay.
  // We rely on server-side dismissal instead of localStorage suppression,
  // so users reliably see new/updated celebrations.
  React.useEffect(() => {
    console.log(
      "[CelebrationManager] Active celebrations:",
      activeCelebrations.length,
      activeCelebrations,
    );

    // If we have an overlay, check if it's still valid
    if (currentOverlayId) {
      const stillValid = activeCelebrations.find(
        (c) => c.id === currentOverlayId && !c.isDismissed,
      );
      if (!stillValid) {
        setCurrentOverlayId(null);
      }
      return;
    }

    // If no overlay shown, look for next one
    const pending = activeCelebrations.find((c) => !c.isDismissed);
    if (pending) {
      console.log("[CelebrationManager] Showing overlay for:", pending.id);
      setCurrentOverlayId(pending.id);
    }
  }, [activeCelebrations, currentOverlayId]);

  // Get current overlay celebration from state
  const overlayCelebration = activeCelebrations.find(
    (c) => c.id === currentOverlayId && !c.isDismissed,
  );

  // Get banner celebration (first active, non-dismissed)
  const bannerCelebration = activeCelebrations.find((c) => !c.isDismissed);

  // Determine if user is in onboarding phase
  // status can be IN_PROGRESS, PENDING_APPROVAL, or COMPLETED
  const isInOnboarding =
    currentUser?.onboarding_status &&
    currentUser.onboarding_status !== "COMPLETED";

  return (
    <>
      {/* Banner - Always show at top if there are active celebrations and user not in onboarding */}
      {bannerCelebration && !isInOnboarding && (
        <CelebrationBanner celebration={bannerCelebration} />
      )}

      {/* Overlay - Show once per celebration and user not in onboarding */}
      {overlayCelebration && !isInOnboarding && (
        <CelebrationOverlay celebration={overlayCelebration} />
      )}
    </>
  );
};
