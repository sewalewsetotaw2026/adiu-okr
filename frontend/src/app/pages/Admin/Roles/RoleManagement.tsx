import { useEffect, useMemo, useState } from "react";
import { RoleList } from "./components/RoleList";
import { PermissionMatrix } from "./components/PermissionMatrix";
import { CreateRoleModal } from "./components/CreateRoleModal";
import { MapEmployeeModal } from "./components/MapEmployeeModal";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import roleService from "../../../services/roleService";
import toast from "react-hot-toast";

export default function RoleManagement() {
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [permissionMatrix, setPermissionMatrix] = useState<
    Record<string, Record<string, string>>
  >({});

  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mappingRole, setMappingRole] = useState<{ id: number; name: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [resourceSearch, setResourceSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<
    "all" | "leave" | "employee" | "common"
  >("all");

  const getResourceModule = (resourceCode: string) => {
    const code = String(resourceCode || "").toUpperCase();

    if (code.startsWith("LEAVE_") || code === "PUBLIC_HOLIDAY") {
      return "leave";
    }

    const employeeModuleCodes = new Set([
      "EMPLOYEE",
      "EMPLOYMENT",
      "EMPLOYEE_ADDRESS",
      "EMPLOYEE_PHONE",
      "EMPLOYEE_EDUCATION",
      "EMPLOYEE_EXPERIENCE",
      "EMPLOYEE_ALLOWANCE",
      "EMPLOYEE_CERTIFICATE",
      "EMPLOYEE_RESIGNATION",
      "EMPLOYEE_DOCUMENT",
      "EMPLOYEE_COST_SHARING",
      "EMERGENCY_CONTACT",
      "FINANCIAL_DETAIL",
      "CAREER_EVENT",
      "DEPARTMENT",
      "JOB_TITLE",
      "JOB_LEVEL",
      "ALLOWANCE_TYPE",
      "BANK",
      "FIELD_OF_STUDY",
      "INSTITUTION",
      "EDUCATION_LEVEL",
      "DOCUMENT_SIGNER",
      "EMPLOYEE_SETTINGS",
    ]);

    if (employeeModuleCodes.has(code)) {
      return "employee";
    }

    return "common";
  };

  const filteredResources = useMemo(() => {
    const query = resourceSearch.trim().toLowerCase();

    return resources.filter((resource) => {
      const module = getResourceModule(resource.code);
      const moduleMatch = moduleFilter === "all" || module === moduleFilter;

      const searchTarget = `${resource.name || ""} ${resource.code || ""}`
        .toLowerCase()
        .trim();
      const searchMatch = !query || searchTarget.includes(query);

      return moduleMatch && searchMatch;
    });
  }, [resources, resourceSearch, moduleFilter]);

  // Fetch roles on mount
  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);
      const response = await roleService.getRoles();
      setRoles(response.data);
      // Select first role by default if available and none selected
      if (response.data.length > 0 && !selectedRoleId) {
        handleSelectRole(response.data[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch roles", error);
      toast.error("Failed to load roles");
    } finally {
      setLoadingRoles(false);
    }
  };

  const handleSelectRole = async (roleId: number) => {
    try {
      setLoadingDetails(true);
      setSelectedRoleId(roleId);
      const response = await roleService.getRoleDetails(roleId);
      const rawResources = response.data.resources || [];

      // Clean up resource names
      // 1. Filter out "Company" resource (Code: COMPANY)
      // 2. Remove "Management", "Employee", underscores from names
      const cleanedResources = rawResources
        .filter((r: any) => r.code !== "COMPANY")
        .map((r: any) => {
          let name = r.name
            .replace(/_/g, " ")
            .replace(/management/gi, "")
            .trim();

          // Only remove "Employee" if it's not the only word left
          if (
            name.toLowerCase() !== "employee" &&
            name.toLowerCase().includes("employee")
          ) {
            name = name.replace(/employee/gi, "").trim();
          }

          return {
            ...r,
            name: name || r.code,
          };
        })
        .filter((r: any) => r.name.length > 0)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      setResources(cleanedResources);
      setPermissionMatrix(response.data.matrix);
    } catch (error) {
      console.error("Failed to fetch role details", error);
      toast.error("Failed to load permissions");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePermissionChange = async (
    resourceCode: string,
    action: string,
    scope: string,
  ) => {
    if (!selectedRoleId) return;

    // Optimistic update
    setPermissionMatrix((prev) => ({
      ...prev,
      [resourceCode]: {
        ...prev[resourceCode],
        [action]: scope,
      },
    }));

    try {
      await roleService.updatePermission(selectedRoleId, {
        resourceCode,
        action,
        scope,
      });
      toast.success("Permission updated", { id: "perm-update" });
    } catch (error) {
      console.error("Failed to update permission", error);
      toast.error("Failed to update permission");
      // Revert on failure (could implement refetch here instead)
      handleSelectRole(selectedRoleId);
    }
  };

  const handleCreateRole = async (name: string, description: string) => {
    try {
      setIsCreating(true);
      await roleService.createRole({ name, description });
      toast.success("Role created successfully");
      setIsCreateModalOpen(false);
      fetchRoles();
    } catch (error: any) {
      console.error("Failed to create role", error);
      toast.error(error.response?.data?.message || "Failed to create role");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenMapModal = (role: { id: number; name: string }) => {
    setMappingRole(role);
    setIsMapModalOpen(true);
  };

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-140px)] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Role Management</h1>
        </div>

        <div className="flex gap-6 h-full overflow-hidden">
          {/* Left Side: Role List */}
          <div className="w-1/4 min-w-62.5 h-full">
            <RoleList
              roles={roles}
              selectedRoleId={selectedRoleId}
              onSelectRole={handleSelectRole}
              onAddRole={() => setIsCreateModalOpen(true)}
              onMapRole={handleOpenMapModal}
              loading={loadingRoles}
            />
          </div>

          {/* Right Side: Permission Matrix */}
          <div className="flex-1 h-full overflow-hidden">
            {selectedRoleId ? (
              <div className="h-full flex flex-col gap-3">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={resourceSearch}
                      onChange={(e) => setResourceSearch(e.target.value)}
                      placeholder="Search resources (name or code)..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="w-full md:w-64">
                    <select
                      value={moduleFilter}
                      onChange={(e) =>
                        setModuleFilter(
                          e.target.value as
                          | "all"
                          | "leave"
                          | "employee"
                          | "common",
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="all">All Modules</option>
                      <option value="leave">Leave Module</option>
                      <option value="employee">
                        Employee Management Module
                      </option>
                      <option value="common">Shared/Common Module</option>
                    </select>
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  <PermissionMatrix
                    resources={filteredResources}
                    matrix={permissionMatrix}
                    onPermissionChange={handlePermissionChange}
                    loading={loadingDetails}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
                Select a role to manage permissions
              </div>
            )}
          </div>
        </div>

        <CreateRoleModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateRole}
          loading={isCreating}
        />

        {mappingRole && (
          <MapEmployeeModal
            isOpen={isMapModalOpen}
            onClose={() => {
              setIsMapModalOpen(false);
              setMappingRole(null);
            }}
            roleId={mappingRole.id}
            roleName={mappingRole.name}
          />
        )}
      </div>
    </AdminLayout>
  );
}
