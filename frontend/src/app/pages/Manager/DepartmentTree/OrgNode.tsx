import React, { memo } from "react";
import { Handle, Position } from "reactflow";
import { MdBusiness, MdPerson } from "react-icons/md";

// Interface for Node Data
interface OrgNodeData {
  id: string;
  name: string;
  title: string;
  avatar?: string;
  department_name: string;
  gender?: string;
  isDepartmentHead?: boolean;
}

const OrgNode = ({ data }: { data: OrgNodeData }) => {
  return (
    <div className="w-70 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Helper Handles for React Flow connections */}
      <Handle type="target" position={Position.Top} className="bg-gray-300!" />

      <div className="flex items-center p-3 gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          {data.avatar ? (
            <img
              src={data.avatar}
              alt={data.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
            />
          ) : (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-xl text-white shadow-sm ${
                data.gender === "Female" ? "bg-pink-400" : "bg-blue-400"
              }`}
            >
              {data.name.charAt(0)}
            </div>
          )}
          {data.isDepartmentHead && (
            <div className="absolute -bottom-1 -right-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm border border-white">
              LEAD
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0">
          <h4
            className="font-bold text-k-dark-grey text-sm truncate"
            title={data.name}
          >
            {data.name}
          </h4>
          <p
            className="text-xs text-primary font-medium truncate"
            title={data.title}
          >
            {data.title}
          </p>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
            <MdBusiness className="text-gray-400" />
            <span className="truncate max-w-35" title={data.department_name}>
              {data.department_name}
            </span>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="bg-gray-300!"
      />
    </div>
  );
};

export default memo(OrgNode);
