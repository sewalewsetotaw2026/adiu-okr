import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import { routeConstants } from "../../../../utils/constants";
import { MdFactCheck } from "react-icons/md";
import SubmissionApprovalQueue from "../components/SubmissionApprovalQueue";

export default function ApprovalQueuePage() {
  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white -mx-4 md:-mx-8 px-4 md:px-8">
        <ExecutionShell
          breadcrumbs={[
            { label: "My team", to: routeConstants.managerMyTeam },
            { label: "Approvals" },
          ]}
          title="Approvals"
          subtitle="Review and approve pending employee execution submissions."
          icon={<MdFactCheck className="text-2xl" />}
        >
          <SubmissionApprovalQueue viewerType="manager" />
        </ExecutionShell>
      </div>
    </EmployeeLayout>
  );
}
