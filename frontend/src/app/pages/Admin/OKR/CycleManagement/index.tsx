import { useEffect, useState, useMemo } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import StatusBadge, { Status } from "../components/StatusBadge";
import ModalLayout from "../components/ModalLayout";
import ApprovalFooter from "../components/ApprovalFooter";
import RefreshButton from "../../../../components/common/RefreshButton";
import Button from "../../../../components/Core/ui/Button";

import {
  MdCalendarToday,
  MdAdd,
  MdEdit,
  MdPlayCircleOutline,
  MdStopCircle,
  MdChevronLeft,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { routeConstants } from "../../../../../utils/constants";
import ToastService from "../../../../../utils/ToastService";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { okrErrorMessage, okrUnwrap } from "../../../../utils/okrApi";

import { useDispatch, useSelector } from "react-redux";
import { selectCycles, selectCycleLoading } from "./slice/selectors";
import { useCycleSlice } from "./slice";

/* ================= TYPES ================= */

type Cycle = {
  id: number;
  name: string;
  status: Status;
  startDate: string;
  endDate: string;
};

/* ================= HELPERS ================= */

const mapBackendStatus = (status: string): Status => {
  switch (status) {
    case "DRAFT":
      return "draft";
    case "OPEN":
      return "open";
    case "CLOSED":
      return "closed";
    case "ARCHIVED":
      return "closed";
    default:
      return "draft";
  }
};

const formatDateInput = (date: string) => {
  return date ? date.split("T")[0] : "";
};

const formatDateDisplay = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/* ================= COMPONENT ================= */

export default function CycleManagement() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { actions } = useCycleSlice();

  const cyclesFromApi = useSelector(selectCycles);
  const loading = useSelector(selectCycleLoading);

  const [showModal, setShowModal] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });

  const [error, setError] = useState("");

  useEffect(() => {
    dispatch(actions.fetchCyclesRequest());
  }, [dispatch]);

  useEffect(() => {
    setActionLoadingId(null);
  }, [cyclesFromApi]);

  const cycles: Cycle[] = useMemo(
    () =>
      (cyclesFromApi || []).map((c: any) => ({
        id: Number(c.id),
        name: c.name,
        status: mapBackendStatus(c.status),
        startDate: formatDateInput(c.start_date),
        endDate: formatDateInput(c.end_date),
      })),
    [cyclesFromApi],
  );

  const hasOpenCycle = cycles.some((c) => c.status === "open");

  const summary = useMemo(() => {
    const n = cycles.length;
    const open = cycles.filter((c) => c.status === "open").length;
    const draft = cycles.filter((c) => c.status === "draft").length;
    const closed = cycles.filter((c) => c.status === "closed").length;
    return { n, open, draft, closed };
  }, [cycles]);

  const closeModal = () => {
    setShowModal(false);
    setEditingCycle(null);
    setForm({ name: "", startDate: "", endDate: "" });
    setError("");
  };

  const openCycle = (cycle: Cycle) => {
    if (cycle.status === "open") return;

    setActionLoadingId(cycle.id);
    dispatch(actions.openCycleRequest({ id: cycle.id }));
  };

  const closeCycle = async (cycle: Cycle) => {
    if (cycle.status !== "open") return;

    try {
      const summaryRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.archiveCheck(cycle.id),
        isSecureRoute: true,
      });
      const summary = okrUnwrap<any>(summaryRes) ?? {};
      const totalCompanyObjectives =
        Number(summary.totalCompanyObjectives ?? 0) || 0;
      const completedCompanyObjectives =
        Number(summary.completedCompanyObjectives ?? 0) || 0;

      if (totalCompanyObjectives > 0) {
        ToastService.info(
          `Archive readiness check: ${completedCompanyObjectives}/${totalCompanyObjectives} company objectives completed.`,
        );
      }
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      return;
    }

    setActionLoadingId(cycle.id);
    dispatch(actions.closeCycleRequest({ id: cycle.id }));
  };

  const handleSave = () => {
    if (!form.name || !form.startDate || !form.endDate) {
      return setError("All fields are required");
    }

    if (form.startDate > form.endDate) {
      return setError("Start date cannot be after end date");
    }

    const payload = {
      name: form.name,
      quarter_label: form.name.split(" ")[0],
      start_date: form.startDate,
      end_date: form.endDate,
      description: "",
    };

    if (editingCycle) {
      dispatch(
        actions.updateCycleRequest({
          id: editingCycle.id,
          data: payload,
        }),
      );
    } else {
      dispatch(actions.createCycleRequest(payload));
    }

    closeModal();
  };

  const openCreate = () => {
    setEditingCycle(null);
    setForm({ name: "", startDate: "", endDate: "" });
    setError("");
    setShowModal(true);
  };

  const EDIT_LOCKED_MESSAGE =
    "Closed cycles cannot be edited. Active and Draft cycles can still be modified.";

  const openEdit = (cycle: Cycle) => {
    if (cycle.status === "closed") {
      ToastService.error(EDIT_LOCKED_MESSAGE);
      return;
    }
    setEditingCycle(cycle);
    setForm({
      name: cycle.name,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
    });
    setError("");
    setShowModal(true);
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
          <PageHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                
                <div className="p-3 bg-white/10 rounded-2xl ring-1 ring-white/20 shadow-inner">
                  <MdCalendarToday className="text-3xl text-white" />
                </div>
                <div className="text-white">
                  <h1 className="text-2xl font-black tracking-tighter capitalize">
                    Planning Cycles
                  </h1>
                  <p className="text-white/60 text-xs font-medium mt-1">
                    Manage organizational planning windows and active execution
                    periods.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <RefreshButton
                  onClick={() => {
                    dispatch(actions.fetchCyclesRequest());
                  }}
                  loading={loading}
                />
                <Button
                  variant="white"
                  size="sm"
                  onClick={openCreate}
                  icon={MdAdd}
                >
                  New cycle
                </Button>
              </div>
            </div>
          </PageHeader>

          {loading ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-24 rounded-2xl bg-gray-200/70 ring-1 ring-gray-100"
                  />
                ))}
              </div>
              <div className="rounded-2xl bg-white ring-1 ring-gray-100 overflow-hidden p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Total Cycles",
                    value: summary.n,
                    icon: MdCalendarToday,
                    color: "text-primary",
                  },
                  {
                    label: "Active Cycles",
                    value: summary.open,
                    icon: MdPlayCircleOutline,
                    color: "text-emerald-500",
                  },
                  {
                    label: "Draft Mode",
                    value: summary.draft,
                    icon: MdEdit,
                    color: "text-amber-500",
                  },
                  {
                    label: "Completed Cycles",
                    value: summary.closed,
                    icon: MdStopCircle,
                    color: "text-slate-500",
                  },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-xl shadow-slate-200/40 ring-1 ring-slate-100 transition-all hover:shadow-2xl hover:shadow-slate-300/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-space mb-1">
                          {stat.label}
                        </p>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter capitalize">
                          {stat.value}
                        </h3>
                      </div>
                      <stat.icon
                        className={`text-2xl ${stat.color} opacity-20 group-hover:opacity-100 transition-opacity`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {cycles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 px-8 py-16 text-center">
                  <MdCalendarToday className="mx-auto text-4xl text-gray-300 mb-3" />
                  <p className="text-gray-700 font-medium">No Cycles Yet</p>
                  <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                    Create a cycle with start and end dates. Open it when you
                    are ready to run company objectives for that period.
                  </p>
                  <Button
                    variant="primary"
                    onClick={openCreate}
                    icon={MdAdd}
                    className="mt-6"
                  >
                    Create Cycle
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl bg-white shadow-xl shadow-slate-200/40 ring-1 ring-slate-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-400 font-space">
                            Cycle Identity
                          </th>
                          <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-400 font-space">
                            Operational Period
                          </th>
                          <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-400 font-space">
                            Status
                          </th>
                          <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-400 font-space text-right">
                            Governance
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {cycles.map((cycle) => {
                          const isBusy = actionLoadingId === cycle.id;
                          const openDisabled = isBusy || hasOpenCycle;
                          const canEditCycle = cycle.status !== "closed";

                          return (
                            <tr
                              key={cycle.id}
                              className={`group transition-all duration-300 ${
                                isBusy ? "opacity-60" : "hover:bg-slate-50"
                              }`}
                            >
                              <td className="px-6 py-4">
                                  <span className="font-black text-slate-900 uppercase tracking-tight">
                                    {cycle.name}
                                  </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="px-2 py-1 rounded bg-slate-100 text-[10px] font-black text-slate-600 font-space">
                                    {formatDateDisplay(cycle.startDate)}
                                  </div>
                                  <div className="w-4 h-[1px] bg-slate-200" />
                                  <div className="px-2 py-1 rounded bg-slate-100 text-[10px] font-black text-slate-600 font-space">
                                    {formatDateDisplay(cycle.endDate)}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <StatusBadge status={cycle.status} />
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEdit(cycle)}
                                    disabled={!canEditCycle || isBusy}
                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all disabled:opacity-20 h-auto"
                                    icon={MdEdit}
                                  />

                                    <>
                                      {cycle.status === "open" ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => closeCycle(cycle)}
                                          disabled={isBusy}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-widest font-space hover:bg-red-100 transition-all disabled:opacity-20 h-auto"
                                          icon={MdStopCircle}
                                        >
                                          Close
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => openCycle(cycle)}
                                          disabled={openDisabled}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest font-space hover:bg-emerald-100 transition-all disabled:opacity-20 h-auto"
                                          icon={MdPlayCircleOutline}
                                        >
                                          Open
                                        </Button>
                                      )}
                                    </>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ModalLayout
        isOpen={showModal}
        onClose={closeModal}
        title={editingCycle ? "Edit Cycle" : "New Cycle"}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          {error ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
              {error}
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Name
            </label>
            <input
              placeholder="e.g. Q1 2026"
              value={form.name}
              onChange={(e) => {
                setError("");
                setForm({ ...form, name: e.target.value });
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Start Date
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => {
                  setError("");
                  setForm({ ...form, startDate: e.target.value });
                }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                End Date
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => {
                  setError("");
                  setForm({ ...form, endDate: e.target.value });
                }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </div>
          </div>
        </div>

        <ApprovalFooter
          onCancel={closeModal}
          onConfirm={handleSave}
          confirmText={editingCycle ? "Save Changes" : "Create Cycle"}
        />
      </ModalLayout>
    </AdminLayout>
  );
}
