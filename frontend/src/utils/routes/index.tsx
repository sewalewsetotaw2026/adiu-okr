import { routeConstants } from "../constants";
import AdminDashboard from "../../app/pages/Admin/Dashboard";
import CreateUser from "../../app/pages/Admin/CreateAccount";
import CreateEmployment from "../../app/pages/Admin/CreateEmployment";
import Departments from "../../app/pages/Admin/Departments";
import Employees from "../../app/pages/Admin/Employees";
import EmployeeDetail from "../../app/pages/Admin/EmployeeDetail";
import FullEmployeeProfile from "../../app/pages/Admin/FullEmployeeProfile";
import SubmittedUsers from "../../app/pages/Admin/SubmittedUsers";
import SubmittedUserDetail from "../../app/pages/Admin/SubmittedUserDetail";
import PendingUsers from "../../app/pages/Admin/PendingUsers";
import LeaveManagement from "../../app/pages/Admin/LeaveManagement";
import LeaveTypes from "../../app/pages/Admin/LeaveTypes";
import PublicHolidays from "../../app/pages/Admin/PublicHolidays";
import LeaveSettings from "../../app/pages/Admin/LeaveSettings";
import AdminManagers from "../../app/pages/Admin/Managers";
import AdminConnectManager from "../../app/pages/Admin/Managers/AssignManager";
import ManagerDetail from "../../app/pages/Admin/Managers/Detail";
import BuildTeamPage from "../../app/pages/Admin/Managers/BuildTeam";
import PromotionPage from "../../app/pages/Admin/Employees/Promotion";
import EmployeeSettingsPage from "../../app/pages/Admin/Employees/EmployeeSettingsPage";
import WaitingApproval from "../../app/pages/employee/WaitingApproval";
import EmployeeDashboard from "../../app/pages/employee/Dashboard";
import Login from "../../app/pages/Authentication/Login";
import EmployeeLogin from "../../app/pages/Authentication/EmployeeLogin";
import AdminLogin from "../../app/pages/Authentication/AdminLogin";
import ForgotPassword from "../../app/pages/Authentication/ForgotPassword";
import ResetPassword from "../../app/pages/Authentication/ResetPassword";
import SetupAccount from "../../app/pages/Authentication/SetupAccount";
import EmployeeOnboarding from "../../app/pages/employee/Onboarding";
import LeaveApplication from "../../app/pages/employee/LeaveApplication";
import LeaveRecall from "../../app/pages/employee/LeaveRecall";
import LeaveCashOut from "../../app/pages/employee/LeaveCashOut";
import ProfileUpdateLayout from "../../app/pages/employee/ProfileUpdate/ProfileUpdateLayout";
import EmployeeSettings from "../../app/pages/employee/Settings";
import Settings from "../../app/pages/Admin/Settings";
import NotFound from "../../app/pages/ErrorDisplayPage/NotFound";
import NoAuthorized from "../../app/pages/ErrorDisplayPage/NoAuthorized";
import MyTeam from "../../app/pages/Manager/MyTeam";
import TeamLeaveApplications from "../../app/pages/Manager/TeamLeaveApplications";
import TeamManagement from "../../app/pages/Manager/TeamManagement";
import AdminProfile from "../../app/pages/Admin/Profile";
import SharedEmployeeProfile from "../../app/components/employees/SharedEmployeeProfile";
import { DepartmentTree } from "../../app/pages/Manager/DepartmentTree";
import CelebrationPage from "../../app/pages/Celebration/CelebrationPage";
import RoleManagement from "../../app/pages/Admin/Roles/RoleManagement";
import { SuperAdminLayout } from "../../app/pages/SuperAdmin/SuperAdminLayout";
import SuperAdminLogin from "../../app/pages/Authentication/SuperAdminLogin";
import FinancialRollup from "../../app/pages/Admin/FinancialRollup";

import OKRDashboard from "../../app/pages/Admin/OKR";
import CycleManagement from "../../app/pages/Admin/OKR/CycleManagement";
import CompanyObjectives from "../../app/pages/Admin/OKR/CompanyObjectives";
import ObjectiveDetail from "../../app/pages/Admin/OKR/ObjectiveDetail";
import DepartmentPlanningList from "../../app/pages/Admin/OKR/DepartmentPlanning";
import DepartmentPlanningDetail from "../../app/pages/Admin/OKR/DepartmentPlanning/DepartmentDetail";
import CEOStrategicDashboardPage from "../../app/pages/Admin/OKR/CEOStrategicDashboard";
import DepartmentComparisonPage from "../../app/pages/Admin/OKR/DepartmentComparison";
import CompanyOKRGalleryPage from "../../app/pages/Admin/OKR/CompanyOKRGallery";
import OKRConfigurationPage from "../../app/pages/Admin/OKR/Configuration";
import ArchiveManagementPage from "../../app/pages/Admin/OKR/ArchiveManagement";
import ArchiveDetailReportsPage from "../../app/pages/Admin/OKR/ArchiveDetailReports";
import AnnualReportingPage from "../../app/pages/Admin/OKR/AnnualReporting";
import OkrAuditLogsPage from "../../app/pages/Admin/OKR/AuditLogs";
import OkrAuditSnapshotDetailPage from "../../app/pages/Admin/OKR/AuditSnapshotDetail";

import ContributorAssignmentPage from "../../app/pages/OKRExecution/ContributorAssignment";
import MyExecutionDashboardPage from "../../app/pages/OKRExecution/MyExecutionDashboard";
import EmployeeObjectiveDetailPage from "../../app/pages/OKRExecution/EmployeeObjectiveDetail";
import TeamExecutionMonitorPage from "../../app/pages/OKRExecution/TeamExecutionMonitor";
import PlanningCompliancePage from "../../app/pages/OKRExecution/TeamExecutionMonitor/PlanningCompliance";
import ApprovalQueuePage from "../../app/pages/OKRExecution/ApprovalQueue";
import DepartmentApprovalQueuePage from "../../app/pages/Admin/OKR/DepartmentApprovalQueue";
import ReviewDashboard from "../../app/pages/OKRExecution/ReviewerPanel";
import ReviewDetail from "../../app/pages/OKRExecution/ReviewerPanel/ReviewDetail";
import OKRImportExportPage from "../../app/pages/OKRExecution/ImportExport";

import { IRoute } from "./types";

export const routes: IRoute[] = [
  {
    path: routeConstants.login,
    element: <Login />,
    isAuthenticated: false,
  },
  {
    path: routeConstants.forgotPassword,
    element: <ForgotPassword />,
    isAuthenticated: false,
  },
  {
    path: routeConstants.resetPassword,
    element: <ResetPassword />,
    isAuthenticated: false,
  },
  {
    path: routeConstants.setupAccount,
    element: <SetupAccount />,
    isAuthenticated: false,
  },
  {
    path: routeConstants.home,
    element: <Login />,
    isAuthenticated: false,
  },
  {
    path: routeConstants.employeeLogin,
    element: <EmployeeLogin />,
    isAuthenticated: false,
  },
  {
    path: routeConstants.adminLogin,
    element: <AdminLogin />,
    isAuthenticated: false,
  },
  {
    path: routeConstants.dashboard,
    element: <AdminDashboard />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.financialRollup,
    element: <FinancialRollup />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.createUser,
    element: <CreateUser />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.createEmployment,
    element: <CreateEmployment />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.employees,
    element: <Employees />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.employeeDetail,
    element: <EmployeeDetail />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.fullEmployeeProfile,
    element: <FullEmployeeProfile />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: "/admin/managers",
    element: <AdminManagers />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.assignManager,
    element: <AdminConnectManager />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.managerDetail,
    element: <ManagerDetail />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.buildTeam,
    element: <BuildTeamPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.submittedUsers,
    element: <SubmittedUsers />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.submittedUserDetail,
    element: <SubmittedUserDetail />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.pendingUsers,
    element: <PendingUsers />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.employeeDashboard,
    element: <EmployeeDashboard />,
    isAuthenticated: true,
    allowedRoles: [3, "Employee", "HR"],
  },
  {
    path: routeConstants.departments,
    element: <Departments />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.employeeOnboarding,
    element: <EmployeeOnboarding />,
    isAuthenticated: true,
    allowedRoles: [3, "Employee", "HR"],
  },
  {
    path: routeConstants.waitingApproval,
    element: <WaitingApproval />,
    isAuthenticated: true,
    allowedRoles: [3, "Employee", "HR"],
  },
  {
    path: routeConstants.promoteEmployee,
    element: <PromotionPage />,
    isAuthenticated: true,
    allowedRoles: [1, "Admin"],
  },
  {
    path: routeConstants.adminEmployeeSettings,
    element: <EmployeeSettingsPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.employeeLeave,
    element: <LeaveApplication />,
    isAuthenticated: true,
    allowedRoles: [3, "Employee", "HR"],
  },
  {
    path: routeConstants.employeeLeaveHistory,
    element: <LeaveApplication />,
    isAuthenticated: true,
    allowedRoles: [3, "Employee", "HR"],
  },
  {
    path: routeConstants.employeeLeaveRecall,
    element: <LeaveRecall />,
    isAuthenticated: true,
    allowedRoles: [3, "Employee", "HR"],
  },
  {
    path: routeConstants.employeeLeaveCashOut,
    element: <LeaveCashOut />,
    isAuthenticated: true,
    allowedRoles: [3, "Employee", "HR"],
  },
  {
    path: routeConstants.employeeProfile,
    element: <ProfileUpdateLayout />,
    isAuthenticated: true,
    allowedRoles: [3, "Employee", "HR"],
  },
  {
    path: routeConstants.employeeSettings,
    element: <EmployeeSettings />,
    isAuthenticated: true,
    allowedRoles: [3, "Employee", "HR"],
  },
  {
    path: routeConstants.adminProfile,
    element: <AdminProfile />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.settings,
    element: <Settings />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.adminLeaves,
    element: <LeaveManagement />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.adminLeaveTypes,
    element: <LeaveTypes />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.adminPublicHolidays,
    element: <PublicHolidays />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.adminLeaveSettings,
    element: <LeaveSettings />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.roleManagement,
    element: <RoleManagement />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.managerMyTeam,
    element: <MyTeam />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: "/manager/my-team/:employeeId",
    element: <SharedEmployeeProfile viewMode="manager" />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: routeConstants.managerTeamLeaves,
    element: <TeamLeaveApplications />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: routeConstants.managerDepartmentTree,
    element: <DepartmentTree />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: "/manager/team-management",
    element: <TeamManagement />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: routeConstants.employeeDepartmentTree,
    element: <DepartmentTree />,
    isAuthenticated: true,
    allowedRoles: [3, "Employee", "HR"],
  },
  // Super Admin
  {
    path: "/super-admin/login",
    element: <SuperAdminLogin />,
    isAuthenticated: false,
  },
  {
    path: "/super-admin/*",
    element: <SuperAdminLayout />,
    isAuthenticated: true,
  },
  // Celebration System
  {
    path: "/celebrations/:id",
    element: <CelebrationPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: routeConstants.noAuthorized,
    element: <NoAuthorized />,
    isAuthenticated: false,
  },
  {
    path: routeConstants.notFound,
    element: <NotFound />,
    isAuthenticated: false,
  },

  {
    path: routeConstants.okr,
    element: <OKRDashboard />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },

  {
    path: routeConstants.okrCycles,
    element: <CycleManagement />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },

  {
    path: routeConstants.okrCreateCycle,
    element: <CycleManagement />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },

  {
    path: routeConstants.okrCycleDetail,
    element: <CycleManagement />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },

  // =========================
  // COMPANY OBJECTIVES
  // =========================

  {
    path: routeConstants.okrObjectives,
    element: <CompanyObjectives />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },

  {
    path: routeConstants.okrObjectiveDetail,
    element: <ObjectiveDetail />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: routeConstants.okrDepartmentPlanning,
    element: <DepartmentPlanningList />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.okrDepartmentDetail,
    element: <DepartmentPlanningDetail />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },

  {
    path: routeConstants.okrCeoStrategicDashboard,
    element: <CEOStrategicDashboardPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.okrDepartmentComparison,
    element: <DepartmentComparisonPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.okrCompanyGallery,
    element: <CompanyOKRGalleryPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.okrConfiguration,
    element: <OKRConfigurationPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.okrArchiveManagement,
    element: <ArchiveManagementPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.okrArchiveDetail,
    element: <ArchiveDetailReportsPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.okrAnnualReporting,
    element: <AnnualReportingPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.okrAuditLogs,
    element: <OkrAuditLogsPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },
  {
    path: routeConstants.okrConfigSnapshotDetail,
    element: <OkrAuditSnapshotDetailPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, "Admin", "HR"],
  },

  {
    path: routeConstants.okrManagerDepartmentPlanning,
    element: <DepartmentPlanningDetail />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: routeConstants.okrContributorAssignment,
    element: <ContributorAssignmentPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: routeConstants.okrMyExecution,
    element: <MyExecutionDashboardPage />,
    isAuthenticated: true,
    allowedRoles: [3, 4, "Employee", "Manager", "HR"],
  },
  {
    path: routeConstants.okrEmployeeObjectiveDetail,
    element: <EmployeeObjectiveDetailPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, 4, "Admin", "HR", "Employee", "Manager"],
  },
  {
    path: routeConstants.okrTeamExecutionMonitor,
    element: <TeamExecutionMonitorPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: routeConstants.okrPlanningCompliance,
    element: <PlanningCompliancePage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: routeConstants.okrApprovalQueue,
    element: <ApprovalQueuePage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, "Admin", "HR", "Employee"],
  },
  {
    path: routeConstants.okrDepartmentApprovalQueue,
    element: <DepartmentApprovalQueuePage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 4, "Admin", "HR"],
  },
  {
    path: routeConstants.okrReviews,
    element: <ReviewDashboard />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 4, "Admin", "HR", "Manager", "CEO"],
  },
  {
    path: routeConstants.okrReviewDetail,
    element: <ReviewDetail />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 4, "Admin", "HR", "Manager", "CEO"],
  },
  {
    path: routeConstants.okrImportExport,
    element: <OKRImportExportPage />,
    isAuthenticated: true,
    allowedRoles: [1, 2, 3, 4, "Admin", "HR", "Employee", "Manager"],
  },
];
