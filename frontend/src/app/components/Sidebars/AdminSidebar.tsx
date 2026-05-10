import {
  MdDashboard,
  MdGroup,
  MdSettings,
  MdClose,
  MdChevronLeft,
  MdChevronRight,
  MdLogout,
  MdCalendarToday,
  MdAdminPanelSettings,
  MdOutlineAccountCircle,
  MdOutlineCalendarToday,
  MdOutlineHistory,
  MdTrackChanges,
  MdExpandMore,
  MdChevronRight as MdChevronRightSmall,
  MdInsights,
  MdCompareArrows,
  MdCollectionsBookmark,
  MdArchive,
  MdPerson,
  MdPublishedWithChanges,
  MdFactCheck,
  MdCheckCircle,
} from "react-icons/md";
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSidebar } from "../../context/SidebarContext";
import { useDispatch, useSelector } from "react-redux";
import { authActions } from "../../slice/authSlice";
import { selectAuthUser } from "../../slice/authSlice/selectors";
import toast from "react-hot-toast";
import StatusModal from "../common/StatusModal";
import { usePermission } from "../../hooks/usePermission";
import { useManagerSlice } from "../../slice/managerSlice";
import { selectIsManager } from "../../slice/managerSlice/selectors";
import { routeConstants } from "../../../utils/constants";

export default function AdminSidebar() {
  const { isOpen, toggle, isMobileOpen, closeMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectAuthUser);
  const { actions: managerActions } = useManagerSlice();
  const isManager = useSelector(selectIsManager);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isOkrExpanded, setIsOkrExpanded] = useState(
    location.pathname.startsWith("/admin/okr") ||
      location.pathname.startsWith("/manager/okr"),
  );
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  useEffect(() => {
    dispatch(managerActions.checkIsManager());
  }, [dispatch, managerActions]);

  useEffect(() => {
    if (isManager) {
      const fetchCounts = async () => {
        try {
          const cycleRes = await makeCall({
            method: "GET",
            route: apiRoutes.okr.currentCycle,
            isSecureRoute: true,
          });
          const cycleId = Number(
            cycleRes?.data?.data?.id ?? cycleRes?.data?.id,
          );
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

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

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
      path: "/admin/dashboard",
      label: "Dashboard",
      icon: MdDashboard,
    },
    {
      path: "/admin/employees",
      label: "Employees",
      icon: MdGroup,
      visible: hasPermission("EMPLOYEE"),
    },
    {
      path: "/admin/leaves",
      label: "Leave Management",
      icon: MdCalendarToday,
      visible: hasPermission("LEAVE_APPLICATION"),
    },
    {
      path: "/admin/okr",
      label: "OKR Management",
      icon: MdTrackChanges,
      visible: hasPermission("OKR") || true,
    },
  ];

  // Add Personal Items for HR Role
  if (user?.role?.name === "HR" || user?.role_name === "HR") {
    navItems.push(
      {
        path: "/employee/profile",
        label: "My Profile",
        icon: MdOutlineAccountCircle,
      },
      {
        path: "/employee/leave",
        label: "Leave Application",
        icon: MdOutlineCalendarToday,
      },
      {
        path: "/employee/leave-recall",
        label: "Leave Recall",
        icon: MdOutlineHistory,
        visible: !isManager,
      },
    );
  }

  if (isManager) {
    navItems.push({
      path: "/manager/team-management",
      label: "Team Management",
      icon: MdGroup,
    });
  }

  // Add Configuration Items at the end
  navItems.push(
    {
      path: "/admin/roles",
      label: "Role",
      icon: MdAdminPanelSettings,
      visible: hasPermission("ROLE"),
    },
    {
      path: "/admin/settings",
      label: "Settings",
      icon: MdSettings,
      visible: hasPermission("SETTINGS"),
    },
  );

  const filteredNavItems = navItems.filter((item) => item.visible !== false);
  const okrLinks = [
    {
      to: routeConstants.okr,
      label: "Overview",
      icon: MdDashboard,
      exact: true,
    },
    {
      to: routeConstants.okrCeoStrategicDashboard,
      label: "CEO Dashboard",
      icon: MdInsights,
    },
    {
      to: routeConstants.okrCycles,
      label: "Cycle Management",
      icon: MdCalendarToday,
    },
    {
      to: routeConstants.okrObjectives,
      label: "Company Objectives",
      icon: MdTrackChanges,
    },
    {
      to: routeConstants.okrDepartmentApprovalQueue,
      label: "Approvals",
      icon: MdFactCheck,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
    },
    {
      to: routeConstants.okrPlanningCompliance,
      label: "Planning Compliance",
      icon: MdCheckCircle,
    },
    {
      to: routeConstants.okrDepartmentPlanning,
      label: "Department OKR",
      icon: MdGroup,
    },
    {
      to: routeConstants.okrConfiguration,
      label: "Configuration",
      icon: MdSettings,
    },
    {
      to: routeConstants.okrDepartmentComparison,
      label: "Compare",
      icon: MdCompareArrows,
    },
    {
      to: routeConstants.okrCompanyGallery,
      label: "Gallery",
      icon: MdCollectionsBookmark,
    },
    // { to: routeConstants.okrAuditLogs, label: "Audit", icon: MdOutlineHistory },
    {
      to: routeConstants.okrArchiveManagement,
      label: "Archive",
      icon: MdArchive,
    },
  ];
  const normalNavItems = filteredNavItems.filter(
    (item) => !item.path.startsWith("/admin/okr"),
  );
  const leavesIndex = normalNavItems.findIndex(
    (item) => item.path === "/admin/leaves",
  );
  const roleIndex = normalNavItems.findIndex(
    (item) => item.path === "/admin/roles",
  );

  const okrInsertIndex = (() => {
    if (leavesIndex >= 0) return leavesIndex + 1;
    if (roleIndex >= 0) return roleIndex;
    return normalNavItems.length;
  })();

  const navItemsWithOkrPlaceholder = [
    ...normalNavItems.slice(0, okrInsertIndex),
    {
      path: "__OKR_COLLAPSIBLE__",
      label: "OKR placeholder",
      icon: MdTrackChanges,
    },
    ...normalNavItems.slice(okrInsertIndex),
  ];

  useEffect(() => {
    if (
      location.pathname.startsWith("/admin/okr") ||
      location.pathname.startsWith("/manager/okr")
    ) {
      setIsOkrExpanded(true);
    }
  }, [location.pathname]);

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
          ${
            isMobileOpen
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
            className={`w-full max-w-[90%] object-contain mx-auto transition-all duration-300 ${
              isOpen || isMobileOpen ? "max-h-14" : "max-h-10"
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
          {navItemsWithOkrPlaceholder.map((item) => {
            if (item.path === "__OKR_COLLAPSIBLE__") {
              return (
                (hasPermission("OKR") || true) && (
                  <div key="okr-collapsible">
                    <button
                      type="button"
                      onClick={() => setIsOkrExpanded((prev) => !prev)}
                      className={`
                        group w-full flex items-center gap-4 p-3.5 rounded-2xl font-medium transition-colors cursor-pointer
                        ${isOpen || isMobileOpen ? "" : "justify-center"}
                        ${
                          location.pathname.startsWith("/admin/okr")
                            ? "bg-primary text-white"
                            : "text-gray-500 hover:bg-primary-light hover:text-primary"
                        }
                      `}
                      title="OKR Management"
                    >
                      <MdTrackChanges className="text-2xl shrink-0" />
                      {(isOpen || isMobileOpen) && (
                        <>
                          <span className="whitespace-nowrap tracking-wide text-sm">
                            OKR Management
                          </span>
                          <span className="ml-auto">
                            {isOkrExpanded ? (
                              <MdExpandMore className="text-xl" />
                            ) : (
                              <MdChevronRightSmall className="text-xl" />
                            )}
                          </span>
                        </>
                      )}
                    </button>

                    {isOkrExpanded && (isOpen || isMobileOpen) && (
                      <div className="mt-1 ml-4 border-l border-gray-200 pl-3 space-y-1">
                        {okrLinks.map((link) => {
                          const active = link.exact
                            ? location.pathname === link.to
                            : location.pathname === link.to ||
                              location.pathname.startsWith(`${link.to}/`);
                          const LinkIcon = link.icon;
                          return (
                            <Link
                              key={link.to}
                              to={link.to}
                              onClick={closeMobile}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                active
                                  ? "bg-primary/10 text-primary"
                                  : "text-k-medium-grey hover:bg-gray-50 hover:text-k-dark-grey"
                              }`}
                            >
                              <LinkIcon className="text-sm shrink-0" />
                              {link.label}
                              {link.badge !== undefined && link.badge && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                  {link.badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  group flex items-center gap-4 p-3.5 rounded-2xl font-medium transition-colors
                  ${isOpen || isMobileOpen ? "" : "justify-center"}
                  ${
                    isActive(item.path)
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
                    {item.badge !== undefined && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </span>
                )}
                {!isOpen && !isMobileOpen && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl">
                    {item.label}
                    {item.badge !== undefined && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-800" />
                  </div>
                )}

                {!isOpen && !isMobileOpen && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl">
                    {item.label}
                    <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-800" />
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-50 bg-gray-50/30 rounded-br-3xl space-y-3">
          {/* Profile Section - Commented Out */}
          {/* <div
            className={`flex items-center gap-3 ${
              !(isOpen || isMobileOpen) && "justify-center"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-white border-2 border-white shadow-sm flex items-center justify-center text-primary font-bold shrink-0 overflow-hidden">
              <img
                src="https://avatar.iran.liara.run/public/job/admin/male"
                alt="Admin"
                className="w-full h-full object-cover"
              />
            </div>
            {(isOpen || isMobileOpen) && (
              <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                <p className="text-sm font-bold text-gray-800 truncate">
                  System Admin
                </p>
                <p className="text-xs text-gray-500 truncate font-medium">
                  Administrator
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
