import { useState, useEffect } from "react";
import FormField from "../common/FormField";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import { useEmployeeDashboardSlice } from "../../pages/employee/Dashboard/slice";
import {
  selectDashboardStats,
  selectDashboardLoading
} from "../../pages/employee/Dashboard/slice/selectors";

const GENDER_COLORS = ["#3B82F6", "#EC4899"]; // Blue and Pink
const STATUS_COLORS = ["var(--color-success)", "var(--color-secondary)", "var(--color-primary)"];

export default function CompanyOverviewChart() {
  const [filter, setFilter] = useState("department");
  const dispatch = useDispatch();
  const { actions } = useEmployeeDashboardSlice();
  const stats = useSelector(selectDashboardStats);
  const loading = useSelector(selectDashboardLoading);

  useEffect(() => {
    dispatch(actions.fetchStatsRequest());
  }, [dispatch, actions]);

  // Map backend stats to chart data
  const dataDepartment = stats?.deptDist
    ? Object.entries(stats.deptDist).map(([name, employees]) => ({ name, NumberOfEmployees: employees }))
    : [];

  const dataGender = stats?.genderDist
    ? [
      { name: "Male", value: stats.genderDist.male },
      { name: "Female", value: stats.genderDist.female },
    ]
    : [];

  const dataHiringTrends = stats?.hiringTrends
    ? Object.entries(stats.hiringTrends).map(([name, value]) => ({
      name,
      value
    }))
    : [];

  const dataStatus = stats?.probationStatus
    ? Object.entries(stats.probationStatus).map(([name, value]) => ({ name, value }))
    : [];

  if (loading && !stats) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 h-full animate-[slideUp_0.3s_ease-out]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-k-dark-grey grow">
          Company Overview
        </h3>
        <div className="w-48">
          <FormField
            name="filterBy"
            label="Filter By"
            type="select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            options={[
              { value: "department", label: "By Department" },
              { value: "gender", label: "By Gender" },
              { value: "status", label: "By Status" },
              { value: "hiring", label: "Hiring Trends" },
            ]}
          />
        </div>
      </div>

      <div className="h-[300px] w-full">
        {displayDataFound(filter, dataDepartment, dataGender, dataStatus, dataHiringTrends) ? (
          <ResponsiveContainer width="100%" height="100%">
            {filter === "department" && (
              <BarChart
                data={dataDepartment}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#888", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#888", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "#f9fafb" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar
                  dataKey="NumberOfEmployees"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            )}

            {filter === "gender" && (
              <PieChart>
                <Pie
                  data={dataGender}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dataGender.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={GENDER_COLORS[index % GENDER_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            )}

            {filter === "status" && (
              <PieChart>
                <Pie
                  data={dataStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dataStatus.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            )}

            {filter === "hiring" && (
              <LineChart
                data={dataHiringTrends}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#888", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#888", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "var(--color-primary)", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            No data available for this filter
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm text-gray-500">
        <span>Total Employees: {stats?.totalEmployees || 0}</span>
        <span className="text-primary font-medium cursor-pointer hover:underline">
          View Detailed Report
        </span>
      </div>
    </div>
  );
}

function displayDataFound(filter: string, dept: any[], gender: any[], status: any[], hiring: any[]) {
  if (filter === "department") return dept.length > 0;
  if (filter === "gender") return gender.length > 0;
  if (filter === "status") return status.length > 0;
  if (filter === "hiring") return hiring.length > 0;
  return false;
}
