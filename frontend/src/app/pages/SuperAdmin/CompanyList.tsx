import React, { useEffect, useState } from "react";
import platformService from "../../services/platformService";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import { formatDate } from "../../utils/dayjs-format";

export const CompanyList = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await platformService.getCompanies();
      setCompanies(res.data.companies);
    } catch (error) {
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      await platformService.toggleCompanyStatus(id, !currentStatus);
      toast.success(
        `Company ${!currentStatus ? "activated" : "deactivated"} successfully`,
      );
      fetchCompanies();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    id: number | null;
  }>({
    open: false,
    id: null,
  });

  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleMenuClick = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === id ? null : id);
  };

  const handleAction = (action: () => void) => {
    action();
    setActiveMenu(null);
  };

  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteModal.id) return;
    try {
      setDeleting(true);
      await platformService.deleteCompany(deleteModal.id);
      toast.success("Company deleted successfully");
      setDeleteModal({ open: false, id: null });
      fetchCompanies();
    } catch (error) {
      toast.error("Failed to delete company");
    } finally {
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-gray-500">Loading companies...</div>
    );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
          Registered Companies
        </h2>
        <Link
          to="/super-admin/register"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + Register Company
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employees
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {companies.map((company) => (
              <tr
                key={company.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 border border-gray-100 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                      {company.logo_url ? (
                        <img
                          className="h-full w-full object-contain"
                          src={company.logo_url}
                          alt={company.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://placehold.co/40x40?text=" +
                              company.name.charAt(0);
                          }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-indigo-50 text-indigo-600 font-bold text-lg">
                          {company.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {company.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {company.email || "No email"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    {company.company_code}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(company.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {company._count?.employees || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      company.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {company.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                  <button
                    onClick={(e) => handleMenuClick(e, company.id)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    </svg>
                  </button>

                  {activeMenu === company.id && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                      <div
                        className="py-1"
                        role="menu"
                        aria-orientation="vertical"
                      >
                        <button
                          onClick={() =>
                            handleAction(() =>
                              navigate(`/super-admin/edit/${company.id}`),
                            )
                          }
                          className="block w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
                          role="menuitem"
                        >
                          Edit Company
                        </button>
                        <button
                          onClick={() =>
                            handleAction(() =>
                              handleToggleStatus(company.id, company.is_active),
                            )
                          }
                          className={`block w-full text-left px-4 py-2 text-sm ${company.is_active ? "text-yellow-600 hover:bg-yellow-50" : "text-green-600 hover:bg-green-50"}`}
                          role="menuitem"
                        >
                          {company.is_active
                            ? "Deactivate Company"
                            : "Activate Company"}
                        </button>
                        <button
                          onClick={() =>
                            handleAction(() =>
                              setDeleteModal({ open: true, id: company.id }),
                            )
                          }
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          role="menuitem"
                        >
                          Delete Company
                        </button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {companies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No companies registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null })}
        onConfirm={confirmDelete}
        title="Delete Company"
        message="Are you sure you want to delete this company? All data associated with this company (employees, records, etc.) will be permanently removed. This action cannot be undone."
        confirmText="Delete Company"
        type="danger"
        isLoading={deleting}
      />
    </div>
  );
};
