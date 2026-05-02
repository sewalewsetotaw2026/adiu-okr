import { useState } from "react";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import { FiShield } from "react-icons/fi";
import AccountSecurity from "../../../components/common/AccountSecurity";

export default function EmployeeSettings() {
  const [activeTab, setActiveTab] = useState("security");

  const tabs = [
    { id: "security", label: "Account Security", icon: <FiShield /> },
  ];

  return (
    <EmployeeLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Account Settings</h1>

        {/* Horizontal Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                  ${activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <span className={`text-lg transition-colors ${activeTab === tab.id ? 'text-primary' : 'text-gray-400'}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="min-h-[500px]">
          {activeTab === "security" && <AccountSecurity />}
        </div>
      </div>
    </EmployeeLayout>
  );
}
