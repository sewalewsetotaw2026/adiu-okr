export interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export default function TabBar({
  tabs,
  activeTab,
  onChange,
  className = "",
}: TabBarProps) {
  return (
    <div
      className={`flex overflow-x-auto max-w-full gap-1 bg-gray-100 p-1 rounded-xl ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-shrink-0 px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap cursor-pointer ${activeTab === tab.id
              ? "bg-primary text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-1.5 ${activeTab === tab.id ? "text-white/80" : "text-gray-400"
                }`}
            >
              ({tab.count})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
