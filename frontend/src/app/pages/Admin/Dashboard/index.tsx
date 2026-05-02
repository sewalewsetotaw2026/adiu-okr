import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useDashboardSlice } from "./slice";
import {
  selectDashboardStats,
  selectDashboardLoading,
} from "./slice/selectors";

import { useDepartments } from "../Departments/slice";
import {
  selectDepartments,
  selectDepartmentsLoading,
} from "../Departments/slice/selectors";

import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../components/common/PageHeader";
import StatCard from "../../../components/common/StatCard";
import HorizontalBarChart from "../../../components/Core/ui/HorizontalBarChart";
import VerticalBarChart from "../../../components/Core/ui/VerticalBarChart";
import AreaChart from "../../../components/Core/ui/AreaChart";
import DynamicInsightCard from "./components/DynamicInsightCard";
import LeadershipDensityCard from "./components/LeadershipDensityCard";
import JobLevelOverviewCard from "./components/JobLevelOverviewCard";

import {
  FiUsers,
  FiUserCheck,
  FiGrid,
  FiBriefcase,
  FiUserX,
} from "react-icons/fi";

export default function AdminDashboard() {
  const dispatch = useDispatch();

  const { actions } = useDashboardSlice();
  const { actions: departmentActions } = useDepartments();

  const stats = useSelector(selectDashboardStats);
  const departments = useSelector(selectDepartments);

  const [selectedDepartmentId, setSelectedDepartmentId] =
    useState<string>("all");
  const [selectedDepartmentName, setSelectedDepartmentName] =
    useState<string>("All Departments");

  useEffect(() => {
    dispatch(actions.fetchStatsRequest());
    dispatch(departmentActions.fetchDepartmentsStart({ limit: 1000 }));
  }, [dispatch, actions, departmentActions]);

  /* ======================
     AGGREGATED METRICS
  ====================== */
  const totalEmployees = stats?.totalEmployees ?? 0;
  const activeEmployees = stats?.activeEmployees ?? 0;
  const inactiveEmployees = stats?.inactiveEmployees ?? 0;
  const totalDepartments = stats?.totalDepartments ?? 0;

  /* ======================
     FILTERED BY DEPARTMENT
  ====================== */
  const deptStats =
    selectedDepartmentId !== "all"
      ? stats?.departmentBreakdown?.[selectedDepartmentId]
      : null;

  /* Gender (Filtered) */
  const genderLabels = ["Male", "Female"];
  const genderSeries = deptStats
    ? [deptStats.gender.male, deptStats.gender.female]
    : [stats.genderDist.male, stats.genderDist.female];

  /* Job Level (Filtered) — NEW CREATIVE CARD */
  const jobLevelSource = deptStats ? deptStats.jobLevels : stats.jobLevelDist;

  const jobLevelLabels = Object.keys(jobLevelSource || {});
  const jobLevelSeries = Object.values(jobLevelSource || {});

  /* ======================
     EXISTING GLOBAL DATA
  ====================== */
  const empType = stats?.empTypeDist || {};
  const employmentLabels = Object.keys(empType);
  const employmentSeries = Object.values(empType);

  const deptDist = stats?.deptDist || {};
  const departmentData = Object.keys(deptDist).map((key) => ({
    name: key,
    value: deptDist[key],
  }));

  const jobLevelDist = stats?.jobLevelDist || {};
  const jobLevels = Object.keys(jobLevelDist).map((key) => ({
    name: key,
    value: jobLevelDist[key],
  }));

  const managerDist = stats?.managerDist || {};

  /* ======================
     NEW INSIGHTS DATA
  ====================== */
  const eduDist = stats?.educationDist || {};
  const educationData = Object.keys(eduDist).map((key) => ({
    name: key,
    value: eduDist[key],
  }));

  const ageDist = stats?.ageDist || {};
  // Sort age keys logically if possible, or assume predefined order
  const ageOrder = ["18-25", "26-35", "36-45", "46-55", "55+", "Unknown"];
  const ageData = ageOrder.map((key) => ({
    name: key,
    value: ageDist[key] || 0,
  }));

  // Tenure Data
  const tenureDist = stats?.tenureDistribution || {};
  const tenureOrder = ["<1 Year", "1-3 Years", "3-5 Years", "5+ Years"];
  const tenureData = tenureOrder.map((key) => ({
    name: key,
    value: tenureDist[key] || 0,
  }));

  // Probation Data
  const probationStats = stats?.probationStatus || {};
  const probationLabels = Object.keys(probationStats);
  const probationSeries = Object.values(probationStats);

  // Hiring Trends Data
  const hiringTrends = stats?.hiringTrends || {};
  const hiringData = Object.keys(hiringTrends).map((key) => ({
    name: key,
    value: hiringTrends[key],
  }));

  // Prepare data for Gender (Horizontal Bar) using filtered or global series defined above
  const genderData = genderLabels.map((label, idx) => ({
    name: label,
    value: genderSeries[idx],
  }));

  // Prepare data for Employment Type (Vertical Bar) using global series defined above
  const employmentDataArray = employmentLabels.map((label, idx) => ({
    name: label,
    value: employmentSeries[idx],
  }));

  // Prepare data for Radial Chart (Manager Ratio)
  const managerRatioData = [
    {
      name: "Managers",
      value: managerDist["Managers"] || 0,
      fill: "var(--color-primary)",
    }, // Semantic Primary
    { name: "Staff", value: managerDist["NonManagers"] || 0, fill: "#94a3b8" }, // Slate-400 (Visible Gray)
  ];

  return (
    <AdminLayout>
      {/* Page Header with Global Filter */}
      <PageHeader>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-white/90 text-sm md:text-base">
            Company-wide workforce insights and department analytics
          </p>
        </div>
      </PageHeader>

      {/* 1. EXECUTIVE OVERVIEW (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard
          label="Total Employees"
          value={totalEmployees}
          icon={FiUsers}
          color="bg-primary"
        />
        <StatCard
          label="Active Workforce"
          value={activeEmployees}
          icon={FiUserCheck}
          color="bg-primary"
        />
        <StatCard
          label="Inactive Employees"
          value={inactiveEmployees}
          icon={FiUserX}
          color="bg-secondary"
        />
        <StatCard
          label="Total Managers"
          value={stats?.totalManagers ?? 0}
          icon={FiBriefcase}
          color="bg-primary"
        />
        <StatCard
          label="Departments"
          value={totalDepartments}
          icon={FiGrid}
          color="bg-secondary"
        />
      </div>

      {/* 2. GROWTH & TRENDS */}
      <div className="mb-8">
        <AreaChart
          title="Monthly Hiring Trends"
          data={hiringData}
          colors={["#0EA5E9"]}
        />
      </div>

      {/* 3. DYNAMIC INSIGHTS & COMPOSITION */}
      {/* 3. DYNAMIC INSIGHTS & COMPOSITION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Dynamic Analysis Card (Span 1) */}
        <div className="lg:col-span-1">
          <DynamicInsightCard stats={stats} departments={departments} />
        </div>

        {/* Workforce Seniority (Span 1) */}
        <div className="lg:col-span-1">
          <JobLevelOverviewCard data={stats?.jobLevelDist || {}} />
        </div>
      </div>

      {/* 4. DEMOGRAPHICS & RETENTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Age */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
          <div className="mb-6">
            <h3 className="font-bold text-lg text-k-dark-grey">
              Age Distribution
            </h3>
            <p className="text-sm text-gray-500">Demographic spread</p>
          </div>
          <VerticalBarChart title="" data={ageData} colors={["#10B981"]} />
        </div>

        {/* Tenure */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
          <div className="mb-4">
            <h3 className="font-bold text-lg text-k-dark-grey">
              Years of Service
            </h3>
            <p className="text-sm text-gray-500">Retention analysis</p>
          </div>
          <VerticalBarChart title="" data={tenureData} colors={["#8B5CF6"]} />
        </div>
      </div>

      {/* 5. DETAILED ANALYSIS */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-k-dark-grey mb-4">
          Detailed Analysis
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Departments - REMOVED since it's now in Row 3, replacing with Education or keeping it?
             Actually, Row 3 has "Top 5". Row 5 had "Department Size" (Full).
             Let's Keep Department Size here or replace it?
             User said "put it at the end".
             Let's put Leadership Density here in place of Depts?
             Or add a new row.
             I'll add a new row at the very end.
          */}
          <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
            <div className="mb-4">
              <h3 className="font-bold text-lg text-k-dark-grey">
                Department Size
              </h3>
            </div>
            <HorizontalBarChart title="" data={departmentData.slice(0, 10)} />
          </div>

          {/* Education */}
          <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
            <div className="mb-4">
              <h3 className="font-bold text-lg text-k-dark-grey">
                Education Level
              </h3>
            </div>
            <HorizontalBarChart
              title=""
              data={educationData}
              colors={["#6366f1"]}
            />
          </div>
        </div>
      </div>

      {/* 6. ORGANIZATION STRUCTURE (The End) */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-k-dark-grey mb-4">
          Organization Health
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leadership Density moved here */}
          <div className="lg:col-span-1">
            <LeadershipDensityCard
              title="Leadership Density"
              data={managerRatioData}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
