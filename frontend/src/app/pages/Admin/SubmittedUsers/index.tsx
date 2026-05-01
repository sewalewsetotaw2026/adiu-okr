import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useSubmittedUsersSlice } from "./slice";
import {
  selectSubmittedUsers,
  selectSubmittedUsersLoading,
  selectApproving,
} from "./slice/selectors";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import BackButton from "../../../components/common/BackButton";
import LoadingSkeleton from "../../../components/common/LoadingSkeleton";
import useMinimumDelay from "../../../hooks/useMinimumDelay";
import { ActionMenu } from "../../../components/common/ActionMenu";
import Modal from "../../../components/common/Modal";
import Button from "../../../components/Core/ui/Button";
import {
  FiMail,
  FiPhone,
  FiEye,
  FiCheck,
  FiX,
  FiClock,
  FiUserCheck,
} from "react-icons/fi";
import { SubmittedUser } from "./slice/types";
import { routeConstants } from "../../../../utils/constants";
import { formatDate } from "../../../utils/dayjs-format";

export default function SubmittedUsers() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { actions } = useSubmittedUsersSlice();

  const users = useSelector(selectSubmittedUsers) || [];
  const isLoading = useSelector(selectSubmittedUsersLoading);
  const isApproving = useSelector(selectApproving);

  const showLoading = useMinimumDelay(isLoading, 800);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [userToApprove, setUserToApprove] = useState<SubmittedUser | null>(
    null,
  );

  useEffect(() => {
    dispatch(actions.fetchSubmittedUsersRequest());
  }, [dispatch, actions]);

  const handleViewProfile = (user: SubmittedUser) => {
    // Navigate to detail page
    navigate(`/admin/users/submitted/${user.employee_id}`);
  };

  const handleApproveClick = (user: SubmittedUser) => {
    setUserToApprove(user);
    setApproveModalOpen(true);
  };

  const handleApproveConfirm = () => {
    if (!userToApprove) return;
    dispatch(
      actions.approveUserRequest({
        userId: userToApprove.id,
        employeeId: userToApprove.employee_id,
      }),
    );
    setApproveModalOpen(false);
    setUserToApprove(null);
  };

  const handleApproveCancel = () => {
    if (isApproving) return;
    setApproveModalOpen(false);
    setUserToApprove(null);
  };

  const handleReject = (user: SubmittedUser) => {
    if (
      window.confirm(
        `Are you sure you want to reject ${user.employee?.full_name}?`,
      )
    ) {
      dispatch(
        actions.rejectUserRequest({
          userId: user.id,
          employeeId: user.employee_id,
        }),
      );
    }
  };

  const getGenderLabel = (gender: string | null) => {
    if (!gender) return "N/A";
    return gender;
  };

  const getPrimaryPhone = (phones: any[]) => {
    if (!phones || phones.length === 0) return "N/A";
    const primary = phones.find((p) => p.is_primary);
    return primary?.phone_number || phones[0]?.phone_number || "N/A";
  };

  const getAvatarUrl = (gender: string | null, id: string) => {
    const num =
      (id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 50) +
      1;
    const offset = gender ? 50 : 0;
    return `https://avatar.iran.liara.run/public/${num + offset}`;
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <BackButton to={routeConstants.employees} label="Back to Employees" />

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-k-dark-grey">
              Submitted Users
            </h1>
            <p className="text-gray-500 mt-1">
              Review and approve users who have completed their profile
              submission
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl border border-amber-100">
              <FiClock className="w-5 h-5 text-amber-600" />
              <span className="font-semibold text-amber-700">
                {users.length}
              </span>
              <span className="text-amber-600">Pending Review</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <FiClock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-k-dark-grey">
                  {users.length}
                </p>
                <p className="text-sm text-gray-500">Awaiting Review</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <FiUserCheck className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-k-dark-grey">-</p>
                <p className="text-sm text-gray-500">Approved Today</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <FiX className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-k-dark-grey">-</p>
                <p className="text-sm text-gray-500">Rejected Today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Submitted Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {showLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-6 py-4">
                        <LoadingSkeleton variant="table-row" />
                      </td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <FiUserCheck className="w-12 h-12 text-gray-300" />
                        <p>No pending submissions</p>
                        <p className="text-sm">
                          All submissions have been reviewed!
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user: SubmittedUser) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.employee?.documents?.photo?.[0] ? (
                            <img
                              src={user.employee.documents.photo[0]}
                              alt={user.employee.full_name}
                              className="w-10 h-10 rounded-full bg-gray-100 object-cover border-2 border-white shadow-sm"
                            />
                          ) : (
                            <img
                              src={getAvatarUrl(
                                user.employee?.gender,
                                user.employee_id,
                              )}
                              alt={user.employee?.full_name}
                              className="w-10 h-10 rounded-full bg-gray-100 object-cover border-2 border-white shadow-sm"
                            />
                          )}
                          <div>
                            <p className="font-medium text-k-dark-grey">
                              {user.employee?.full_name || "N/A"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {getGenderLabel(user.employee?.gender)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {user.employee_id}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <FiMail className="w-3 h-3" />
                            {user.email}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <FiPhone className="w-3 h-3" />
                            {getPrimaryPhone(user.employee?.phones)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600">
                          {formatDate(user.updated_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <FiClock className="w-3 h-3 mr-1" />
                          Submitted
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ActionMenu
                          actions={[
                            {
                              label: "View Details",
                              value: "view",
                              icon: <FiEye className="w-4 h-4" />,
                              onClick: () => handleViewProfile(user),
                            },
                            {
                              label: "Approve",
                              value: "approve",
                              icon: <FiCheck className="w-4 h-4" />,
                              onClick: () => handleApproveClick(user),
                            },
                            {
                              label: "Reject",
                              value: "reject",
                              icon: <FiX className="w-4 h-4" />,
                              variant: "danger",
                              onClick: () => handleReject(user),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!isLoading && users.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
              <span className="text-sm text-gray-500">
                Showing {users.length} submission{users.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        <Modal
          isOpen={approveModalOpen}
          onClose={handleApproveCancel}
          title="Approve Employee"
          size="sm"
        >
          <p className="text-sm text-gray-600">
            Are you sure you want to approve{" "}
            <span className="font-semibold text-k-dark-grey">
              {userToApprove?.employee?.full_name || userToApprove?.employee_id}
            </span>
            ?
          </p>
          <div className="flex justify-end gap-3 pt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={handleApproveCancel}
              disabled={isApproving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleApproveConfirm}
              loading={isApproving}
              disabled={isApproving}
              icon={FiCheck}
            >
              Approve
            </Button>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
