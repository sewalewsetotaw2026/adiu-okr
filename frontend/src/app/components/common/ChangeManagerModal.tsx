import React, { useEffect, useState } from "react";
import {
  MdClose,
  MdSearch,
  MdCheck,
  MdGroups,
  MdSwapVert,
  MdPersonSearch,
  MdOutlineSupervisedUserCircle,
} from "react-icons/md";
import axios from "axios";
import { toast } from "react-toastify";

const RAW_BASE_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_BASE_URL;

if (!RAW_BASE_URL) {
  throw new Error(
    "Missing API base URL. Set VITE_API_URL (recommended) or VITE_BASE_URL (example: VITE_API_URL=http://localhost:5000/api/v1).",
  );
}

const API_URL = String(RAW_BASE_URL).replace(/\/+$/, "");

interface ChangeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string | null;
  employeeName: string;
  currentManagerId?: string | null;
  onSuccess: () => void;
  mode?: "assign_manager" | "replace_team_lead"; // Default: assign_manager
}

const ChangeManagerModal: React.FC<ChangeManagerModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  currentManagerId,
  onSuccess,
  mode = "assign_manager",
}) => {
  const [employees, setEmployees] = useState<any[]>([]); // Search results
  const [teamMembers, setTeamMembers] = useState<any[]>([]); // Team members
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(
    null,
  );

  // Tabs: "search" (All Employees) vs "team" (Team Members)
  const [activeTab, setActiveTab] = useState<"search" | "team">("search");

  useEffect(() => {
    if (isOpen) {
      if (mode === "replace_team_lead") {
        setActiveTab("team");
        fetchTeamMembers();
      } else {
        setActiveTab("search");
        fetchEmployees();
      }
      setSelectedManagerId(currentManagerId || null);
      setSearchQuery("");
    }
  }, [isOpen, currentManagerId, mode, employeeId]);

  // Handle Search Debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (isOpen && activeTab === "search") {
        fetchEmployees(searchQuery);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, isOpen, activeTab]);

  const fetchEmployees = async (query = "") => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/assign-managers/search`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { query },
      });
      setEmployees(response.data.data.employees || []);
    } catch (error) {
      console.error("Failed to fetch employees", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_URL}/assign-managers/${employeeId}/team-members`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTeamMembers(response.data.data.employees || response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch team members", error);
      toast.error("Could not load team members.");
    } finally {
      setLoading(false);
    }
  };
  console.log("team members fetched", teamMembers);

  const handleSubmit = async () => {
    if (!selectedManagerId || !employeeId) return;

    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      if (mode === "replace_team_lead") {
        const teamIds = teamMembers
          .map((m) => m.id)
          .filter((id) => id !== selectedManagerId);
        const subordinates = [employeeId, ...teamIds];

        await axios.post(
          `${API_URL}/assign-managers/bulk-assign`,
          {
            manager_id: selectedManagerId,
            subordinate_ids: subordinates,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success("Team Lead changed successfully");
      } else {
        await axios.post(
          `${API_URL}/assign-managers/bulk-assign`,
          {
            manager_id: selectedManagerId,
            subordinate_ids: [employeeId],
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success("Manager updated successfully");
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to update manager", error);
      toast.error(error.response?.data?.message || "Failed to update manager");
    } finally {
      setLoading(false);
    }
  };

  const getDisplayList = () => {
    if (activeTab === "team") return teamMembers;
    return employees;
  };

  // Helper for generating consistent avatar colors
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-100 text-blue-600",
      "bg-green-100 text-green-600",
      "bg-purple-100 text-purple-600",
      "bg-orange-100 text-orange-600",
      "bg-pink-100 text-pink-600",
      "bg-teal-100 text-teal-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden scale-100 animate-in zoom-in-95 duration-200 border border-gray-100">
        {/* HEADER */}
        <div className="p-6 border-b border-gray-100 bg-white relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                {mode === "replace_team_lead"
                  ? "Changes in Leadership"
                  : "Change Manager"}
              </h2>
              <p className="text-sm font-medium text-gray-500 mt-1">
                {mode === "replace_team_lead" ? (
                  <>
                    Promote a new leader for{" "}
                    <span className="text-gray-900 font-bold bg-gray-100 px-1.5 py-0.5 rounded-md">
                      {employeeName}
                    </span>
                    's team
                  </>
                ) : (
                  <>
                    Reassign reporting line for{" "}
                    <span className="text-gray-900 font-bold bg-gray-100 px-1.5 py-0.5 rounded-md">
                      {employeeName}
                    </span>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="group p-2 rounded-full hover:bg-gray-100 transition-all text-gray-400 hover:text-gray-600"
            >
              <MdClose
                size={24}
                className="group-hover:rotate-90 transition-transform duration-300"
              />
            </button>
          </div>

          {/* TABS */}
          {mode === "replace_team_lead" && (
            <div className="flex p-1 bg-gray-100/80 rounded-xl relative">
              {/* Animated background Slider could go here if using Framer Motion, but basic conditional classes work for now */}
              <button
                onClick={() => setActiveTab("team")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 relative z-10 ${activeTab === "team"
                  ? "bg-white text-orange-600 shadow-sm ring-1 ring-black/5"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                  }`}
              >
                <MdGroups size={18} /> From Team
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 relative z-10 ${activeTab === "search"
                  ? "bg-white text-orange-600 shadow-sm ring-1 ring-black/5"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                  }`}
              >
                <MdPersonSearch size={18} /> Search All
              </button>
            </div>
          )}
        </div>

        {/* SEARCH BAR (Stickyish) */}
        <div className="px-6 py-3 bg-white z-10">
          <div className="relative group">
            <div
              className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${searchQuery
                ? "text-primary"
                : "text-gray-400 group-focus-within:text-primary"
                }`}
            >
              <MdSearch size={22} />
            </div>
            <input
              type="text"
              autoFocus
              placeholder={
                activeTab === "team"
                  ? "Filter team members..."
                  : "Search employees by name..."
              }
              className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-100 focus:bg-white transition-all font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* LIST CONTENT */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-[300px]">
          {loading && getDisplayList().length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-3 shimmer-bg rounded mb-4" />
              <div className="space-y-4 w-full px-8">
                <div className="h-12 w-full shimmer-bg rounded-xl" />
                <div className="h-12 w-full shimmer-bg rounded-xl" />
              </div>
            </div>
          ) : getDisplayList().length > 0 ? (
            <div className="space-y-2 mt-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1">
                {activeTab === "team" ? "Candidates" : "Results"}
              </h3>
              {getDisplayList()
                .filter((item) =>
                  activeTab === "team"
                    ? item.full_name
                      ?.toLowerCase()
                      .includes(searchQuery.toLowerCase())
                    : true,
                )
                .map((emp) => {
                  const isSelected = selectedManagerId === emp.id;
                  const avatarColor = getAvatarColor(emp.full_name || "?");

                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedManagerId(emp.id)}
                      className={`
                        group relative flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all duration-200 border
                        ${isSelected
                          ? "bg-orange-50 border-orange-200 shadow-sm scale-[1.01]"
                          : "bg-white border-transparent hover:border-gray-100 hover:bg-gray-50 hover:shadow-sm"
                        }
                      `}
                    >
                      {/* Avatar */}
                      <div
                        className={`
                        w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm shrink-0 transition-transform group-hover:scale-105
                        ${isSelected ? "bg-primary text-white shadow-primary/20" : avatarColor}
                      `}
                      >
                        {emp.full_name?.charAt(0)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4
                          className={`text-sm font-bold truncate ${isSelected ? "text-gray-900" : "text-gray-700"}`}
                        >
                          {emp.full_name}
                        </h4>
                        {/*<div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-medium text-gray-500 truncate max-w-[140px] bg-gray-100 px-1.5 py-0.5 rounded-md">
                            {emp.employments[0].jobTitle.title || "No Title"}
                          </span>
                        </div>*/}
                      </div>

                      {/* Selection Indicator */}
                      {isSelected ? (
                        <MdCheck size={24} className="text-primary" />
                      ) : null}
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <MdOutlineSupervisedUserCircle
                  className="text-gray-300"
                  size={40}
                />
              </div>
              <h3 className="text-gray-900 font-bold text-lg mb-1">
                {activeTab === "team" ? "Team is empty" : "No employees found"}
              </h3>
              <p className="text-gray-500 text-sm max-w-[200px]">
                {activeTab === "team"
                  ? "Use 'Search All' to promote someone from outside the team."
                  : `We couldn't find anyone matching "${searchQuery}".`}
              </p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-gray-100 bg-white rounded-b-3xl flex gap-3 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-3.5 text-gray-600 font-bold text-sm bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              !selectedManagerId ||
              loading ||
              selectedManagerId === currentManagerId ||
              selectedManagerId === employeeId
            }
            className={`
              flex-[1.5] px-5 py-3.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2
              ${!selectedManagerId ||
                loading ||
                selectedManagerId === currentManagerId ||
                selectedManagerId === employeeId
                ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                : "bg-primary hover:bg-primary-dark shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              }
            `}
          >
            {loading ? (
              <div className="absolute inset-0 shimmer-bg opacity-30" />
            ) : (
              <>
                Confirm{" "}
                {mode === "replace_team_lead" ? "Promotion" : "Assignment"}
                {mode === "replace_team_lead" && <MdSwapVert size={18} />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangeManagerModal;
