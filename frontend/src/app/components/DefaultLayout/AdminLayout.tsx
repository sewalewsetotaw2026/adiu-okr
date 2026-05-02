import React from "react";
import Sidebar from "../Sidebars/AdminSidebar";
import Header from "../Header/AdminHeader";
import { useSidebar } from "../../context/SidebarContext";
import { useCompanyTheme } from "../../hooks/useCompanyTheme";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { isOpen } = useSidebar();
  useCompanyTheme();

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[#F5F5F5] print:h-auto print:overflow-visible">
      <Sidebar />
      <div
        className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ${isOpen ? "lg:ml-72" : "lg:ml-24"
          } print:ml-0 print:h-auto print:overflow-visible`}
      >
        <Header />
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 print:h-auto print:overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
}
