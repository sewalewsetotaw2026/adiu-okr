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
import { okrErrorMessage } from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import Button from "../../../components/Core/ui/Button";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";

export default function ReviewDashboard() {
  const [submissions, setSubmissions] = useState<PlanSubmission[]>([]);
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
        return;
      }
      const data = await fetchManagerSubmissions(cycleId);
      setSubmissions(data);
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
          ) : submissions.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-white shadow-xl shadow-slate-200/50 flex items-center justify-center mb-6">
                <MdPendingActions className="text-4xl text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">You're all caught up!</h3>
              <p className="text-slate-500 max-w-sm">There are no execution plans waiting for your review at the moment.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {renderSection("Pending Monthly Plans", monthlyPlans, "MONTHLY")}
              {renderSection("Pending Weekly Plans", weeklyPlans, "WEEKLY")}
            </div>
          )}
        </ExecutionShell>
      </div>
    </EmployeeLayout>
  );
}
