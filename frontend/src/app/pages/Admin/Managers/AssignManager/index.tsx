import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import ManagerSelection from "./components/ManagerSelection";
import { useAssignManagerSlice, assignManagerActions } from "./slice";
import { FiCheckCircle } from "react-icons/fi";

export default function AssignManagerPage() {
  useAssignManagerSlice();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(assignManagerActions.resetState());
  }, [dispatch]);

  return (
    <AdminLayout>
      <Helmet>
        <title>Assign Manager</title>
      </Helmet>

      <div className="min-h-[calc(100vh-80px)] bg-gray-50 flex flex-col">
        {/* PROGRESS HEADER */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-gray-900 tracking-tight">
                Team<span className="text-primary">Builder</span>
              </span>
            </div>

            {/* VISUAL STEPS CHAIN */}
            <div className="flex items-center">
              {/* Step 1 */}
              <div className="relative flex items-center text-primary">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 z-10 bg-white border-primary">
                  1
                </div>
                <span className="ml-3 text-sm font-bold text-gray-900">
                  Select Leader
                </span>
              </div>

              {/* Connector */}
              <div className="w-8 sm:w-16 h-0.5 mx-2 sm:mx-4 bg-gray-200"></div>

              {/* Step 2 */}
              <div className="relative flex items-center text-gray-400">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 z-10 bg-gray-50 border-gray-300">
                  2
                </div>
                <span className="ml-3 text-sm font-bold text-gray-400 hidden sm:block">
                  Draft Team
                </span>
              </div>
            </div>

            <div className="w-24 text-right">
              <button
                onClick={() => navigate("/admin/managers")}
                className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
              >
                Cancel Process
              </button>
            </div>
          </div>
        </div>

        {/* MAIN STAGE */}
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 overflow-y-auto py-8 px-4">
            <div className="animate-in fade-in zoom-in-95 duration-500">
              <ManagerSelection />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
