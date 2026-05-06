import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import RefreshButton from "../../../components/common/RefreshButton";
import { 
  MdFactCheck, 
  MdPendingActions, 
  MdChevronRight, 
  MdPerson,
  MdDateRange,
  MdEventNote
} from "react-icons/md";
import { fetchManagerSubmissions } from "../../../services/okr-execution.api";
import { PlanSubmission } from "../../../../types/okr.types";
import { okrErrorMessage, okrAsArray, okrUnwrap } from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import Button from "../../../components/Core/ui/Button";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";

export default function ReviewDashboard() {
  const [submissions, setSubmissions] = useState<PlanSubmission[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [alignmentStatus, setAlignmentStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycleId = Number(cycleRes?.data?.data?.id ?? cycleRes?.data?.id);
      if (!cycleId) {
        setSubmissions([]);
        setChangeRequests([]);
        setAlignmentStatus([]);
        return;
      }
      const data = await fetchManagerSubmissions(cycleId);
      setSubmissions(data);

      try {
        const crRes = await makeCall({
          method: "GET",
          route: apiRoutes.okr.changeRequests.myReviews + `?cycle_id=${cycleId}`,
          isSecureRoute: true,
        });
        const crData = okrAsArray(okrUnwrap(crRes));
        setChangeRequests(crData || []);
      } catch (crErr) {
        console.warn("Failed to fetch change requests", crErr);
      }

      try {
        const alignRes = await makeCall({
          method: "GET",
          route: apiRoutes.okr.changeRequests.subordinateAlignment + `?cycle_id=${cycleId}`,
          isSecureRoute: true,
        });
        const alignData = okrAsArray(okrUnwrap(alignRes));
        setAlignmentStatus(alignData || []);
      } catch (alignErr) {
        console.warn("Failed to fetch alignment status", alignErr);
      }
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const monthlyPlans = submissions.filter(s => s.plan_type === "MONTHLY");
  const weeklyPlans = submissions.filter(s => s.plan_type === "WEEKLY");

  const renderSection = (title: string, items: PlanSubmission[], type: "MONTHLY" | "WEEKLY") => (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          {type === "MONTHLY" ? <MdDateRange className="text-primary" /> : <MdEventNote className="text-info" />}
          {title}
          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">
            {items.length}
          </span>
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-500">No pending {title.toLowerCase()} for review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div 
              key={item.id} 
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                    {item.avatar_url ? (
                      <img src={item.avatar_url} alt={item.employee_name} className="w-full h-full object-cover" />
                    ) : (
                      <MdPerson className="text-slate-400 text-xl" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">
                      {item.employee_name}
                    </h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      {item.plan_type === "MONTHLY" ? item.cycle_name : `Week ${item.week_number}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 mb-4 flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">Planned Items</span>
                <span className="text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-100 shadow-xs">
                  {item.item_count}
                </span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-[10px] text-slate-400 italic">
                  Submitted {new Date(item.submitted_at).toLocaleDateString()}
                </span>
                <Link to={`/okr/reviews/${item.id}`}>
                  <Button size="sm" icon={MdChevronRight} className="rounded-xl h-9">
                    Review Now
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const renderChangeRequests = (title: string, items: any[]) => (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-600 flex items-center gap-2">
          <MdFactCheck className="text-amber-500" />
          {title}
          <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-bold">
            {items.length}
          </span>
        </h2>
      </div>

      {items.length === 0 ? null : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div 
              key={item.id} 
              className="bg-white rounded-2xl p-5 shadow-sm border border-amber-200 hover:shadow-md hover:border-amber-400/50 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center overflow-hidden border border-amber-200">
                    <MdPerson className="text-amber-500 text-xl" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-amber-600 transition-colors">
                      {item.requester?.full_name || 'Team Member'}
                    </h3>
                    <p className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold">
                      {String(item.entity_type).replace(/_/g, ' ')} EDIT
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 mb-4 flex flex-col gap-1">
                <span className="text-xs text-slate-600 font-medium">Request to modify approved plan</span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-[10px] text-slate-400 italic">
                  Requested {new Date(item.created_at).toLocaleDateString()}
                </span>
                <Link to={`/okr/reviews/change-requests/${item.id}`}>
                  <Button size="sm" icon={MdChevronRight} className="rounded-xl h-9 !bg-amber-500 hover:!bg-amber-600 !text-white !border-none shadow-sm shadow-amber-200">
                    Review Edit
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const renderAlignmentStatus = () => (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <MdFactCheck className="text-primary" />
          Team Alignment Status
        </h2>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
            <tr>
              <th className="px-6 py-4">Team Member</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-center">Pending</th>
              <th className="px-6 py-4 text-center">Acknowledged</th>
              <th className="px-6 py-4 text-center">Realigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alignmentStatus.map(status => (
              <tr key={status.employee_id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-semibold text-slate-800">
                  {status.employee_name}
                </td>
                <td className="px-6 py-4 text-center">
                  {status.is_aligned ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                      Aligned
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                      Realignment Needed
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-center tabular-nums font-medium text-slate-700">{status.pending}</td>
                <td className="px-6 py-4 text-center tabular-nums font-medium text-slate-700">{status.acknowledged}</td>
                <td className="px-6 py-4 text-center tabular-nums font-medium text-slate-700">{status.realigned}</td>
              </tr>
            ))}
            {alignmentStatus.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No alignment data available for this cycle.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-slate-50/50 -mx-4 md:-mx-8 px-4 md:px-8">
        <ExecutionShell
          breadcrumbs={[
            { label: "OKR Management" },
            { label: "Review Dashboard" },
          ]}
          title="OKR Review Dashboard"
          subtitle="Review and approve pending Monthly and Weekly execution plans from your team."
          icon={<MdFactCheck className="text-2xl" />}
          actions={<RefreshButton onClick={loadSubmissions} loading={loading} />}
        >
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-slate-500 animate-pulse">Fetching pending reviews...</p>
            </div>
          ) : submissions.length === 0 && changeRequests.length === 0 && alignmentStatus.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-white shadow-xl shadow-slate-200/50 flex items-center justify-center mb-6">
                <MdPendingActions className="text-4xl text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">You're all caught up!</h3>
              <p className="text-slate-500 max-w-sm">There are no execution plans or change requests waiting for your review at the moment.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {alignmentStatus.length > 0 && renderAlignmentStatus()}
              {changeRequests.length > 0 && renderChangeRequests("Pending Change Requests", changeRequests)}
              {renderSection("Pending Monthly Plans", monthlyPlans, "MONTHLY")}
              {renderSection("Pending Weekly Plans", weeklyPlans, "WEEKLY")}
            </div>
          )}
        </ExecutionShell>
      </div>
    </EmployeeLayout>
  );
}
