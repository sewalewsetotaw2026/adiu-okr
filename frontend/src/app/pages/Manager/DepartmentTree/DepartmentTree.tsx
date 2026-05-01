import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ReactFlowInstance,
  /* Edge, MarkerType deprecated/unused */
  Controls,
  Background,
  /* MiniMap unused */
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import {
  MdRefresh /*, MdZoomIn, MdZoomOut, MdFilterList */,
} from "react-icons/md";
import OrgNode from "./OrgNode";
import DepartmentNode from "./DepartmentNode";
import axios from "axios";
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import { useManagerSlice } from "../../../slice/managerSlice";
import { selectIsManager } from "../../../slice/managerSlice/selectors";
// Replace with your actual api instance import
// import api from "../../../../utils/api";

// Since I don't see the API utility file in opened files, I'll use a placeholder axios fetch
// You should verify the authentication header injection pattern
const RAW_BASE_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_BASE_URL;

if (!RAW_BASE_URL) {
  throw new Error(
    "Missing API base URL. Set VITE_API_URL (recommended) or VITE_BASE_URL (example: VITE_API_URL=http://localhost:5000/api/v1).",
  );
}

const API_URL = String(RAW_BASE_URL).replace(/\/+$/, "");
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../components/common/PageHeader";
import { Filter } from "../../../components/common/Filter";

const nodeTypes = {
  orgNode: OrgNode,
  departmentNode: DepartmentNode,
};

const getLayoutedElements = (
  nodes: any[],
  edges: any[],
  direction = "TB",
  options?: { compact?: boolean },
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const compact = options?.compact === true;
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: compact ? 72 : 120,
    nodesep: compact ? 24 : 56,
    edgesep: compact ? 10 : 24,
  });

  nodes.forEach((node) => {
    const isDepartmentNode = node.type === "departmentNode";
    dagreGraph.setNode(node.id, {
      width: isDepartmentNode ? 320 : 280,
      height: isDepartmentNode ? 72 : 80,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const isDepartmentNode = node.type === "departmentNode";
    const nodeWidth = isDepartmentNode ? 320 : 280;
    const nodeHeight = isDepartmentNode ? 72 : 80;
    // Centering logic if needed, but dagre gives top-left
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes: layoutedNodes, edges };
};

const DepartmentTree = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [hierarchyOnly, setHierarchyOnly] = useState(false);
  const [availableDepartments, setAvailableDepartments] = useState<any[]>([]);
  const [treePayload, setTreePayload] = useState<{
    employees: any[];
    departments: any[];
  } | null>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const navigate = useNavigate();
  const user = useSelector(selectAuthUser) as any;
  const isManagerFromStore = useSelector(selectIsManager);
  const { actions: managerActions } = useManagerSlice();
  const dispatch = useDispatch();

  const resolvedRoleName = String(
    user?.role?.name || user?.role_name || user?.roleName || user?.role || "",
  );
  const isAdminOrHR = ["Admin", "HR"].includes(resolvedRoleName);
  const isManagerByRole = resolvedRoleName.toLowerCase().includes("manager");
  const canFilterAllDepartments =
    isAdminOrHR || isManagerFromStore || isManagerByRole;

  // Modal State

  const renderTree = useCallback(
    (
      payload: { employees: any[]; departments: any[] },
      departmentFilter: string,
      employeeHierarchyOnly: boolean,
    ) => {
      const { employees, departments } = payload;
      const filteredEmployees =
        departmentFilter === ""
          ? employees
          : employees.filter(
              (emp: any) => String(emp.department_id) === departmentFilter,
            );

      const departmentMap = new Map<number, { id: number; name: string }>();
      (departments || []).forEach((dept: { id: number; name: string }) => {
        departmentMap.set(dept.id, dept);
      });

      const employeesByDepartment = new Map<number, any[]>();
      filteredEmployees.forEach((emp: any) => {
        if (!employeesByDepartment.has(emp.department_id)) {
          employeesByDepartment.set(emp.department_id, []);
        }
        employeesByDepartment.get(emp.department_id)!.push(emp);
      });

      const departmentNodes = employeeHierarchyOnly
        ? []
        : Array.from(employeesByDepartment.entries()).map(
            ([departmentId, departmentEmployees]) => {
              const dept = departmentMap.get(departmentId);
              const departmentName =
                dept?.name ||
                departmentEmployees[0]?.department_name ||
                "Unassigned";

              return {
                id: `dept-${departmentId}`,
                type: "departmentNode",
                data: {
                  name: departmentName,
                  employeeCount: departmentEmployees.length,
                  nodeKind: "department",
                },
                position: { x: 0, y: 0 },
              };
            },
          );

      const employeeNodes = filteredEmployees.map((emp: any) => ({
        id: emp.id,
        type: "orgNode",
        data: {
          ...emp,
          nodeKind: "employee",
        },
        position: { x: 0, y: 0 },
      }));

      const newEdges: any[] = [];
      const employeeIdSet = new Set(
        filteredEmployees.map((emp: any) => emp.id),
      );

      filteredEmployees.forEach((emp: any) => {
        if (
          emp.manager_id &&
          emp.manager_id !== emp.id &&
          employeeIdSet.has(emp.manager_id)
        ) {
          newEdges.push({
            id: `e${emp.manager_id}-${emp.id}`,
            source: emp.manager_id,
            target: emp.id,
            type: "smoothstep",
            animated: true,
            style: { stroke: "var(--color-primary)" },
          });
        }
      });

      if (!employeeHierarchyOnly) {
        Array.from(employeesByDepartment.entries()).forEach(
          ([departmentId, departmentEmployees]) => {
            const deptNodeId = `dept-${departmentId}`;
            const employeeIdsInDepartment = new Set(
              departmentEmployees.map((emp) => emp.id),
            );

            const roots = departmentEmployees.filter(
              (emp) =>
                !emp.manager_id ||
                emp.manager_id === emp.id ||
                !employeeIdsInDepartment.has(emp.manager_id),
            );

            roots.forEach((rootEmp) => {
              newEdges.push({
                id: `e${deptNodeId}-${rootEmp.id}`,
                source: deptNodeId,
                target: rootEmp.id,
                type: "smoothstep",
                animated: false,
                style: { stroke: "#64748b" },
              });
            });
          },
        );
      }

      const layout = getLayoutedElements(
        [...departmentNodes, ...employeeNodes],
        newEdges,
        "TB",
        { compact: employeeHierarchyOnly },
      );
      setNodes(layout.nodes);
      setEdges(layout.edges);

      requestAnimationFrame(() => {
        reactFlowInstanceRef.current?.fitView({
          padding: 0.25,
          includeHiddenNodes: true,
          duration: 400,
          minZoom: 0.15,
          maxZoom: 1,
        });

        // If a specific department is selected, center viewport on that department node.
        if (departmentFilter && !employeeHierarchyOnly) {
          const selectedDeptNodeId = `dept-${departmentFilter}`;
          const selectedDeptNode = layout.nodes.find(
            (node: any) => node.id === selectedDeptNodeId,
          );

          if (selectedDeptNode) {
            const deptCenterX = selectedDeptNode.position.x + 160; // node width: 320
            const deptCenterY = selectedDeptNode.position.y + 36; // node height: 72

            setTimeout(() => {
              const currentZoom = reactFlowInstanceRef.current?.getZoom() ?? 1;
              reactFlowInstanceRef.current?.setCenter(
                deptCenterX,
                deptCenterY,
                {
                  zoom: currentZoom,
                  duration: 250,
                },
              );
            }, 420);
          }
        }
      });
    },
    [setEdges, setNodes],
  );

  const Layout = isAdminOrHR ? AdminLayout : EmployeeLayout;

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      if (node?.data?.nodeKind === "department") return;

      // Navigate to employee profile
      // Use admin route for Admin/HR, manager route for others
      if (node.id) {
        if (isAdminOrHR) {
          navigate(`/admin/employees/${node.id}`);
        } else {
          navigate(`/manager/my-team/${node.id}`);
        }
      }
    },
    [navigate, isAdminOrHR],
  );

  // Helper to fetch data
  // In a real app, move this to Redux Saga or Slice
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token"); // Naive token retrieval
      const response = await axios.get(`${API_URL}/departments/tree`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = {
        employees: response.data.data?.employees || [],
        departments: response.data.data?.departments || [],
      };

      const scopedDepartmentIds = new Set(
        payload.employees
          .map((emp: any) => emp.department_id)
          .filter((departmentId: any) => !!departmentId),
      );

      const scopedDepartments = payload.departments.filter((dept: any) =>
        scopedDepartmentIds.has(dept.id),
      );

      setTreePayload(payload);
      setAvailableDepartments(
        canFilterAllDepartments ? payload.departments : scopedDepartments,
      );
      renderTree(payload, selectedDepartment, hierarchyOnly);
    } catch (error) {
      console.error("Failed to fetch tree", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []); // Only fetch on mount

  useEffect(() => {
    dispatch(managerActions.checkIsManager());
  }, [dispatch, managerActions]);

  useEffect(() => {
    if (!treePayload) return;
    renderTree(treePayload, selectedDepartment, hierarchyOnly);
  }, [selectedDepartment, treePayload, renderTree, hierarchyOnly]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <Layout>
      <PageHeader>
        <h1 className="text-2xl font-bold text-white">Department Tree</h1>
        <p className="text-white/80">Organization Hierarchy</p>
      </PageHeader>

      {canFilterAllDepartments && (
        <div className="mb-4 w-full max-w-4xl">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xl space-y-2">
              <h3 className="text-sm font-semibold text-k-dark-grey">
                Filter by department
              </h3>
              <Filter
                value={selectedDepartment}
                onChange={(value) => setSelectedDepartment(value)}
                placeholder="All departments"
                disabled={hierarchyOnly}
                options={[
                  { label: "All departments", value: "" },
                  ...availableDepartments.map((dept: any) => ({
                    label: dept.name,
                    value: String(dept.id),
                  })),
                ]}
              />
            </div>

            <label className="flex items-center gap-3 ml-auto cursor-pointer select-none pb-2">
              <span className="text-sm font-medium text-k-dark-grey whitespace-nowrap">
                Employee hierarchy only
              </span>
              <button
                type="button"
                onClick={() => setHierarchyOnly((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  hierarchyOnly ? "bg-primary" : "bg-gray-300"
                }`}
                aria-pressed={hierarchyOnly}
                title="Toggle employee-only hierarchy"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    hierarchyOnly ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>
      )}

      <div className="h-[calc(100vh-250px)] w-full bg-slate-50 relative rounded-2xl overflow-hidden shadow-card border border-gray-200">
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <div className="w-[80%] h-[80%] shimmer-bg rounded-3xl opacity-30" />
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={(instance) => {
            reactFlowInstanceRef.current = instance;
          }}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.25,
            includeHiddenNodes: true,
            minZoom: 0.15,
          }}
          minZoom={0.15}
          className="bg-slate-50"
        >
          <Controls
            showInteractive={false}
            className="bg-white! shadow-sm! border-gray-100! rounded-lg! overflow-hidden"
          />
          <Background gap={20} size={1} color="#e2e8f0" />
          <Panel
            position="top-right"
            className="bg-white p-2 rounded-xl shadow-lg border border-gray-100 m-4 flex gap-2"
          >
            <button
              onClick={fetchData}
              className="p-2 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors"
              title="Refresh"
            >
              <MdRefresh size={20} />
            </button>
          </Panel>
        </ReactFlow>
      </div>
    </Layout>
  );
};

export default DepartmentTree;
