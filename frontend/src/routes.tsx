import { Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { routes } from "./utils/routes";
import ProtectedRoute from "./app/routes/ProtectedRoute";
import {
  selectIsAuthenticated,
  selectAuthUser,
} from "./app/slice/authSlice/selectors";
import NotFound from "./app/pages/ErrorDisplayPage/NotFound";

export default function AppRoutes() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectAuthUser);

  return (
    <Routes>
      {routes.map((route, index) => {
        if (!route.isAuthenticated) {
          return (
            <Route key={index} path={route.path} element={route.element} />
          );
        }
        return (
          <Route
            key={index}
            path={route.path}
            element={
              <ProtectedRoute allowedRoles={route.allowedRoles}>
                {route.element}
              </ProtectedRoute>
            }
          />
        );
      })}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
