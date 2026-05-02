import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { selectAuthUser } from "../../slice/authSlice/selectors";
import { useAuthSlice } from "../../slice/authSlice";
import { CompanyList } from "./CompanyList";
import { RegisterCompany } from "./RegisterCompany";
import { EditCompany } from "./EditCompany";
import { SUPER_ADMIN_ROLES } from "../../../utils/constants";

export const SuperAdminLayout = () => {
  const dispatch = useDispatch();
  const { actions } = useAuthSlice();
  const navigate = useNavigate();
  const user = useSelector(selectAuthUser);

  // Hard check for Super Admin
  const roleName = user?.role?.name || user?.role_name || '';
  const isSuperAdmin = SUPER_ADMIN_ROLES.includes(roleName);

  if (user?.company_code !== "PLATFORM" || !isSuperAdmin) {
    // If user is not super admin, redirect to respective dashboard
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleLogout = () => {
    dispatch(actions.logout());
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <span className="text-white font-bold text-xl">SA</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">Platform Admin</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Signed in as <span className="font-semibold text-gray-700">{user.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-100 transition-colors font-medium border border-red-200"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="flex-1 p-6 overflow-auto">
        <Routes>
          <Route path="companies" element={<CompanyList />} />
          <Route path="register" element={<RegisterCompany />} />
          <Route path="edit/:id" element={<EditCompany />} />
          <Route path="*" element={<Navigate to="companies" />} />
        </Routes>
      </main>
    </div>
  );
};
