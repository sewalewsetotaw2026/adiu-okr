import { useState } from "react";
import { useSelector } from "react-redux";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import { FiUsers } from "react-icons/fi";
import { MdCalendarToday, MdReplay } from "react-icons/md";
import MyTeam from "../MyTeam";
import TeamLeaveApplications from "../TeamLeaveApplications";
import LeaveRecallPage from "../../employee/LeaveRecall";

type TabId = "team" | "leaves" | "recall";

export default function TeamManagement() {
  const [activeTab, setActiveTab] = useState<TabId>("team");
  const user = useSelector(selectAuthUser);

  const roleName = (user?.role?.name || user?.role_name || "").toUpperCase();
  const isAdminOrHR = roleName === "ADMIN" || roleName === "HR";

  const Layout = isAdminOrHR ? AdminLayout : EmployeeLayout;

  return (
    <Layout>
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-k-dark-grey flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <FiUsers className="text-k-orange w-6 h-6" />
              </div>
              Team Management
            </h1>
            <p className="text-gray-500 text-sm mt-2 ml-14">
              Manage your direct reports, leave requests, and team availability.
            </p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl self-end md:self-auto">
            <button
              onClick={() => setActiveTab("team")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "team"
                  ? "bg-white text-primary shadow-sm"
                  : "text-gray-500 hover:text-primary"
              }`}
            >
              <FiUsers size={18} />
              About Team
            </button>
            <button
              onClick={() => setActiveTab("leaves")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "leaves"
                  ? "bg-white text-primary shadow-sm"
                  : "text-gray-500 hover:text-primary"
              }`}
            >
              <MdCalendarToday size={18} />
              Leave Requests
            </button>
            <button
              onClick={() => setActiveTab("recall")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "recall"
                  ? "bg-white text-primary shadow-sm"
                  : "text-gray-500 hover:text-primary"
              }`}
            >
              <MdReplay size={18} />
              Leave Recall
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === "team" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <MyTeamContent />
          </div>
        )}
        {activeTab === "leaves" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <TeamLeavesContent key="pending" defaultTab="pending" />
          </div>
        )}
        {activeTab === "recall" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <LeaveRecallPage isEmbedded />
          </div>
        )}
      </div>
    </Layout>
  );
}

// Wrapper to strip layout from existing pages for embedding
function MyTeamContent() {
  return <MyTeam isEmbedded />;
}

function TeamLeavesContent({
  defaultTab,
}: {
  defaultTab: "pending" | "on_leave";
}) {
  return <TeamLeaveApplications isEmbedded defaultTab={defaultTab} />;
}
