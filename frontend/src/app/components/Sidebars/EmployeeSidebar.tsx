import {
  MdOutlineDashboard,
  MdOutlineAccountCircle,
  MdOutlineCalendarToday,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdOutlineHistory,
  MdLogout,
  MdExpandMore,
  MdExpandLess,
  MdGroup,
  MdOutlineList,
  MdPeopleOutline,
  MdPersonOutline,
  MdCheckCircle,
  MdTrackChanges,
  MdFactCheck,
} from "react-icons/md";
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSidebar } from "../../context/SidebarContext";
import okrExecutionApi from "../../services/okr-execution.api";
import makeCall from "../../API";
import apiRoutes from "../../API/apiRoutes";
import { useDispatch } from "react-redux";
import { authActions } from "../../slice/authSlice";
import toast from "react-hot-toast";
import StatusModal from "../common/StatusModal";
import { useManagerSlice } from "../../slice/managerSlice";
import { useSelector } from "react-redux";
import { selectIsManager } from "../../slice/managerSlice/selectors";
import { selectAuthUser } from "../../slice/authSlice/selectors";

import { usePermission } from "../../hooks/usePermission";
import { routeConstants } from "../../../utils/constants";

export default function EmployeeSidebar() {
  const { isOpen, toggle, isMobileOpen, closeMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { actions: managerActions } = useManagerSlice();
  const dispatch = useDispatch();
  const isManager = useSelector(selectIsManager);
  const user = useSelector(selectAuthUser);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isOkrNavOpen, setIsOkrNavOpen] = useState(
    location.pathname.startsWith("/employee/execution") ||
    location.pathname.startsWith("/manager/okr") ||
    location.pathname.startsWith("/okr/reviews"),
  );
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [hasUnsubmittedPlans, setHasUnsubmittedPlans] = useState(false);


  useEffect(() => {
    dispatch(managerActions.checkIsManager());
  }, [dispatch, managerActions]);

  useEffect(() => {
    const isOkrActive =
      location.pathname.startsWith("/employee/execution") ||
      location.pathname.startsWith("/manager/okr");

    if (isOkrActive) {
      setIsOkrNavOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (isManager) {
      const fetchCounts = async () => {
        try {
          const cycleRes = await makeCall({
            method: "GET",
            route: apiRoutes.okr.currentCycle,
            isSecureRoute: true,
          });
          const cycleId = Number(cycleRes?.data?.data?.id ?? cycleRes?.data?.id);
          if (!cycleId) {
            setPendingReviewCount(0);
            return;
          }
          const submissions =
            await okrExecutionApi.fetchManagerSubmissions(cycleId);
          const pendingSubmissions = submissions.filter(
            (s) => s.status === "pending_approval",
          );
          setPendingReviewCount(pendingSubmissions.length);

          // Task 4 - Team Health Summary
          const health = await okrExecutionApi.fetchTeamHealthSummary();
          setHasUnsubmittedPlans(!!health?.hasUnsubmittedPlans);
        } catch (e) {
          console.error("Failed to fetch pending review counts", e);
        }
      };

      void fetchCounts();

      // Task 3 - Badge Revalidation on Focus
      window.addEventListener("focus", fetchCounts);

      const interval = setInterval(fetchCounts, 60000); // Refresh every minute
      return () => {
        clearInterval(interval);
        window.removeEventListener("focus", fetchCounts);
      };
    }
  }, [isManager]);


  const isActive = (path: string) => {
    if (path === routeConstants.okrMyExecution) {
      return location.pathname.startsWith("/employee/execution");
    }
    return location.pathname === path;
  };

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const handleLogoutConfirm = () => {
    dispatch(authActions.logout());
    toast.success("Logged out successfully");
    navigate("/login");
    setIsLogoutModalOpen(false);
  };

  const { hasPermission } = usePermission();

  const navItems = [
    {
      path: "/employee/dashboard",
      label: "Dashboard",
      icon: MdOutlineDashboard,
    },
    {
      path: "/employee/profile",
      label: "My Profile",
      icon: MdOutlineAccountCircle,
    },

    {
      path: "/employee/leave",
      label: "Leave Application",
      icon: MdOutlineCalendarToday,
      visible: hasPermission("LEAVE_APPLICATION", "read", "own"),
    },
    {
      path: "/employee/leave-recall",
      label: "Leave Recall",
      icon: MdOutlineHistory,
      visible: hasPermission("LEAVE_RECALL", "read", "own") && !isManager,
    },
    // {
    //   path: "/employee/tasks",
    //   label: "My Tasks",
    //   icon: MdOutlineWorkOutline,
    // },
    // {
    //   path: "/employee/payslip",
    //   label: "Payslips",
    //   icon: MdOutlineReceipt,
    //   visible: hasPermission("FINANCIAL_DETAIL", "read", "own"),
    // },
    // {
    //   path: "/employee/settings",
    //   label: "Settings",
    //   icon: MdSettings,
    // },
  ].filter((item: any) => item.visible !== false);

  const managerOkrItems = [
    {
      path: routeConstants.okrContributorAssignment,
      label: "Contributors",
      icon: MdPeopleOutline,
      visible: true,
    },
    {
      path: routeConstants.okrTeamExecutionMonitor,
      label: "Team monitor",
      icon: MdPersonOutline,
      visible: true,
      indicator: hasUnsubmittedPlans,
    },

    {
      path: routeConstants.okrPlanningCompliance,
      label: "Planning compliance",
      icon: MdCheckCircle,
      visible: true,
    },
    {
      path: routeConstants.okrApprovalQueue,
      label: "Approvals",
      icon: MdFactCheck,
      visible: true,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
    },
  ].filter((item) => item.visible !== false);

  const okrNavItems = [
    {
      path: routeConstants.okrMyExecution,
      label: "My execution",
      icon: MdOutlineList,
      visible: true,
    },
    ...(isManager ? managerOkrItems : []),
  ].filter((item) => item.visible !== false);

  const isOkrSectionActive =
    location.pathname.startsWith("/employee/execution") ||
    managerOkrItems.some((item) => location.pathname.startsWith(item.path));

  if (isManager) {
    const managerItems = [
      {
        path: "/manager/team-management",
        label: "Team Management",
        icon: MdGroup,
        visible:
          hasPermission("EMPLOYMENT", "read", "team") ||
          hasPermission("LEAVE_APPLICATION", "read", "team"),
      },
    ].filter((item) => item.visible !== false);

    if (managerItems.length > 0) {
      navItems.splice(4, 0, ...managerItems);
    }
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          h-screen bg-white shadow-xl border-r border-gray-100 flex flex-col transition-all duration-300 z-40
          fixed top-0 left-0
          ${isMobileOpen
            ? "translate-x-0 w-72"
            : "-translate-x-full lg:translate-x-0"
          }
          ${isOpen ? "lg:w-72" : "lg:w-24"}
        `}
      >
        {/* Close button for mobile */}
        <button
          onClick={closeMobile}
          className="lg:hidden absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer z-50"
        >
          <MdClose size={24} />
        </button>

        <div className="pt-8 pb-6 px-4 flex flex-col items-center relative">
          <img
            src={user?.company?.logo_url || "/kacha-logo.jpg"}
            alt={`${user?.company?.company_code || "Kacha"} Logo`}
            className={`w-full max-w-[90%] object-contain mx-auto transition-all duration-300 ${isOpen || isMobileOpen ? "max-h-16" : "max-h-10"
              }`}
          />

          {/* Toggle button - hidden on mobile */}
          <button
            onClick={toggle}
            className="hidden lg:flex absolute -right-4 top-10 w-8 h-8 items-center justify-center bg-white border border-gray-100 rounded-full shadow-md text-k-medium-grey hover:text-primary transition-colors z-50 cursor-pointer"
          >
            {isOpen ? (
              <MdChevronLeft size={22} />
            ) : (
              <MdChevronRight size={22} />
            )}
          </button>
        </div>

        <div className="flex-1 mt-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`
                group flex items-center gap-4 p-3.5 rounded-2xl font-medium transition-colors
                ${isOpen || isMobileOpen ? "" : "justify-center"}
                ${isActive(item.path)
                  ? "bg-primary text-white"
                  : "text-gray-500 hover:bg-primary-light hover:text-primary"
                }
              `}
              onClick={closeMobile}
            >
              <item.icon className="text-2xl shrink-0" />

              {(isOpen || isMobileOpen) && (
                <span className="whitespace-nowrap tracking-wide text-sm">
                  {item.label}
                </span>
              )}

              {!isOpen && !isMobileOpen && (
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl">
                  {item.label}
                  <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-800" />
                </div>
              )}
            </Link>
          ))}

          {okrNavItems.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  if (!isOpen && !isMobileOpen) {
                    navigate(okrNavItems[0].path);
                    closeMobile();
                    return;
                    }
                  setIsOkrNavOpen((v) => !v);
                }}
                className={`
                  w-full group flex items-center gap-4 p-3.5 rounded-2xl font-medium transition-colors
                  ${isOpen || isMobileOpen ? "" : "justify-center"}
                  ${
                    isOkrSectionActive
                      ? "bg-primary text-white"
                      : "text-gray-500 hover:bg-primary-light hover:text-primary"
                  }
                `}
              >
                <MdTrackChanges className="text-2xl shrink-0" />
                {(isOpen || isMobileOpen) && (
                  <>
                    <span className="whitespace-nowrap tracking-wide text-sm">
                      OKR Management
                    </span>
                    <span className="ml-auto">
                      {isOkrNavOpen ? (
                        <MdExpandLess className="text-lg" />
                      ) : (
                        <MdExpandMore className="text-lg" />
                      )}
                    </span>
                  </>
                )}
              </button>

              {(isOpen || isMobileOpen) && isOkrNavOpen && (
                <div className="ml-4 pl-3 border-l border-gray-200 space-y-1">
                  {okrNavItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeMobile}
                      className={`
                        flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors
                        ${
                          isActive(item.path)
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-gray-600 hover:bg-slate-100"
                        }
                      `}
                    >
                      <item.icon className="text-base shrink-0" />
                      <span className="flex items-center gap-1.5">
                        {item.label}
                        {"indicator" in item && item.indicator && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                        )}
                      </span>
                      {item.badge !== undefined && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}

                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-50 bg-gray-50/30 rounded-br-3xl space-y-3">
          {/* Profile Section - Commented Out */}
          {/* <div
            className={`flex items-center gap-3 ${
              !(isOpen || isMobileOpen) && "justify-center"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-white border-2 border-white shadow-sm flex items-center justify-center text-k-orange font-bold shrink-0 overflow-hidden">
              <img
                src="https://avatar.iran.liara.run/public/boy"
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            {(isOpen || isMobileOpen) && (
              <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                <p className="text-sm font-bold text-gray-800 truncate">
                  Tesfamichael Tafere
                </p>
                <p className="text-xs text-gray-500 truncate font-medium">
                  Software Engineer
                </p>
              </div>
            )}
          </div> */}

          {/* Sign Out Button */}
          <button
            onClick={handleLogoutClick}
            className={`
              w-full group flex items-center gap-4 p-3 rounded-xl font-medium transition-colors cursor-pointer
              ${isOpen || isMobileOpen ? "" : "justify-center"}
              text-gray-500 hover:bg-red-50 hover:text-red-600
            `}
            title="Sign Out"
          >
            <MdLogout className="text-xl shrink-0" />
            {(isOpen || isMobileOpen) && (
              <span className="whitespace-nowrap tracking-wide text-sm">
                Sign Out
              </span>
            )}
            {!isOpen && !isMobileOpen && (
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl">
                Sign Out
                <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-800" />
              </div>
            )}
          </button>
        </div>
      </div>

      <StatusModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        type="warning"
        title="Sign Out"
        message="Are you sure you want to sign out?"
        primaryButtonText="Sign Out"
        onPrimaryAction={handleLogoutConfirm}
        secondaryButtonText="Cancel"
        onSecondaryAction={() => setIsLogoutModalOpen(false)}
      />
    </>
  );
}
