import React from "react";
import { MdDownload, MdHistory, MdEmail } from "react-icons/md";
import CardMenu from "./CardMenu";

const PayRow = ({ label, amount, deduction, total }) => (
  <div className="grid grid-cols-4 gap-2 py-2 border-b border-gray-50 last:border-0 text-sm">
    <span className="text-gray-600">{label}</span>
    <span className="text-gray-900 font-medium">{amount}</span>
    <span className="text-red-500">{deduction}</span>
    <span className="text-gray-900 font-bold text-right">{total}</span>
  </div>
);

import toast from "react-hot-toast";

export default function PaySlipWidget() {
  const actions = [
    { label: "Download PDF", icon: MdDownload, onClick: () => toast.success("Payslip PDF downloaded successfully") },
    { label: "View History", icon: MdHistory, onClick: () => toast("Redirecting to Payslip History...", { icon: "📄" }) },
    { label: "Email Payslip", icon: MdEmail, onClick: () => toast.success("Payslip emailed to your registered address") },
  ];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-card h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-k-dark-grey">April Pay slip breakdown</h3>
        <CardMenu actions={actions} />
      </div>

      <div className="bg-blue-50/50 rounded-lg p-4">
        <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-500 uppercase mb-3">
          <span>Earnings</span>
          <span>Amount</span>
          <span>Deductions</span>
          <span className="text-right">Total</span>
        </div>

        <PayRow label="Basic Wage" amount="150,000" deduction="-30,000" total="120,000" />
        <PayRow label="Tax" amount="15,000" deduction="-3,000" total="12,000" />
        <PayRow label="Pension" amount="15,000" deduction="-3,000" total="12,000" />

        <div className="grid grid-cols-4 gap-2 pt-3 mt-2 border-t border-gray-200 text-sm font-bold">
          <span className="text-gray-800">Total Earnings</span>
          <span className="text-gray-800">180,000</span>
          <span className="text-red-500">-36,000</span>
          <span className="text-primary text-right">144,000</span>
        </div>
      </div>
    </div>
  );
}
