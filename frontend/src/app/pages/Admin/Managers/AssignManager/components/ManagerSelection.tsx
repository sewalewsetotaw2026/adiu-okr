import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  FiSearch,
  FiArrowRight,
  FiBriefcase,
  FiMapPin,
  FiMail,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAssignManagerSlice } from "../slice";
import {
  selectManagerSearchQuery,
  selectManagerSuggestions,
  selectSelectedManager,
  selectExistingManagers,
} from "../slice/selectors";

export default function ManagerSelection() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { actions } = useAssignManagerSlice();

  const searchQuery = useSelector(selectManagerSearchQuery);
  const suggestions = useSelector(selectManagerSuggestions);
  const selectedManager = useSelector(selectSelectedManager);
  const existingManagers = useSelector(selectExistingManagers);

  // Focus effect state
  const [isFocused, setIsFocused] = useState(false);

  // Trigger search on typing
  useEffect(() => {
    dispatch(actions.searchManagersRequest(searchQuery));
  }, [searchQuery, dispatch, actions]);

  // Fetch existing managers on mount
  useEffect(() => {
    dispatch(actions.fetchExistingManagersRequest());
  }, [dispatch, actions]);

  const handleSelect = (manager: any) => {
    dispatch(actions.setSelectedManager(manager));
    dispatch(actions.setManagerSearchQuery(""));
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] py-10">
      {!selectedManager && (
        <div className="text-center mb-12 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
            Who is defining the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark">
              Vision?
            </span>
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            Select the leader who will guide this team to success.
          </p>
        </div>
      )}

      {selectedManager && (
        <div className="w-full max-w-2xl relative animate-in zoom-in-95 duration-500">
          <div className="absolute inset-0 bg-primary-light blur-[80px] rounded-full opacity-50 pointer-events-none"></div>

          <div className="relative bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden flex flex-col md:flex-row">
            <div className="bg-gradient-to-b from-gray-50 to-white p-8 flex flex-col items-center justify-center border-r border-gray-100 md:w-1/3">
              <div className="w-32 h-32 rounded-full p-1 shadow-xl bg-white mb-4 relative">
                <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-4xl font-bold text-gray-500 overflow-hidden relative z-10">
                  {selectedManager.profilePicture ? (
                    <img
                      src={selectedManager.profilePicture}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ) : (
                    selectedManager.full_name?.charAt(0)
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-2 rounded-full border-4 border-white shadow-sm z-20">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-black text-gray-900 text-center leading-tight">
                {selectedManager.full_name}
              </h2>
              <span className="mt-2 px-3 py-1 bg-primary-light text-primary text-xs font-bold uppercase tracking-wider rounded-full">
                Selected Leader
              </span>
            </div>

            <div className="p-8 md:w-2/3 flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                    Current Role
                  </p>
                  <p className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <FiBriefcase className="text-primary" />
                    {selectedManager.jobTitle && selectedManager.job_title !== "Unspecified"
                      ? selectedManager.job_title
                      : "No Title"}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                      Department
                    </p>
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <FiMapPin className="text-gray-400" />
                      {selectedManager.department && selectedManager.department !== "Unspecified"
                        ? selectedManager.department
                        : "General"}
                    </p>
                  </div>
                  {(selectedManager.email || selectedManager.phones?.[0]) && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                        Contact
                      </p>
                      <div className="space-y-1">
                        {selectedManager.email && (
                          <p className="text-sm font-medium text-gray-700 flex items-center gap-2 truncate">
                            <FiMail className="text-gray-400" /> {selectedManager.email}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button
                  onClick={() => dispatch(actions.clearSelectedManager())}
                  className="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 hover:text-gray-900 transition-colors flex-1"
                >
                  Change
                </button>
                <button
                  onClick={() => navigate(`/admin/managers/${selectedManager.id}/build-team`)}
                  className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 flex-[2]"
                >
                  Build Their Team <FiArrowRight />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedManager && (
        <div className="w-full max-w-2xl relative z-10 group">
          <div
            className={`relative bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 border ${isFocused ? "border-primary ring-4 ring-primary-light/50" : "border-gray-100 hover:border-gray-300"
              }`}
          >
            <FiSearch
              className={`absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 transition-colors ${isFocused ? "text-primary" : "text-gray-400"
                }`}
            />
            <input
              value={searchQuery}
              onChange={(e) => dispatch(actions.setManagerSearchQuery(e.target.value))}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              placeholder="Search leader by name..."
              className="w-full py-6 pl-16 pr-6 bg-transparent text-xl font-bold text-gray-900 placeholder-gray-300 outline-none rounded-2xl"
              autoFocus
            />

            {(searchQuery || suggestions.length > 0) && isFocused && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 transform origin-top">
                <div className="max-h-[350px] overflow-y-auto p-2">
                  {suggestions.length > 0 ? (
                    suggestions.map((manager) => (
                      <button
                        key={manager.id}
                        onClick={() => handleSelect(manager)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 rounded-xl transition-all group text-left border-b border-gray-50 last:border-0"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-lg font-bold group-hover:bg-primary-light group-hover:text-primary transition-colors">
                          {manager.full_name?.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 text-lg group-hover:text-primary transition-colors">
                            {manager.full_name}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                            <span>{manager.job_title}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span>{manager.department}</span>
                          </div>
                        </div>
                        <div className="bg-gray-100 text-gray-400 p-2 rounded-lg group-hover:bg-primary group-hover:text-white transition-all">
                          <FiArrowRight className="w-5 h-5" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
                      <FiSearch className="w-8 h-8 opacity-20" />
                      <p>No leaders found.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {!searchQuery && existingManagers.length > 0 && (
            <div className="mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                  Existing Leaders
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {existingManagers.map((mgr: any) => (
                  <button
                    key={mgr.id}
                    onClick={() => handleSelect(mgr)}
                    className="group bg-white p-4 rounded-2xl border border-gray-100 hover:border-primary-light hover:shadow-lg hover:shadow-primary/5 transition-all text-left flex items-start gap-4"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gray-50 group-hover:bg-primary-light flex items-center justify-center text-gray-600 group-hover:text-primary font-bold transition-colors">
                      {mgr.profile_picture ? (
                        <img
                          src={mgr.profile_picture}
                          className="w-full h-full rounded-xl object-cover"
                          alt=""
                        />
                      ) : (
                        mgr.full_name?.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate group-hover:text-primary transition-colors">
                        {mgr.full_name}
                      </h4>
                      <p className="text-xs text-gray-500 truncate">
                        {mgr.job_title}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wide group-hover:bg-primary-light group-hover:text-primary transition-colors">
                          <FiBriefcase className="w-3 h-3" /> {mgr.team_size || 0} Team
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
