import { useEffect, useState } from "react";
import { MdWarning, MdInfo, MdClose, MdRefresh } from "react-icons/md";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import toast from "react-hot-toast";

interface RealignmentFlag {
  id: number;
  changeRequest: {
    change_summary: string;
    requester_id: string;
    old_values_json: any;
    new_values_json: any;
  };
  affected_entity_type: string;
  affected_entity_id: number;
}

export default function RealignmentBanner() {
  const [flags, setFlags] = useState<RealignmentFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchFlags = async () => {
    try {
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.realignmentFlags,
        isSecureRoute: true,
      });
      if (res.status === 200) {
        setFlags(res.data?.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch realignment flags:", err);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const handleDismiss = async (flagId: number) => {
    const reason = window.prompt("Reason for dismissal:");
    if (reason === null) return;

    try {
      await makeCall({
        method: "POST",
        route: apiRoutes.okr.dismissRealignmentFlag(flagId),
        body: { reason },
        isSecureRoute: true,
      });
      toast.success("Flag dismissed");
      fetchFlags();
    } catch (err) {
      toast.error("Failed to dismiss flag");
    }
  };

  if (flags.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {flags.map((flag) => (
        <div 
          key={flag.id}
          className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4"
        >
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <MdWarning className="text-2xl" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-amber-900">Realignment Required</p>
                <p className="text-xs text-amber-700 font-medium">
                  Your manager updated their plan: <span className="italic">"{flag.changeRequest.change_summary}"</span>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedId(expandedId === flag.id ? null : flag.id)}
                className="px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
              >
                {expandedId === flag.id ? "Hide Changes" : "View Changes"}
              </button>
              <button
                onClick={() => handleDismiss(flag.id)}
                className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>

          {expandedId === flag.id && (
            <div className="px-4 pb-4 border-t border-amber-200/50 bg-white/40 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-800/50">Previous Values</p>
                  <ChangeSummary values={flag.changeRequest.old_values_json} />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-green-800/50">New Values</p>
                  <ChangeSummary values={flag.changeRequest.new_values_json} isNew />
                </div>
              </div>
              <p className="mt-4 text-[11px] text-amber-800/70 bg-amber-100/50 p-2 rounded-lg italic">
                Please review and realign your related {flag.affected_entity_type.replace('_', ' ').toLowerCase()}.
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChangeSummary({ values, isNew }: { values: any, isNew?: boolean }) {
  if (!values) return <p className="text-xs text-gray-400">No data</p>;
  
  const fields = [
    { key: 'title', label: 'Title' },
    { key: 'target_value', label: 'Target' },
    { key: 'weight_percent', label: 'Weight' },
    { key: 'weight_pct', label: 'Weight' },
  ];

  return (
    <div className={`p-3 rounded-xl border ${isNew ? 'bg-green-50/50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
      <div className="space-y-2">
        {fields.map(f => {
          const val = values[f.key];
          if (val === undefined || val === null) return null;
          return (
            <div key={f.key} className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase">{f.label}:</span>
              <span className={`text-xs truncate max-w-[150px] font-medium ${isNew ? 'text-green-700' : 'text-slate-600'}`}>
                {f.key.includes('weight') ? `${val}%` : val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
