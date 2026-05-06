import { useState, useEffect } from "react";
import { MdClose, MdSave } from "react-icons/md";
import Button from "../../../components/Core/ui/Button";
import FormSelect from "../../../components/Core/ui/FormSelect";
import FormInput from "../../../components/Core/ui/FormInput";
import { 
  DayOfWeek, 
  WeeklyPlan, 
  CreateDailyPlanDTO,
  MetricDefinition
} from "../../../../types/okr.types";
import { createDailyPlan, fetchMetricDefinitions } from "../../../services/okr-execution.api";
import ToastService from "../../../../utils/ToastService";

interface AddDailyTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  publishedWeeklyPlans: WeeklyPlan[];
  initialDay?: DayOfWeek;
}

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
];

export default function AddDailyTaskModal({
  open,
  onClose,
  onSuccess,
  publishedWeeklyPlans,
  initialDay
}: AddDailyTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateDailyPlanDTO & { weeklyPlanId: string }>({
    weeklyPlanId: "",
    completion_day: (initialDay || "MONDAY") as DayOfWeek,
    title: "",
    target_value: 0,
    start_value: 0,
    contribute_to_score: true,
    contribute_to_value: true,
    metric_definition_id: undefined as number | undefined,
  });
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);

  // Pre-select today's day if no initialDay provided
  useEffect(() => {
    if (!initialDay) {
      const days: DayOfWeek[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const todayIndex = new Date().getDay();
      setFormData(prev => ({ ...prev, completion_day: days[todayIndex] }));
    } else {
      setFormData(prev => ({ ...prev, completion_day: initialDay }));
    }
  }, [initialDay, open]);

  useEffect(() => {
    if (open) {
      fetchMetricDefinitions().then(setMetrics).catch(console.error);
    }
  }, [open]);

  if (!open) return null;

  // Determine if value fields should be hidden
  const selectedMetric = metrics.find((m) => m.id === formData.metric_definition_id);
  const isBinary = selectedMetric?.allows_binary_completion ?? false;
  const isNonNumeric = selectedMetric?.category === "MILESTONE" || selectedMetric?.category === "RATING" || selectedMetric?.category === "CUSTOM";
  const hideValueFields = isBinary || isNonNumeric;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.weeklyPlanId) {
      ToastService.error("Please select a parent weekly plan");
      return;
    }
    if (!formData.title.trim()) {
      ToastService.error("Title is required");
      return;
    }
    // Only validate target value for numeric metrics
    if (!hideValueFields && (formData.target_value ?? 0) <= 0) {
      ToastService.error("Target value must be greater than 0");
      return;
    }

    setLoading(true);
    try {
      await createDailyPlan(formData.weeklyPlanId, {
        title: formData.title,
        completion_day: formData.completion_day,
        target_value: formData.target_value,
        start_value: formData.start_value,
        contribute_to_score: formData.contribute_to_score,
        contribute_to_value: formData.contribute_to_value,
        metric_definition_id: formData.metric_definition_id,
      });
      ToastService.success(`${formData.title} added to ${formData.completion_day.toLowerCase()}`);
      onSuccess();
    } catch (e) {
      console.error("Failed to create daily plan", e);
      ToastService.error("Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Add Daily Task</h3>
            <p className="text-sm text-slate-500">Plan your execution for the week</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-all shadow-sm"
          >
            <MdClose className="text-2xl" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
          <FormSelect
            label="Parent Weekly Plan"
            required
            value={formData.weeklyPlanId}
            onChange={(e: any) => setFormData({ ...formData, weeklyPlanId: e.target.value })}
            options={publishedWeeklyPlans.map(wp => ({
              value: wp.id,
              label: `Week ${wp.week_number} — ${wp.title}`
            }))}
            placeholder={publishedWeeklyPlans.length === 0 ? "No published weekly plans" : "Select published weekly plan"}
            disabled={publishedWeeklyPlans.length === 0}
          />
          {publishedWeeklyPlans.length === 0 && (
            <p className="text-xs text-amber-600 mt-[-1rem]">
              Note: You must publish a weekly plan before you can add daily tasks.
            </p>
          )}

          <FormSelect
            label="Completion Day"
            required
            value={formData.completion_day}
            onChange={(e: any) => setFormData({ ...formData, completion_day: e.target.value as DayOfWeek })}
            options={DAYS}
          />

          <FormSelect
            label="Metric Definition"
            value={formData.metric_definition_id?.toString() || ""}
            onChange={(e: any) =>
              setFormData({
                ...formData,
                metric_definition_id:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            options={metrics.map((m) => ({
              value: m.id.toString(),
              label: `${m.name} (${m.unit_of_measure || m.unit || "N/A"})`,
            }))}
            placeholder="Auto-inherit from Weekly Plan"
          />

          <FormInput
            label="Task Title"
            required
            placeholder="What needs to be done?"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />

          {hideValueFields ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="font-medium">Note:</span> {selectedMetric?.category === "MILESTONE" ? "Milestone" : isBinary ? "Binary" : "Non-numeric"} metrics don't require target/start values.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Target Value"
                type="number"
                required
                min={1}
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })}
              />
              <FormInput
                label="Start Value"
                type="number"
                value={formData.start_value}
                onChange={(e) => setFormData({ ...formData, start_value: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}

          <div className="space-y-4 pt-4 border-t border-slate-50">
            {!selectedMetric?.value_based_progress && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer" onClick={() => setFormData(f => ({...f, contribute_to_score: !f.contribute_to_score}))}>
                <div>
                  <p className="text-sm font-bold text-slate-700">Contribute to Score</p>
                  <p className="text-[10px] text-slate-500">Task completion affects overall KR score</p>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.contribute_to_score ? 'bg-primary' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.contribute_to_score ? 'right-1' : 'left-1'}`} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer" onClick={() => setFormData(f => ({...f, contribute_to_value: !f.contribute_to_value}))}>
              <div>
                <p className="text-sm font-bold text-slate-700">Contribute to Value</p>
                <p className="text-[10px] text-slate-500">Update progress affects the KR current value</p>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.contribute_to_value ? 'bg-primary' : 'bg-slate-300'}`}>
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.contribute_to_value ? 'right-1' : 'left-1'}`} />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
          <Button variant="outline" fullWidth onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            fullWidth 
            icon={MdSave} 
            loading={loading}
            onClick={handleSubmit}
            disabled={publishedWeeklyPlans.length === 0}
          >
            Save Task
          </Button>
        </div>
      </div>
    </div>
  );
}
