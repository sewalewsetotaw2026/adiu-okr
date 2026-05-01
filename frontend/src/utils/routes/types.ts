export interface IRoute {
  path: string;
  element: React.ReactNode;
  isAuthenticated?: boolean;
  allowedRoles?: (number | string)[];
  permissionGroups?: any[]; // Add permission groups if needed
}
