import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import { useManagerSlice } from "../../../slice/managerSlice";
import { selectTeamMembers, selectManagerLoading } from "../../../slice/managerSlice/selectors";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import LoadingSkeleton from "../../../components/common/LoadingSkeleton";
import { getFileUrl } from "../../../utils/fileUtils";
import { MdPerson, MdArrowForward } from "react-icons/md";
import { FiUsers } from "react-icons/fi";

interface MyTeamProps {
  isEmbedded?: boolean;
}

export default function MyTeam({ isEmbedded = false }: MyTeamProps) {
  const { actions: managerActions } = useManagerSlice();
  const dispatch = useDispatch();
  const teamMembers = useSelector(selectTeamMembers);
  const loading = useSelector(selectManagerLoading);
  const user = useSelector(selectAuthUser);
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(managerActions.getMyTeam());
  }, [dispatch, managerActions]);

  const roleName = (user?.role?.name || user?.role_name || "").toUpperCase();
  const isAdminOrHR = roleName === "ADMIN" || roleName === "HR";

  const getProfilePath = (employeeId: string) => {
    return isAdminOrHR 
      ? `/admin/employees/${employeeId}` 
      : `/manager/my-team/${employeeId}`;
  };

  // Helper to get initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Helper for random gradient based on name length (for consistent but varied look)
  // Updated to use brand colors (Orange/Yellow/Dark Grey/Amber)
  const getGradient = (name: string) => {
    const gradients = [
      "from-primary to-primary-dark", // Dynamic Primary Gradient
      "from-amber-500 to-orange-600",
      "from-orange-400 to-amber-300",
      "from-primary-dark to-primary",
    ];
    // Use name char code sum to pick deterministic gradient
    const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % gradients.length;
    return gradients[index];
  };

  const content = (
    <>
      {!isEmbedded && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-k-dark-grey flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FiUsers className="text-k-orange w-6 h-6" />
            </div>
            My Team
          </h1>
          <p className="text-gray-500 text-sm mt-2 ml-14">
            Overview of your direct reports and team members.
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <LoadingSkeleton variant="card" count={3} />
        </div>
      ) : teamMembers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MdPerson className="text-3xl text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No Team Members</h3>
          <p className="text-gray-500 mt-1">
            You don't have any direct reports assigned yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              onClick={() => navigate(getProfilePath(member.employee_id || member.employee.id))}
              className="group bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start gap-4 mb-4">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getGradient(member.employee.full_name)} p-[2px] shadow-sm shrink-0`}>
                  <div className="w-full h-full rounded-xl bg-white flex items-center justify-center overflow-hidden">
                    {(member.employee as any).profile_picture_url ? (
                      <img
                        src={getFileUrl((member.employee as any).profile_picture_url)}
                        alt={member.employee.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className={`text-sm font-bold bg-clip-text text-transparent bg-gradient-to-br ${getGradient(member.employee.full_name)}`}>
                        {getInitials(member.employee.full_name)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900 group-hover:text-k-orange transition-colors truncate">
                    {member.employee.full_name}
                  </h3>
                  <p className="text-xs font-medium text-gray-500 truncate">
                    {member.jobTitle?.title || "No Job Title"}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 h-9 rounded-lg flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider group-hover:text-k-orange flex items-center gap-2">
                  View Profile <MdArrowForward className="text-sm" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return isEmbedded ? content : <EmployeeLayout>{content}</EmployeeLayout>;
}
