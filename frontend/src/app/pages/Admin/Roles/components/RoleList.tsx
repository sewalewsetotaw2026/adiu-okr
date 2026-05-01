import { MdAdd, MdOutlineGroups } from "react-icons/md";

interface Role {
  id: number;
  name: string;
  description?: string;
}

interface RoleListProps {
  roles: Role[];
  selectedRoleId: number | null;
  onSelectRole: (id: number) => void;
  onAddRole: () => void;
  onMapRole: (role: Role) => void;
  loading?: boolean;
}

export const RoleList = ({
  roles,
  selectedRoleId,
  onSelectRole,
  onAddRole,
  onMapRole,
  loading,
}: RoleListProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-800">Roles</h2>
        <button
          onClick={onAddRole}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
        >
          <MdAdd size={18} />
          <span>Create New Role</span>
        </button>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading roles...</div>
        ) : roles.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-sm">
            No roles found.
          </div>
        ) : (
          roles.map((role) => (
            <div
              key={role.id}
              onClick={() => onSelectRole(role.id)}
              className={`
                p-4 rounded-xl cursor-pointer transition-all border group
                ${selectedRoleId === role.id
                  ? "bg-primary/5 border-primary shadow-sm"
                  : "bg-white border-transparent hover:bg-gray-50"
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3
                    className={`font-semibold text-sm mb-1 ${selectedRoleId === role.id ? "text-primary" : "text-gray-700"
                      }`}
                  >
                    {role.name.toUpperCase()}
                  </h3>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMapRole(role);
                  }}
                  title="Map Employees"
                  className={`
                    p-2 rounded-lg transition-all
                    ${selectedRoleId === role.id
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-400 group-hover:bg-primary group-hover:text-white"
                    }
                  `}
                >
                  <MdOutlineGroups size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
