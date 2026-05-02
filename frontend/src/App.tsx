import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes";
import { SidebarProvider } from "./app/context/SidebarContext";
import { CelebrationProvider } from "./app/context/CelebrationContext";
import ToastProvider from "./app/components/common/ToastProvider";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuthSlice, authActions } from "./app/slice/authSlice";
import { selectAuthToken } from "./app/slice/authSlice/selectors";
import { CelebrationManager } from "./app/components/common/CelebrationManager";

import axios from "axios";

function AuthBootstrapper() {
  useAuthSlice();
  const dispatch = useDispatch();
  const token = useSelector(selectAuthToken);

  useEffect(() => {
    if (!token) return;
    dispatch(authActions.getMeRequest());
  }, [dispatch, token]);

  const user = useSelector((state: any) => state.auth?.user);

  // Dynamic Theming: Inject company colors into CSS variables
  useEffect(() => {
    if (user?.company) {
      const { primary_color, secondary_color } = user.company;
      const root = document.documentElement;

      if (primary_color) {
        root.style.setProperty('--color-primary', primary_color);
      }
      if (secondary_color) {
        root.style.setProperty('--color-secondary', secondary_color);
      }
    }
  }, [user]);

  // Global Interceptor to handle 401 errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Log out user if backend returns 401 Unauthorized
        if (error.response?.status === 401) {
          dispatch(authActions.logout());
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [dispatch]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <SidebarProvider>
        <CelebrationProvider>
          <AuthBootstrapper />
          <AppRoutes />
          <CelebrationManager />
          <ToastProvider />
        </CelebrationProvider>
      </SidebarProvider>
    </BrowserRouter>
  );
}

export default App;
