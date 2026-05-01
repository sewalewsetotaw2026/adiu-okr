import { FiBriefcase, FiDollarSign } from "react-icons/fi";
import Card from "../../../../components/Core/ui/Card";
import InfoGrid from "../../../../components/Core/ui/InfoGrid";
import Info from "../../../../components/Core/ui/Info";
import SalaryItem from "../../../../components/Core/ui/SalaryItem";

interface JobDetailsProps {
  data?: {
    employeeId?: string;
    jobTitle?: string;
    jobLevel?: string;
    department?: string;
    employmentType?: string;
    startDate?: string;
    grossSalary?: number;
    basicSalary?: number;
    allowances?: Array<{
      amount: number;
      allowanceType?: { name: string };
    }>;
  };
}

export default function JobDetails({ data }: JobDetailsProps) {
  return (
    <div className="space-y-6 animate-[slideUp_0.3s_ease-out]">
      {/* Employment Details Card - Matching Admin UI */}
      <Card
        title="Employment Details"
        icon={<FiBriefcase />}
      >
        <InfoGrid>
          <Info label="Employee ID" value={data?.employeeId || "-"} />
          <Info label="Job Title" value={data?.jobTitle || "-"} />
          <Info label="Job Level" value={data?.jobLevel || "-"} />
          <Info label="Department" value={data?.department || "-"} />
          <Info label="Employment Type" value={data?.employmentType || "-"} />
          <Info label="Start Date" value={data?.startDate || "-"} />
        </InfoGrid>
      </Card>

      {/* Salary Breakdown Card - Matching Admin UI */}
      <Card title="Salary Breakdown" icon={<FiDollarSign />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SalaryItem
            label="Gross Salary"
            amount={Number(data?.grossSalary || 0)}
            highlight
          />
          <SalaryItem
            label="Basic Salary"
            amount={Number(data?.basicSalary || 0)}
          />
          {/* Render all allowances */}
          {(data?.allowances || []).map((allowance, idx) => (
            <SalaryItem
              key={idx}
              label={allowance.allowanceType?.name || "Allowance"}
              amount={Number(allowance.amount || 0)}
            />
          ))}
          {(!data?.allowances || data.allowances.length === 0) && (
            <div className="col-span-2 text-gray-400 text-sm italic">
              No allowances configured.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
