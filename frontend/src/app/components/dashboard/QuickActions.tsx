import React from "react";
import { Link } from "react-router-dom";
import { MdCalendarToday, MdTrackChanges, MdAssignment, MdReceipt, MdPerson, MdEvent } from "react-icons/md";

const actions = [
  { label: "Apply for Leave", icon: MdCalendarToday, path: "/employee/leave" },
  { label: "KPI Goals", icon: MdTrackChanges, path: "/employee/kpi" },
  { label: "Take Appraisal", icon: MdAssignment, path: "/employee/appraisal" },
  { label: "View Payslip", icon: MdReceipt, path: "/employee/payslip" },
  { label: "Update Profile", icon: MdPerson, path: "/employee/profile" },
  { label: "Events", icon: MdEvent, path: "/employee/events" },
];

export default function QuickActions() {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-k-dark-grey mb-4">Quick Actions</h3>
      <div className="flex flex-wrap gap-4">
        {actions.map((action, index) => (
          <Link
            key={index}
            to={action.path}
            className="flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-sm border border-gray-100 hover:shadow-md hover:border-primary transition-all duration-300 group"
          >
            <action.icon className="text-k-medium-grey group-hover:text-primary text-lg transition-colors" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-k-dark-grey">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
