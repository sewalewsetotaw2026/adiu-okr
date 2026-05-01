import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import QuickActions from "../../../components/dashboard/QuickActions";
import LeaveBalanceCard from "../../../components/dashboard/LeaveBalanceCard";
import ToDoList from "../../../components/dashboard/ToDoList";
import AnnouncementCard from "../../../components/dashboard/AnnouncementCard";
import PaySlipWidget from "../../../components/dashboard/PaySlipWidget";
import CompanyOverviewChart from "../../../components/dashboard/CompanyOverviewChart";
import PageHeader from "../../../components/common/PageHeader";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import { getRoleNameById } from "../../../../utils/constants";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { authActions } from "../../../slice/authSlice";
import { useNavigate } from "react-router-dom";
import { useManagerSlice } from "../../../slice/managerSlice";
import { selectIsManager } from "../../../slice/managerSlice/selectors";
import TeamOnLeaveWidget from "../../../components/dashboard/TeamOnLeaveWidget";
import { getFileUrl } from "../../../utils/fileUtils";
import { MdPerson } from "react-icons/md";
export default function EmployeeDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectAuthUser) as any;
  const { actions: managerActions } = useManagerSlice();
  const isManager = useSelector(selectIsManager);

  useEffect(() => {
    dispatch(authActions.getMeRequest());
    dispatch(managerActions.checkIsManager());
  }, [dispatch, managerActions]);

  useEffect(() => {
    if (!user) return;
    if (user?.role?.name !== 'Employee' && user?.role_name !== 'Employee') return;
    const status = user?.onboarding_status;
    try {
      const override = sessionStorage.getItem("onboardingRedirectOverride");
      if (override) {
        if (status && !["PENDING", "IN_PROGRESS"].includes(status)) {
          sessionStorage.removeItem("onboardingRedirectOverride");
        }
        return;
      }
    } catch {
      // ignore
    }

    if (status === "PENDING_APPROVAL") {
      navigate("/employee/waiting-approval", { replace: true });
      return;
    }

    if (["PENDING", "IN_PROGRESS"].includes(status)) {
      navigate("/employee/onboarding", { replace: true });
      return;
    }
  }, [navigate, user]);

  const displayName = (() => {
    const fullName =
      user?.full_name ||
      user?.fullName ||
      user?.name ||
      user?.employee?.full_name ||
      user?.employee?.fullName ||
      null;

    if (fullName && String(fullName).trim()) return String(fullName).trim();

    const first = user?.first_name || user?.firstName || null;
    const last = user?.last_name || user?.lastName || null;
    const composed = [first, last].filter(Boolean).join(" ").trim();
    if (composed) return composed;

    const email = user?.email;
    if (email && typeof email === "string") {
      const prefix = email.split("@")[0];
      if (prefix) return prefix;
    }

    return "Employee";
  })();

  const roleLabel =
    (user?.role?.name || user?.role_name || user?.roleName) ??
    getRoleNameById(user?.role_id);

  return (
    <EmployeeLayout>
      <PageHeader>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-full bg-k-yellow border-4 border-white/20 flex items-center justify-center overflow-hidden shadow-lg ${!user?.profile_picture && !user?.employee?.profile_picture_url ? 'bg-primary-light text-primary' : ''}`}>
              {user?.profile_picture || user?.employee?.profile_picture_url ? (
                <img
                  src={getFileUrl(user?.profile_picture || user?.employee?.profile_picture_url)}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-primary">
                  {displayName?.charAt(0) || <MdPerson size={40} />}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                {displayName}
              </h1>
              <p className="text-white/90 font-medium">{String(roleLabel)}</p>
            </div>
          </div>
        </div>
      </PageHeader>

      <QuickActions />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <CompanyOverviewChart />
        <LeaveBalanceCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

        {isManager ? (
          <>
            <TeamOnLeaveWidget />
            <ToDoList />
          </>
        ) : (
          <>
            <ToDoList />
            <PaySlipWidget />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {isManager ? (
          <>
            <PaySlipWidget />
            <AnnouncementCard />
          </>
        ) : (
          <AnnouncementCard />
        )}
      </div>
    </EmployeeLayout>
  );
}
