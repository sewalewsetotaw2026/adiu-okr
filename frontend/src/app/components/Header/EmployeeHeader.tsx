import { MdMenu } from "react-icons/md";
import NotificationBell from "../Notification/NotificationBell";
import { useSidebar } from "../../context/SidebarContext";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../slice/authSlice/selectors";
import { getRoleNameById, routeConstants } from "../../../utils/constants";
import { getFileUrl } from "../../utils/fileUtils";
import { Link } from "react-router-dom";

export default function EmployeeHeader() {
  const { toggleMobile } = useSidebar();
  const user = useSelector(selectAuthUser) as any;

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

  const roleLabel = getRoleNameById(user?.role_id);

  return (
    <div className="w-full h-20 bg-white shadow-md flex items-center justify-between px-4 md:px-8 relative">
      <div className="flex items-center gap-4 md:gap-6">
        {/* Mobile menu toggle - only visible on mobile */}
        <button
          onClick={toggleMobile}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-full lg:hidden"
        >
          <MdMenu size={28} />
        </button>

        <h2 className="text-lg md:text-xl font-semibold text-gray-700 whitespace-nowrap">
          Welcome, {displayName}
        </h2>
      </div>

      <div className="flex items-center gap-4 md:gap-8">
        <NotificationBell />

        <Link to={routeConstants.employeeProfile} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
          <img
            src={getFileUrl(user?.employee?.profile_picture_url || user?.profile_picture_url)}
            alt="Employee"
            className="w-9 h-9 md:w-12 md:h-12 rounded-full border border-gray-300 object-cover"
          />

          <div className="hidden md:block text-sm text-[#333]">
            <p className="font-semibold">{displayName}</p>
            <p className="text-xs text-gray-500">{roleLabel}</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
