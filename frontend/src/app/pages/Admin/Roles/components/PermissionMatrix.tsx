import { ScopeSelect } from "./ScopeSelect";

interface PermissionMatrixProps {
  resources: any[];
  matrix: Record<string, Record<string, string>>;
  onPermissionChange: (
    resourceCode: string,
    action: string,
    scope: string,
  ) => void;
  loading?: boolean;
}

export const PermissionMatrix = ({
  resources,
  matrix,
  onPermissionChange,
  loading,
}: PermissionMatrixProps) => {
  const actions = ["Read", "Create", "Update", "Delete"];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="p-4 border-b border-gray-100 text-sm font-semibold text-gray-500 w-1/5">
                Resources
              </th>
              {actions.map((action) => (
                <th
                  key={action}
                  className="p-4 border-b border-gray-100 text-sm font-semibold text-gray-500 text-center w-1/5"
                >
                  {action}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  Loading permissions...
                </td>
              </tr>
            ) : resources.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  No resources found for the current search/filter.
                </td>
              </tr>
            ) : (
              resources.map((resource) => (
                <tr key={resource.id} className="hover:bg-gray-50/50">
                  <td className="p-4 text-sm font-medium text-gray-700 border-b border-gray-50">
                    {resource.name}
                  </td>
                  {actions.map((action) => {
                    const actionKey = action.toLowerCase(); // "read", "create"...
                    const currentScope =
                      matrix[resource.code]?.[actionKey] || "N/A";

                    return (
                      <td
                        key={`${resource.id}-${action}`}
                        className="p-2 border-b border-gray-50"
                      >
                        <ScopeSelect
                          value={currentScope}
                          onChange={(newScope) =>
                            onPermissionChange(
                              resource.code,
                              actionKey,
                              newScope,
                            )
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
