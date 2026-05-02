import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiMail,
  FiPhone,
  FiMapPin,
  FiBriefcase,
  FiUsers,
  FiChevronRight,
  FiUserPlus,
  FiTrash2,
  FiAlertCircle,
} from "react-icons/fi";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import Button from "../../../../components/Core/ui/Button";
import BackButton from "../../../../components/common/BackButton";
import Modal from "../../../../components/common/Modal";
import { useEmployeesSlice } from "../../Employees/slice";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import {
  selectSelectedEmployee,
  selectEmployeeDetails,
  selectEmployeesLoading,
} from "../../Employees/slice/selectors";
import { useManagerListSlice, managerListActions } from "../slice";
import {
  selectDirectReports,
  selectLoading as selectManagerListLoading,
  selectDirectReportsCache,
} from "../slice/selectors";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";

export default function ManagerDetailPage() {
  const { managerId } = useParams<{ managerId: string }>();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { actions } = useEmployeesSlice();
  useManagerListSlice(); // Inject ManagerList slice

  const [resolvedManagerId, setResolvedManagerId] = useState<string | null>(
    null
  );
  const [isResolvingId, setIsResolvingId] = useState(false);

  const effectiveManagerId = resolvedManagerId || managerId || null;

  // Reset resolved id when URL param changes
  useEffect(() => {
    setResolvedManagerId(null);
  }, [managerId]);

  // Cache lookups
  const detailsCache = useSelector(selectEmployeeDetails);
  const directReportsCache = useSelector(selectDirectReportsCache);
  const cachedManager = effectiveManagerId
    ? detailsCache[effectiveManagerId]?.data
    : null;
  const cachedDirectReports = effectiveManagerId
    ? directReportsCache[effectiveManagerId]?.data
    : [];

  const reduxManager = useSelector(selectSelectedEmployee);
  const employeeLoading = useSelector(selectEmployeesLoading);
  const reduxDirectReports = useSelector(selectDirectReports);
  const managerListLoading = useSelector(selectManagerListLoading);

  // Use redux data if available and not loading, otherwise fallback to cache for instant view
  const manager = reduxManager || cachedManager;
  const directReports =
    (managerListLoading && reduxDirectReports?.length === 0
      ? cachedDirectReports
      : reduxDirectReports) || [];

  // Only show full loader if we have NO data at all
  const loading =
    isResolvingId ||
    (employeeLoading && !manager) ||
    (managerListLoading && directReports.length === 0);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSubordinateId, setSelectedSubordinateId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    const looksLikeEmployeeCode = (value: string) =>
      /^EMP-/i.test(value.trim());

    const extractEmployeesArray = (response: any): any[] => {
      const data = response?.data;
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.employees)) return data.employees;
      if (Array.isArray(data?.data?.employees)) return data.data.employees;
      if (Array.isArray(data?.data?.data?.employees))
        return data.data.data.employees;
      return [];
    };

    const resolveEmployeeCodeToInternalId = async (employeeCode: string) => {
      const url = `${apiRoutes.employees}?search=${encodeURIComponent(
        employeeCode
      )}&page=1&limit=20`;
      const res = await makeCall({
        method: "GET",
        route: url,
        isSecureRoute: true,
      });

      const employees = extractEmployeesArray(res);
      const normalizedCode = employeeCode.trim().toUpperCase();

      const exact = employees.find(
        (e: any) =>
          String(e?.employee_id || "")
            .trim()
            .toUpperCase() === normalizedCode
      );
      const candidate = exact || employees[0];
      return candidate?.id ? String(candidate.id) : null;
    };

    const run = async () => {
      if (!managerId) return;

      setIsResolvingId(true);
      let targetId = managerId;

      try {
        if (looksLikeEmployeeCode(managerId)) {
          const resolved = await resolveEmployeeCodeToInternalId(managerId);
          if (resolved) targetId = resolved;
        }
      } catch (e) {
        // If resolution fails, fall back to using the raw id.
      }

      if (cancelled) return;

      setResolvedManagerId(targetId);
      dispatch(actions.fetchEmployeeRequest(targetId));
      dispatch(managerListActions.fetchDirectReportsRequest(targetId));
      setIsResolvingId(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [managerId, dispatch, actions]);

  const initiateRemove = (subId: string) => {
    setSelectedSubordinateId(subId);
    setDeleteModalOpen(true);
  };

  const confirmRemove = () => {
    if (selectedSubordinateId && effectiveManagerId) {
      dispatch(
        managerListActions.removeTeamMemberRequest({
          employee_id: selectedSubordinateId,
          manager_id: effectiveManagerId,
        })
      );
      setDeleteModalOpen(false);
      setSelectedSubordinateId(null);
      // Success toast is handled in saga usually, or we can add it here if we track success state
      // For now, saga handles refreshing the list.
    }
  };

  const handleNavigateToAssign = () => {
    if (effectiveManagerId) {
      navigate(`/admin/managers/${effectiveManagerId}/build-team`);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <LoadingSkeleton variant="rectangular" width="100%" height={400} />
        </div>
      </AdminLayout>
    );
  }

  if (!manager) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto py-8 px-4">
          <p className="text-center text-gray-500">Manager not found.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Helmet>
        <title>{(manager as any).full_name} | Manager Details</title>
      </Helmet>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        <BackButton
          label="Back to Managers"
          to="/admin/managers"
          className="mb-0"
        />

        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col md:flex-row items-start md:items-center gap-8 relative">
          {(employeeLoading || managerListLoading) && (
            <div className="absolute top-4 right-4 z-20">
              <LoadingSkeleton
                variant="rectangular"
                width={24}
                height={24}
                className="grayscale opacity-50"
              />
            </div>
          )}
          <div className="w-24 h-24 rounded-full bg-primary-light flex items-center justify-center text-3xl font-bold text-primary shrink-0 overflow-hidden">
            {manager.profile_picture_url ? (
              <img
                src={manager.profile_picture_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              manager.full_name?.charAt(0)
            )}
          </div>
          <div className="flex-1 space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {manager.full_name}
            </h1>
            <div className="flex flex-wrap gap-4 text-gray-500 text-sm font-medium">
              <div className="flex items-center gap-2">
                <FiBriefcase className="text-primary" />{" "}
                {manager.job_title || "No Job Title"}
              </div>
              <div className="flex items-center gap-2">
                <FiMapPin className="text-primary" />{" "}
                {manager.department || "No Department"}
              </div>
              <div className="flex items-center gap-2">
                <FiMail className="text-primary" />{" "}
                {manager.email || "No Email"}
              </div>
              {manager.phone && (
                <div className="flex items-center gap-2">
                  <FiPhone className="text-primary" /> {manager.phone}
                </div>
              )}
            </div>
          </div>

          <div className="bg-orange-50 px-6 py-4 rounded-xl flex flex-col items-center justify-center border border-orange-100 min-w-37.5">
            <span className="text-3xl font-black text-primary">
              {directReports.length}
            </span>
            <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">
              Direct Reports
            </span>
          </div>
        </div>

        {/* Subordinates Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiUsers className="text-primary" /> Direct Reports
              </h2>
              <p className="text-sm text-gray-500">
                Employees reporting directly to this manager.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={handleNavigateToAssign}
              icon={FiUserPlus}
              className="text-sm px-4 py-2"
            >
              Add Team Member
            </Button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {directReports.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <FiUsers className="text-4xl text-gray-300" />
                          <p>No direct reports found.</p>
                          <Button
                            variant="link"
                            onClick={handleNavigateToAssign}
                            className="mt-2 text-xs"
                          >
                            Assign Employees
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    directReports.map((sub: any) => (
                      <tr
                        key={sub.id}
                        className="hover:bg-gray-50 transition-colors group"
                      >
                        <td className="px-6 py-4 font-bold text-gray-800">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                              {sub.profile_picture_url ? (
                                <img
                                  src={sub.profile_picture_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                sub.full_name?.charAt(0)
                              )}
                            </div>
                            <div>
                              <p>{sub.full_name}</p>
                              <p className="text-xs text-gray-400 font-normal">
                                {sub.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 font-medium">
                          {sub.job_title}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">
                            {sub.department}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => initiateRemove(sub.id)}
                              className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
                              title="Remove from Team"
                            >
                              <FiTrash2 />
                            </button>
                            <button
                              onClick={() =>
                                navigate(`/admin/employees/${sub.id}`)
                              }
                              className="text-gray-400 hover:text-primary p-2 rounded-full hover:bg-primary-light transition-colors"
                              title="View Profile"
                            >
                              <FiChevronRight />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title=""
        size="md"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <FiAlertCircle className="text-2xl text-red-600" />
          </div>

          <h3 className="text-xl font-bold text-gray-900">
            Remove Team Member?
          </h3>
          <p className="text-gray-500">
            Are you sure you want to remove this employee from{" "}
            {manager.full_name}'s team?
          </p>

          <div className="grid grid-cols-2 gap-3 w-full mt-4">
            <Button
              variant="secondary"
              className="h-11 px-4 text-sm"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmRemove}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
