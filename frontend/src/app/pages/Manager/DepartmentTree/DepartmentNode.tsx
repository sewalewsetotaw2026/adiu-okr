import React, { memo } from "react";
import { Handle, Position } from "reactflow";
import { MdBusiness } from "react-icons/md";

interface DepartmentNodeData {
  name: string;
  employeeCount: number;
}

const DepartmentNode = ({ data }: { data: DepartmentNodeData }) => {
  return (
    <div className="w-[320px] bg-primary/10 border border-primary/20 rounded-xl shadow-sm px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <MdBusiness className="text-primary shrink-0" size={18} />
          <h4 className="font-semibold text-primary truncate" title={data.name}>
            {data.name}
          </h4>
        </div>
        <span className="text-xs font-medium bg-white text-primary px-2 py-1 rounded-full border border-primary/20 shrink-0">
          {data.employeeCount}{" "}
          {data.employeeCount === 1 ? "Employee" : "Employees"}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="bg-primary!"
      />
    </div>
  );
};

export default memo(DepartmentNode);
