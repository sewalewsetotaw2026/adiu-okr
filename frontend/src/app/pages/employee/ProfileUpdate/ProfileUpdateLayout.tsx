import { useSelector } from "react-redux";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import SharedEmployeeProfile from "../../../components/employees/SharedEmployeeProfile";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import LoadingScreen from "../../../components/Core/ui/LoadingScreen";

export default function ProfileUpdateLayout() {
  const user = useSelector(selectAuthUser) as any;
  // user.employee might be null if not loaded yet or if pure admin, but this route is for employees
  const employeeId = user?.employee?.id;

  if (!employeeId) {
    // Logic if employee ID not found yet - maybe loading or issue
    return (
      <EmployeeLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <LoadingScreen />
        </div>
      </EmployeeLayout>
    );
  }

  return <SharedEmployeeProfile viewMode="employee" employeeId={employeeId} />;
}
