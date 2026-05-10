import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../components/common/PageHeader";
import { MdSettings, MdArrowBack } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/Core/ui/Button";
import EmployeeSettingsTab from "./components/EmployeeSettingsTab";
import { Helmet } from "react-helmet-async";

export default function EmployeeSettingsPage() {
  const navigate = useNavigate();

  return (
    <AdminLayout>
      <Helmet>
        <title>Employee Settings | ADIU Communication Service PLC</title>
      </Helmet>
      <div className="max-w-7xl mx-auto space-y-8">
        <PageHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/admin/employees")}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  title="Back to Employees"
                >
                  <MdArrowBack size={20} />
                </button>
                <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                  <MdSettings className="text-white" />
                  Employee Settings
                </h1>
              </div>
              <p className="text-white-200 mt-1 ml-11">
                Configure system-wide rules for employee management
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => navigate("/admin/employees")}
                variant="white"
                icon={MdArrowBack}
              >
                Back to Employees
              </Button>
            </div>
          </div>
        </PageHeader>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <EmployeeSettingsTab />
        </div>
      </div>
    </AdminLayout>
  );
}
