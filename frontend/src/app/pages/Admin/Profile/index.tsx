import { useSelector } from "react-redux";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import SharedEmployeeProfile from "../../../components/employees/SharedEmployeeProfile";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import LoadingScreen from "../../../components/Core/ui/LoadingScreen";

export default function AdminProfile() {
  const user = useSelector(selectAuthUser) as any;
  const employeeId = user?.employee?.id;

  if (!employeeId) {
    return (
      <AdminLayout>
        <LoadingScreen />
      </AdminLayout>
    );
  }

  // Use 'admin' viewMode to maintain AdminLayout.
  return <SharedEmployeeProfile viewMode="admin" employeeId={employeeId} />;
}
