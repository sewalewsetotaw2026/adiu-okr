import { useNavigate } from "react-router-dom";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import Button from "../../../../components/Core/ui/Button";
import { MdChevronRight, MdFactCheck } from "react-icons/md";
import { routeConstants } from "../../../../../utils/constants";
import SubmissionApprovalQueue from "../../../OKRExecution/components/SubmissionApprovalQueue";

export default function DepartmentApprovalQueuePage() {
  const navigate = useNavigate();

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
          <nav className="flex flex-wrap items-center gap-2 text-sm pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(routeConstants.okr)}
              className="text-gray-500 hover:text-gray-800 transition-colors p-0 h-auto font-normal"
            >
              OKR
            </Button>
            <MdChevronRight className="text-gray-300 shrink-0 text-lg" />
            <span className="text-gray-800 font-medium">Approvals</span>
          </nav>

          <PageHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl ring-1 ring-white/20 shadow-inner">
                <MdFactCheck className="text-3xl text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tighter text-white capitalize">
                  Plan Approvals
                </h1>
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest font-space mt-2">
                  Review execution plan submissions
                </p>
              </div>
            </div>
          </PageHeader>

          <SubmissionApprovalQueue viewerType="admin" />
        </div>
      </div>
    </AdminLayout>
  );
}
