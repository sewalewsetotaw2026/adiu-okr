import { useState, useEffect } from "react";
import { MdClose, MdSearch, MdPerson, MdCheck } from "react-icons/md";
import roleService from "../../../../services/roleService";
import toast from "react-hot-toast";

interface User {
  id: number;
  email: string;
  employee?: {
    id: string;
    full_name: string;
  };
  role?: {
    id: number;
    name: string;
  };
}

interface MapEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleId: number;
  roleName: string;
}

export const MapEmployeeModal = ({
  isOpen,
  onClose,
  roleId,
  roleName,
}: MapEmployeeModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [currentUsers, setCurrentUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isMapping, setIsMapping] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRoleDetails();
      handleSearch("");
      setSelectedUserIds([]);
    }
  }, [isOpen, roleId]);

  const fetchRoleDetails = async () => {
    try {
      const response = await roleService.getRoleDetails(roleId);
      setCurrentUsers(response.data.role.appUsers || []);
    } catch (error) {
      console.error("Failed to fetch role details", error);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    try {
      setLoading(true);
      const response = await roleService.searchUsersForMapping(query);
      setSearchResults(response.data.users || []);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleMapUsers = async () => {
    if (selectedUserIds.length === 0) return;

    try {
      setIsMapping(true);
      await roleService.assignUsersToRole(roleId, selectedUserIds);
      toast.success(`Successfully mapped ${selectedUserIds.length} users`);
      setSelectedUserIds([]);
      fetchRoleDetails(); // Refresh current users list
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Mapping failed");
    } finally {
      setIsMapping(false);
    }
  };

  const handleRemoveUser = async (userId: number) => {
    try {
      await roleService.unassignUser(userId);
      toast.success("User removed from role");
      fetchRoleDetails(); // Refresh list
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to remove user");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Role Membership</h2>
            <p className="text-sm text-gray-500 font-medium">Managing <span className="text-primary font-bold">{roleName.toUpperCase()}</span> role members</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
          >
            <MdClose size={24} />
          </button>
        </div>

        {/* Search Input Section */}
        <div className="p-5 space-y-4">
          <div className="relative group">
            <MdSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search employees to add..."
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm font-medium placeholder:text-gray-400 shadow-inner"
              autoFocus
            />
          </div>

          {/* Current Members Display */}
          {currentUsers.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-gray-400 pl-1">Current Members ({currentUsers.length})</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                {currentUsers.map((user) => (
                  <div key={user.id} className="group/chip flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-red-200 hover:bg-red-50 transition-all">
                    <span className="text-xs font-bold text-gray-700">{user.employee?.full_name || user.email}</span>
                    <button
                      onClick={() => handleRemoveUser(user.id)}
                      className="p-0.5 text-gray-300 hover:text-red-500 rounded-md transition-colors"
                      title="Remove from role"
                    >
                      <MdClose size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-gray-50 mx-5" />

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 min-h-[250px] custom-scrollbar">
          <div className="px-2 mb-2">
            <label className="text-[10px] uppercase tracking-widest font-black text-gray-400">Search Results</label>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
              <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
              <span className="text-xs font-bold tracking-wide">Looking for staff...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <MdPerson size={48} className="opacity-10 mb-2" />
              <span className="text-xs font-medium">No matches found for "{searchQuery}"</span>
            </div>
          ) : (
            <div className="grid gap-1">
              {searchResults.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                const isMember = currentUsers.some(u => u.id === user.id);

                return (
                  <div
                    key={user.id}
                    onClick={() => !isMember && toggleUserSelection(user.id)}
                    className={`
                      flex items-center justify-between p-3 rounded-xl transition-all border
                      ${isMember
                        ? "opacity-50 cursor-default bg-gray-50 border-gray-100"
                        : isSelected
                          ? "bg-primary border-primary shadow-lg shadow-primary/10 scale-[0.98]"
                          : "bg-white border-transparent hover:border-gray-200 hover:bg-gray-50/50 cursor-pointer"
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center text-sm font-black
                        ${isSelected ? "bg-white text-primary" : "bg-gray-100 text-gray-400"}
                      `}>
                        {user.employee?.full_name?.[0]?.toUpperCase() || <MdPerson size={20} />}
                      </div>
                      <div>
                        <h4 className={`font-bold text-sm ${isSelected ? "text-white" : "text-gray-800"}`}>
                          {user.employee?.full_name || "Guest Employee"}
                        </h4>
                        <p className={`text-[10px] font-medium leading-none mt-1 ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                          {user.email}
                        </p>
                      </div>
                    </div>

                    {isMember ? (
                      <span className="text-[10px] font-black uppercase tracking-tight px-2 py-1 bg-gray-200 text-gray-500 rounded-md shadow-sm">
                        Already Member
                      </span>
                    ) : (
                      <div className={`
                        w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                        ${isSelected
                          ? "bg-white border-white text-primary"
                          : "border-gray-200"
                        }
                      `}>
                        {isSelected && <MdCheck size={16} strokeWidth={2} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-white flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border-2 border-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-200 transition-all text-xs uppercase tracking-widest"
          >
            Finished
          </button>
          <button
            onClick={handleMapUsers}
            disabled={selectedUserIds.length === 0 || isMapping}
            className="flex-[1.5] px-4 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-all disabled:opacity-50 shadow-xl shadow-primary/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
          >
            {isMapping ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              `Map ${selectedUserIds.length > 0 ? selectedUserIds.length : ''} Employees`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
