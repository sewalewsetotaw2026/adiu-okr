import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useDepartments } from "./slice";
import {
  selectDepartments,
  selectDepartmentsLoading,
  selectDepartmentsPagination,
} from "./slice/selectors";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import Button from "../../../components/Core/ui/Button";
import Modal from "../../../components/common/Modal";
import FormField from "../../../components/common/FormField";
import { FiPlus, FiTrash2, FiUserCheck } from "react-icons/fi";
import ToastService from "../../../../utils/ToastService";
import DataTable from "../../../components/common/DataTable";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";

export default function Departments() {
  const { actions } = useDepartments();
  const dispatch = useDispatch();
  const departments = useSelector(selectDepartments);
  const isLoading = useSelector(selectDepartmentsLoading);
  const pagination = useSelector(selectDepartmentsPagination);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<any>(null);

  // Assign Head State
  const [isHeadModalOpen, setIsHeadModalOpen] = useState(false);
  const [targetDepartment, setTargetDepartment] = useState<any>(null);
  const [deptEmployees, setDeptEmployees] = useState<any[]>([]);
  const [isFetchingEmps, setIsFetchingEmps] = useState(false);
  const [selectedHeadId, setSelectedHeadId] = useState<string>("");

  const page = pagination?.page || 1;

  useEffect(() => {
    dispatch(actions.fetchDepartmentsStart({ page, limit: 10 }));
  }, [dispatch, actions, page]);

  const handlePageChange = (newPage: number) => {
    dispatch(actions.fetchDepartmentsStart({ page: newPage, limit: 10 }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepartmentName.trim()) return;

    dispatch(actions.createDepartmentRequest({ name: newDepartmentName }));
    setNewDepartmentName("");
    setIsModalOpen(false);
    ToastService.success("Department creation started");
  };

  const handleDelete = () => {
    if (departmentToDelete) {
      dispatch(actions.deleteDepartmentRequest(departmentToDelete.id));
      setIsDeleteModalOpen(false);
      setDepartmentToDelete(null);
      ToastService.success("Delete request submitted");
    }
  };

  const openAssignHead = async (dept: any) => {
    setTargetDepartment(dept);
    setSelectedHeadId(dept.head_user_id?.toString() || "");
    setIsHeadModalOpen(true);
    setIsFetchingEmps(true);
    try {
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.employees,
        query: { department_id: dept.id, limit: 200, is_active: true, include_admins: true },
        isSecureRoute: true,
      });
      // Extract employees from response structure
      const emps = res?.data?.data?.employees || res?.data?.data || [];
      setDeptEmployees(Array.isArray(emps) ? emps : []);
    } catch (err) {
      ToastService.error("Failed to fetch department employees");
    } finally {
      setIsFetchingEmps(false);
    }
  };

  const handleAssignHead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHeadId || !targetDepartment) return;

    dispatch(actions.assignHeadRequest({
      departmentId: targetDepartment.id,
      headUserId: parseInt(selectedHeadId)
    }));
    setIsHeadModalOpen(false);
    ToastService.success("Assigning department head...");
  };

  const employeeOptions = useMemo(() => {
    return deptEmployees.map(emp => {
      // Find User ID. Backend logic uses app_user.id for assignment.
      const userId = emp.user?.id || emp.app_user_id || emp.appUserId;
      return {
        value: userId?.toString(),
        label: emp.full_name || emp.employee?.full_name || "Unknown",
      };
    }).filter(opt => opt.value);
  }, [deptEmployees]);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Departments</h1>
          <Button onClick={() => setIsModalOpen(true)} icon={FiPlus}>
            Add Department
          </Button>
        </div>

        <DataTable
          data={departments || []}
          loading={isLoading}
          keyExtractor={(dept: any, index) => dept?.id ?? index}
          pagination={{
            currentPage: pagination?.page || 1,
            totalPages: pagination?.totalPages || 1,
            totalItems: pagination?.total ?? 0,
            itemsPerPage: 10,
            onPageChange: handlePageChange,
          }}
          itemLabel="department"
          columns={[
            { key: "department_code", header: "Code", className: "w-24" },
            {
              key: "name",
              header: "Department Name",
              className: "font-medium",
            },
            {
              key: "head",
              header: "Department Head",
              render: (dept: any) => (
                <span className="text-sm text-gray-600 font-medium">
                  {dept.head?.employee?.full_name || "Not Assigned"}
                </span>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              className: "w-32 text-right",
              render: (dept: any) => (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => openAssignHead(dept)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Assign Department Head"
                  >
                    <FiUserCheck size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setDepartmentToDelete(dept);
                      setIsDeleteModalOpen(true);
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Department"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              ),
            },
          ]}
          emptyState={{
            title: "No departments found",
            description: "Create one to get started!",
          }}
        />

        {/* Add Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Add New Department"
        >
          <form onSubmit={handleCreate} className="space-y-6">
            <FormField
              name="name"
              label="Department Name"
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              placeholder="e.g. Human Resources"
              required
              autoFocus
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                onClick={() => setIsModalOpen(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button type="submit">Create Department</Button>
            </div>
          </form>
        </Modal>

        {/* Assign Head Modal */}
        <Modal
          isOpen={isHeadModalOpen}
          onClose={() => setIsHeadModalOpen(false)}
          title={`Assign Head: ${targetDepartment?.name}`}
        >
          <form onSubmit={handleAssignHead} className="space-y-6">
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 mb-4">
              Rule: The head must be an active member of this department.
            </div>
            
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Select Employee</label>
              {isFetchingEmps ? (
                <div className="text-sm text-gray-500 py-2 italic font-medium">Loading department members...</div>
              ) : employeeOptions.length > 0 ? (
                <select
                  value={selectedHeadId}
                  onChange={(e) => setSelectedHeadId(e.target.value)}
                  className="w-full h-11 border border-gray-300 rounded-lg px-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none bg-white text-gray-800"
                  required
                >
                  <option value="">-- Choose Head --</option>
                  {employeeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-red-500 py-2 font-medium">No employees found in this department.</div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                onClick={() => setIsHeadModalOpen(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!selectedHeadId || isFetchingEmps}>
                Assign as Head
              </Button>
            </div>
          </form>
        </Modal>

        <ConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDepartmentToDelete(null);
          }}
          onConfirm={handleDelete}
          title="Delete Department"
          message={`Are you sure you want to delete the "${departmentToDelete?.name}" department? This action cannot be undone and may fail if the department has active employees.`}
          confirmText="Delete"
          type="danger"
        />
      </div>
    </AdminLayout>
  );
}

