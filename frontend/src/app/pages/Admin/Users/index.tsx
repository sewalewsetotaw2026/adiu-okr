import { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import Button from "../../../components/Core/ui/Button";
import DataTable from "../../../components/common/DataTable";
import FormField from "../../../components/common/FormField";
import { FiPlus, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { getFileUrl } from "../../../utils/fileUtils";

import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";

import { User } from "./slice/types";

import ToastService from "../../../../utils/ToastService";
import roleService from "../../../services/roleService";

export default function Users() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Local list state and filters
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [rolesList, setRolesList] = useState<any[]>([]);

  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  const [search, setSearch] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("Most Recent");

  // Fetch users function
  const fetchUsers = useCallback(
    async (targetPage: number = page) => {
      setIsLoading(true);
      try {
        const query: any = { page: targetPage, limit };

        const res: any = await makeCall({
          method: "GET",
          route: apiRoutes.users,
          query,
          isSecureRoute: true,
        });

        const list = res?.data?.data?.users ?? [];
        const pagination = res?.data?.data?.pagination;

        const filtered = list.filter((u: User) => {
          const byRole = roleFilter ? u.role?.name === roleFilter : true;
          const term = search.trim().toLowerCase();
          const bySearch = term
            ? u.employee?.full_name?.toLowerCase().includes(term) ||
            u.email?.toLowerCase().includes(term)
            : true;
          const byStatus = statusFilter
            ? statusFilter.toLowerCase() === "active"
              ? u.is_active === true
              : u.is_active === false
            : true;
          return byRole && bySearch && byStatus;
        });
        const sorted = [...filtered].sort((a, b) => {
          if (sortBy === "ID Asc") return a.id - b.id;
          if (sortBy === "ID Desc") return b.id - a.id;
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          if (sortBy === "Oldest") return aDate - bDate;
          // Default: Most Recent
          return bDate - aDate;
        });
        setUsers(sorted);
        if (pagination) {
          setTotal(pagination.total);
          setTotalPages(pagination.totalPages);
          setPage(pagination.page);
        } else {
          setTotal(list.length);
          setTotalPages(1);
        }
      } catch (err: any) {
        ToastService.error(err?.message || "Failed to fetch users");
      } finally {
        setIsLoading(false);
      }
    },
    [page, limit, search, roleFilter, statusFilter, sortBy]
  );

  useEffect(() => {
    fetchUsers(page);
  }, [page, search, roleFilter, statusFilter, sortBy, fetchUsers]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await roleService.getRoles();
        setRolesList(res.data || []);
      } catch (err) {
        console.error("Failed to fetch roles", err);
      }
    };
    fetchRoles();
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Users</h1>
          <Button
            onClick={() => navigate("/admin/users/create")}
            className="bg-[#FFCC00] hover:bg-[#e6b800] text-black font-semibold px-6 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all"
          >
            <FiPlus /> Create User
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <FormField
              name="search"
              label="Search"
              placeholder="Search by name or email"
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <FormField
              type="select"
              label="Role"
              name="roleFilter"
              value={roleFilter}
              onChange={(e: any) => setRoleFilter(e.target.value)}
              options={rolesList.map(r => ({ label: r.name, value: r.name }))}
              placeholder="All Roles"
            />
          </div>
          <div className="w-full md:w-48">
            <FormField
              type="select"
              label="Status"
              name="statusFilter"
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
              placeholder="All Statuses"
            />
          </div>
          <div className="w-full md:w-48">
            <FormField
              type="select"
              label="Sort By"
              name="sortBy"
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              options={[
                { label: "Most Recent", value: "Most Recent" },
                { label: "Oldest", value: "Oldest" },
                { label: "ID Asc", value: "ID Asc" },
                { label: "ID Desc", value: "ID Desc" },
              ]}
              placeholder="Sort By"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-[480px]">
            {/* Users Table */}
            <DataTable<User>
              data={users}
              loading={isLoading}
              keyExtractor={(u) => u.id}
              emptyState={{ title: "No users found." }}
              columns={[
                { key: "id", header: "ID", className: "w-20" },
                {
                  key: "fullName",
                  header: "Full Name",
                  render: (u: User) => (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden border border-gray-200">
                        <img
                          src={getFileUrl(
                            u.employee?.profile_picture_url || u.profile_picture_url
                          )}
                          alt={u.employee?.full_name || u.email}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="font-medium text-gray-900">
                        {u.employee?.full_name || "-"}
                      </span>
                    </div>
                  ),
                  className: "min-w-[180px]",
                },
                {
                  key: "email",
                  header: "Email",
                  className: "min-w-[220px]",
                },
                {
                  key: "employeeId",
                  header: "Employee ID",
                  render: (u: User) => u.employee?.id || "-",
                  className: "w-40",
                },
                {
                  key: "role",
                  header: "Role",
                  render: (u: User) => u.role?.name || "-",
                  className: "w-36",
                },
              ]}
            />
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-gray-500">
              Page {page} of {totalPages} • Total {total}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 text-sm w-28"
              >
                <FiChevronLeft /> Previous
              </Button>
              <Button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm w-28"
              >
                Next <FiChevronRight />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
