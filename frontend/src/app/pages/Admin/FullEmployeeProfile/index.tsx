import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { useEmployeesSlice } from "../Employees/slice";
import {
  selectAllEmployees,
  selectEmployeesLoading,
} from "../Employees/slice/selectors";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import Button from "../../../components/Core/ui/Button";
import LoadingScreen from "../../../components/Core/ui/LoadingScreen";
import useMinimumDelay from "../../../hooks/useMinimumDelay";
import BackButton from "../../../components/common/BackButton";
import PageHeader from "../../../components/common/PageHeader";
import exportService, { ExportFormat } from "../../../services/exportService";
import ToastService from "../../../../utils/ToastService";
import {
  FiArrowLeft,
  FiMail,
  FiPhone,
  FiMapPin,
  FiAward,
  FiBookOpen,
  FiFile,
  FiUser,
  FiDownload,
  FiExternalLink,
  FiBriefcase,
  FiDollarSign,
  FiCheck,
  FiPrinter,
} from "react-icons/fi";
import { MdPictureAsPdf, MdTableChart, MdDescription } from "react-icons/md";
import { Employee } from "../Employees/slice/types";
import { formatDate as formatDayjsDate } from "../../../utils/dayjs-format";

// Section configuration
const SECTIONS = [
  { id: "personal", label: "Personal Details" },
  { id: "contact", label: "Contact Details" },
  { id: "employment", label: "Employment" },
  { id: "compensation", label: "Compensation" },
  { id: "education", label: "Education" },
  { id: "workExperience", label: "Previous Work Experience" },
  { id: "certifications", label: "Certifications" },
  { id: "documents", label: "Documents" },
];

export default function FullEmployeeProfile() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const { actions } = useEmployeesSlice();

  const completedEmployees = useSelector(selectAllEmployees);
  const isLoading = useSelector(selectEmployeesLoading);

  const showLoading = useMinimumDelay(isLoading, 800);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [selectedSections, setSelectedSections] = useState<string[]>(
    SECTIONS.map((s) => s.id),
  );
  const [exporting, setExporting] = useState(false);

  // Fetch employees if not loaded
  useEffect(() => {
    if (completedEmployees.length === 0) {
      dispatch(actions.fetchAllEmployeesRequest());
    }
  }, [dispatch, actions, completedEmployees.length]);

  // Find employee from list
  useEffect(() => {
    if (completedEmployees.length > 0 && employeeId) {
      const found = completedEmployees.find(
        (e: any) =>
          e.employee_id === employeeId || e.id?.toString() === employeeId,
      );
      if (found) {
        setEmployee(found);
      }
    }
  }, [completedEmployees, employeeId]);

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((s) => s !== sectionId)
        : [...prev, sectionId],
    );
  };

  const handleSelectAll = () => {
    setSelectedSections(SECTIONS.map((s) => s.id));
  };

  const handleDeselectAll = () => {
    setSelectedSections([]);
  };

  const handleExport = async (format: ExportFormat) => {
    if (!employeeId || selectedSections.length === 0) {
      ToastService.error("Please select at least one section to export");
      return;
    }

    try {
      setExporting(true);
      const blob = await exportService.exportEmployeeProfile(
        employeeId,
        format,
        selectedSections,
      );
      const filename = `employee_${employeeId}_profile.${exportService.getFileExtension(
        format,
      )}`;
      exportService.downloadFile(blob, filename);
      ToastService.success(`Profile exported as ${format.toUpperCase()}`);
    } catch (err: any) {
      ToastService.error(err?.message || "Failed to export profile");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return formatDayjsDate(dateString, "N/A");
  };

  const getGenderLabel = (gender: string | null) => {
    if (!gender) return "N/A";
    return gender;
  };

  const getAvatarUrl = (gender: string | null, id: string) => {
    const num =
      (id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 50) +
      1;
    const offset = gender ? 50 : 0;
    return `https://avatar.iran.liara.run/public/${num + offset}`;
  };

  if (showLoading) {
    <AdminLayout>
      <LoadingScreen />
    </AdminLayout>;
  }

  if (!employee) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <FiUser className="w-16 h-16 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-600">
            Employee not found
          </h2>
          <Button
            onClick={() => navigate("/admin/employees")}
            icon={FiArrowLeft}
            variant="outline"
          >
            Back to Employees
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const emp = employee;

  const documents =
    emp?.documents?.reduce((acc: any, doc: any) => {
      let key = doc.document_type?.toLowerCase() || "other";
      if (key.includes("cv") || key.includes("resume")) key = "cv";
      else if (key.includes("certificate")) key = "certificates";
      else if (key.includes("experience")) key = "experienceLetters";
      else if (key.includes("tax")) key = "taxForms";
      else if (key.includes("pension")) key = "pensionForms";
      else if (key.includes("photo")) key = "photo";

      if (!acc[key]) acc[key] = [];
      acc[key].push(doc.document_url);
      return acc;
    }, {}) || {};

  return (
    <AdminLayout>
      <div className="min-h-screen pb-12 print:bg-white print:p-0">
        {/* Header */}
        <PageHeader className="rounded-b-3xl -mx-6 md:-mx-8 -mt-6 md:-mt-8 mb-8 pt-8 pb-24 h-52 print:hidden">
          <div className="max-w-7xl mx-auto relative z-10">
            <BackButton
              to={`/admin/employees/${employeeId}`}
              label="Back to Employee Profile"
              className="text-gray-300! hover:text-white!"
            />
            <h1 className="text-3xl font-bold mb-2">Full Employee Profile</h1>
            <p className="text-gray-300">
              Complete employee information on a single page
            </p>
          </div>
        </PageHeader>

        <div className="max-w-7xl mx-auto -mt-24 relative z-10 print:mt-0">
          {/* Control Panel - Hide on print */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 print:hidden">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Section Toggles */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-700">
                    Select Sections to Display/Export
                  </h3>
                  <div className="flex gap-2 text-sm">
                    <button
                      onClick={handleSelectAll}
                      className="text-k-orange hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={handleDeselectAll}
                      className="text-gray-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SECTIONS.map((section) => {
                    const isSelected = selectedSections.includes(section.id);
                    return (
                      <button
                        key={section.id}
                        onClick={() => toggleSection(section.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary-light text-primary border border-primary/30"
                            : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-gray-300"
                          }`}
                        >
                          {isSelected && (
                            <FiCheck className="w-3 h-3 text-white" />
                          )}
                        </div>
                        {section.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex flex-col gap-2 lg:border-l lg:pl-6">
                <p className="text-sm font-medium text-gray-500 mb-1">
                  Export As
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    icon={MdPictureAsPdf}
                    onClick={() => handleExport("pdf")}
                    loading={exporting}
                    disabled={exporting || selectedSections.length === 0}
                    className="text-red-600! border-red-200! hover:bg-red-50!"
                  >
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    icon={MdTableChart}
                    onClick={() => handleExport("csv")}
                    loading={exporting}
                    disabled={exporting || selectedSections.length === 0}
                    className="text-green-600! border-green-200! hover:bg-green-50!"
                  >
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    icon={MdDescription}
                    onClick={() => handleExport("xlsx")}
                    loading={exporting}
                    disabled={exporting || selectedSections.length === 0}
                    className="text-green-700! border-green-200! hover:bg-green-50!"
                  >
                    Excel
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  icon={FiPrinter}
                  onClick={handlePrint}
                  className="mt-2"
                >
                  Print
                </Button>
              </div>
            </div>
          </div>

          {/* Employee Header Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-k-yellow border-4 border-white overflow-hidden shadow-lg shrink-0">
                {documents.photo?.[0] ? (
                  <img
                    src={documents.photo[0]}
                    alt={emp.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={getAvatarUrl(emp?.gender, employee.employee_id)}
                    alt={emp?.full_name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-k-dark-grey">
                  {emp?.full_name || employee.employee_id}
                </h1>
                <p className="text-gray-500">{employee.email}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">
                    {employee.employee_id}
                  </span>
                  <span
                    className={`text-sm px-3 py-1 rounded-full ${
                      (employee as any)?.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {(employee as any)?.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {/* Personal Details */}
            {selectedSections.includes("personal") &&
              (emp?.full_name !== null ||
                emp?.gender !== null ||
                emp?.date_of_birth !== null) && (
                <SectionCard title="Personal Details" icon={FiUser}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <InfoItem label="Full Name" value={emp?.full_name} />
                    <InfoItem
                      label="Gender"
                      value={getGenderLabel(emp?.gender)}
                    />
                    <InfoItem
                      label="Date of Birth"
                      value={formatDate(emp?.date_of_birth)}
                    />
                    <InfoItem label="TIN Number" value={emp?.tin_number} />
                    <InfoItem
                      label="Pension Number"
                      value={emp?.pension_number}
                    />
                    <InfoItem
                      label="Place of Work"
                      value={emp?.place_of_work}
                    />
                  </div>
                </SectionCard>
              )}

            {/* Contact Details */}
            {selectedSections.includes("contact") &&
              (emp?.phones !== null ||
                emp?.addresses !== null ||
                employee.email !== null) && (
                <SectionCard title="Contact Details" icon={FiPhone}>
                  <div className="space-y-3">
                    {employee.email !== null && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <FiMail className="w-5 h-5 text-k-orange" />
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="font-medium">{employee.email}</p>
                        </div>
                      </div>
                    )}
                    {emp?.phones?.map((phone: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                      >
                        <FiPhone className="w-5 h-5 text-k-orange" />
                        <div>
                          <p className="text-xs text-gray-500">
                            {phone.phone_type} {phone.is_primary && "(Primary)"}
                          </p>
                          <p className="font-medium">{phone.phone_number}</p>
                        </div>
                      </div>
                    ))}
                    {emp?.addresses?.map((addr: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                      >
                        <FiMapPin className="w-5 h-5 text-k-orange" />
                        <div>
                          <p className="text-xs text-gray-500">Address</p>
                          <p className="font-medium">
                            {[
                              addr.city,
                              addr.sub_city,
                              addr.woreda,
                              addr.region,
                            ]
                              .filter(Boolean)
                              .join(", ") || "N/A"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

            {/* Employment */}
            {selectedSections.includes("employment") &&
              emp?.employments !== null && (
                <SectionCard title="Employment" icon={FiBriefcase}>
                  {(emp?.employments || [])?.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {(() => {
                        const latest = (emp?.employments || [] || [])[
                          (emp?.employments || [] || []).length - 1
                        ];
                        return (
                          <>
                            <InfoItem
                              label="Department"
                              value={latest?.department?.name}
                            />
                            <InfoItem
                              label="Job Title"
                              value={latest?.jobTitle?.title}
                            />
                            <InfoItem
                              label="Employment Type"
                              value={latest?.employment_type}
                            />
                            <InfoItem
                              label="Start Date"
                              value={formatDate(latest?.start_date)}
                            />
                            <InfoItem
                              label="Manager ID"
                              value={latest?.manager_id}
                            />
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No employment record
                    </p>
                  )}
                </SectionCard>
              )}

            {/* Compensation */}
            {selectedSections.includes("compensation") &&
              emp?.employments !== null && (
                <SectionCard title="Compensation" icon={FiDollarSign}>
                  {(emp?.employments || [])?.length > 0 ? (
                    <div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {(() => {
                          const latest = (emp?.employments || [] || [])[
                            (emp?.employments || [] || []).length - 1
                          ];
                          return (
                            <>
                              <InfoItem
                                label="Gross Salary"
                                value={
                                  latest?.gross_salary
                                    ? `ETB ${Number(
                                        latest.gross_salary,
                                      ).toLocaleString()}`
                                    : "N/A"
                                }
                              />
                              <InfoItem
                                label="Basic Salary"
                                value={
                                  latest?.basic_salary
                                    ? `ETB ${Number(
                                        latest.basic_salary,
                                      ).toLocaleString()}`
                                    : "N/A"
                                }
                              />
                            </>
                          );
                        })()}
                      </div>
                      {(emp?.employments || [] || [])[
                        (emp?.employments || [] || []).length - 1
                      ]?.allowances?.length > 0 && (
                        <>
                          <h4 className="font-medium text-gray-700 mt-4 mb-2">
                            Allowances
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {(emp?.employments || [] || [])[
                              (emp?.employments || [] || []).length - 1
                            ].allowances.map((a: any, i: number) => (
                              <div
                                key={i}
                                className="p-3 bg-gray-50 rounded-xl"
                              >
                                <p className="text-xs text-gray-500">
                                  {a.allowanceType?.name || "Allowance"}
                                </p>
                                <p className="font-medium">
                                  ETB {Number(a.amount).toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No compensation data
                    </p>
                  )}
                </SectionCard>
              )}

            {/* Education */}
            {selectedSections.includes("education") &&
              emp?.educations !== null && (
                <SectionCard title="Education" icon={FiBookOpen}>
                  {(emp?.educations || [])?.length > 0 ? (
                    <div className="space-y-3">
                      {(emp?.educations || [] || []).map(
                        (edu: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-4 bg-gray-50 rounded-xl border-l-4 border-k-orange"
                          >
                            <p className="font-medium">
                              {edu.level ? `Level ${edu.level}` : "Education"}
                            </p>
                            <p className="text-sm text-gray-600">
                              {edu.fieldOfStudy || edu.field_of_study || "-"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {edu.institution || "-"}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDate(edu.startDate || edu.start_date)} -{" "}
                              {edu.isCurrent || edu.is_current
                                ? "Present"
                                : formatDate(edu.endDate || edu.end_date)}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No education records
                    </p>
                  )}
                </SectionCard>
              )}

            {/* Work Experience */}
            {selectedSections.includes("workExperience") && (
              <SectionCard title="Previous Work Experience" icon={FiBriefcase}>
                {(emp?.employmentHistories || [])?.length > 0 ? (
                  <div className="space-y-3">
                    {(emp?.employmentHistories || [] || []).map(
                      (hist: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-4 bg-gray-50 rounded-xl border-l-4 border-k-orange"
                        >
                          <p className="font-medium">
                            {hist.previousCompanyName ||
                              hist.previous_company_name ||
                              hist.previous_company ||
                              "-"}
                          </p>
                          <p className="text-sm text-gray-600">
                            {hist.jobTitle ||
                              hist.previous_job_title_text ||
                              "-"}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(hist.startDate || hist.start_date)} -{" "}
                            {formatDate(hist.endDate || hist.end_date) ||
                              "Present"}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No previous work experience records
                  </p>
                )}
              </SectionCard>
            )}

            {/* Certifications */}
            {selectedSections.includes("certifications") && (
              <SectionCard title="Certifications" icon={FiAward}>
                {(emp?.licensesAndCertifications || [])?.length > 0 ? (
                  <div className="space-y-3">
                    {(emp?.licensesAndCertifications || [] || []).map(
                      (cert: any, idx: number) => (
                        <div key={idx} className="p-4 bg-gray-50 rounded-xl">
                          <p className="font-medium">{cert.name}</p>
                          <p className="text-sm text-gray-500">
                            {cert.issuing_organization}
                          </p>
                          {cert.credential_url && (
                            <a
                              href={cert.credential_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-k-orange hover:underline inline-flex items-center gap-1 mt-1"
                            >
                              <FiExternalLink className="w-3 h-3" /> View
                              Credential
                            </a>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No certifications
                  </p>
                )}
              </SectionCard>
            )}

            {/* Documents */}
            {selectedSections.includes("documents") && (
              <SectionCard title="Documents" icon={FiFile}>
                {documents.cv?.length ||
                documents.certificates?.length ||
                documents.experienceLetters?.length ||
                documents.taxForms?.length ||
                documents.pensionForms?.length ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {documents.cv?.length > 0 && (
                      <DocList title="CV/Resume" files={documents.cv} />
                    )}
                    {documents.certificates?.length > 0 && (
                      <DocList
                        title="Certificates"
                        files={documents.certificates}
                      />
                    )}
                    {documents.experienceLetters?.length > 0 && (
                      <DocList
                        title="Experience Letters"
                        files={documents.experienceLetters}
                      />
                    )}
                    {documents.taxForms?.length > 0 && (
                      <DocList title="Tax Forms" files={documents.taxForms} />
                    )}
                    {documents.pensionForms?.length > 0 && (
                      <DocList
                        title="Pension Forms"
                        files={documents.pensionForms}
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No documents uploaded
                  </p>
                )}
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// Helper components
function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 print:shadow-none print:border print:border-gray-200">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <Icon className="w-5 h-5 text-k-orange" />
        <h2 className="text-lg font-bold text-k-dark-grey">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="p-3 bg-gray-50 rounded-xl">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-medium text-k-dark-grey">{value || "N/A"}</p>
    </div>
  );
}

function DocList({ title, files }: { title: string; files: string[] }) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <p className="font-medium text-sm text-gray-700 mb-2">{title}</p>
      <div className="space-y-1">
        {files.map((file, idx) => (
          <a
            key={idx}
            href={file}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-k-orange hover:underline"
          >
            <FiDownload className="w-3 h-3" /> Document {idx + 1}
          </a>
        ))}
      </div>
    </div>
  );
}
