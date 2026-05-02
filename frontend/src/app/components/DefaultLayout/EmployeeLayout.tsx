import EmployeeSidebar from "../Sidebars/EmployeeSidebar";
import EmployeeHeader from "../Header/EmployeeHeader";
import AdminSidebar from "../Sidebars/AdminSidebar";
import AdminHeader from "../Header/AdminHeader";
import { useSidebar } from "../../context/SidebarContext";
import { useCompanyTheme } from "../../hooks/useCompanyTheme";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../slice/authSlice/selectors";

interface EmployeeLayoutProps {
  children: React.ReactNode;
  forceEmployeeSidebar?: boolean;
}

export default function EmployeeLayout({ children, forceEmployeeSidebar }: EmployeeLayoutProps) {
  const { isOpen } = useSidebar();
  useCompanyTheme();
  const user = useSelector(selectAuthUser) as any;

  const isAdmin = ["Admin", "Super Admin"].includes(user?.role?.name) || ["Admin", "Super Admin"].includes(user?.role_name) || [1, 2].includes(user?.role_id);
  const isHR = user?.role?.name === "HR" || user?.role_name === "HR" || user?.role_id === 3 || user?.role_id === 4;

  const showAdminUI = (isAdmin || isHR) && !forceEmployeeSidebar;

  const Sidebar = showAdminUI ? AdminSidebar : EmployeeSidebar;
  const Header = showAdminUI ? AdminHeader : EmployeeHeader;

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[#F5F5F5] print:h-auto print:overflow-visible">
      <Sidebar />

      <div
        className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ${isOpen ? "lg:ml-72" : "lg:ml-24"
          } print:ml-0 print:h-auto print:overflow-visible`}
      >
        <Header />

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 print:h-auto print:overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
}
