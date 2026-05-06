import { useEffect, useState, useMemo } from "react";
import { MdWarning } from "react-icons/md";
import Button from "../../../components/Core/ui/Button";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import ToastService from "../../../../utils/ToastService";

interface RealignmentFlag {
  id: number;
  change_request_id: number;
  affected_entity_type: string;
  affected_entity_id: number;
  status: string;
  changeRequest: {
    entity_title: string;
    change_summary: string;
  };
}

import { okrAsArray, okrUnwrap } from "../../../utils/okrApi";

export default function RealignmentBanner() {
  const [flags, setFlags] = useState<RealignmentFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState<Set<number>>(new Set());

  const fetchFlags = async () => {
    try {
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.changeRequests.realignmentFlags,
        query: { status: "PENDING" },
        isSecureRoute: true
      });
      const data = okrAsArray(okrUnwrap(res)) as RealignmentFlag[];
      setFlags(data || []);
    } catch (err) {
      console.error("Failed to fetch realignment flags", err);
      setFlags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const groupedFlags = useMemo(() => {
    const groups = new Map<number, RealignmentFlag[]>();
    for (const flag of flags) {
      if (!groups.has(flag.change_request_id)) {
        groups.set(flag.change_request_id, []);
      }
      groups.get(flag.change_request_id)!.push(flag);
    }
    return Array.from(groups.values());
  }, [flags]);

  const handleAcknowledgeGroup = async (groupFlags: RealignmentFlag[]) => {
    const crId = groupFlags[0].change_request_id;
    setAcknowledging(prev => new Set(prev).add(crId));
    try {
      await Promise.all(
        groupFlags.map(f =>
          makeCall({
            method: "POST",
            route: apiRoutes.okr.changeRequests.acknowledgeRealignment(f.id),
            isSecureRoute: true
          })
        )
      );
      ToastService.success("Realignment acknowledged.");
      fetchFlags();
    } catch (err) {
      ToastService.error("Could not acknowledge realignment.");
    } finally {
      setAcknowledging(prev => {
        const next = new Set(prev);
        next.delete(crId);
        return next;
      });
    }
  };

  if (loading || groupedFlags.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {groupedFlags.map((group) => {
        const primaryFlag = group[0];
        const isAcking = acknowledging.has(primaryFlag.change_request_id);
        return (
          <div key={primaryFlag.change_request_id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4 shadow-sm">
            <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0 mt-0.5">
              <MdWarning className="text-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-amber-900 truncate">
                Alignment Warning: {primaryFlag.changeRequest?.entity_title || "Parent Plan"} has changed
              </h4>
              <p className="text-sm text-amber-800 mt-1">
                Your manager updated a parent plan. Please review your corresponding plans and ensure they still align.
                {group.length > 1 && <span className="font-semibold ml-1">(Affects {group.length} of your items)</span>}
              </p>
              <div className="text-xs font-mono text-amber-700 bg-amber-100/50 p-2 rounded mt-2 border border-amber-200/50 overflow-x-auto">
                {primaryFlag.changeRequest?.change_summary || "No specific changes recorded."}
              </div>
              <div className="mt-3 flex gap-2">
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={() => handleAcknowledgeGroup(group)} 
                  disabled={isAcking}
                  className="bg-amber-600 hover:bg-amber-700 border-none"
                >
                  {isAcking ? "Acknowledging..." : "Acknowledge"}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
