import toast, { ToastOptions, Renderable } from "react-hot-toast";

const ToastService = {
  success: (message: Renderable, options?: ToastOptions) => {
    toast.success(message, options);
  },
  error: (message: Renderable, options?: ToastOptions) => {
    toast.error(message, options);
  },
  info: (message: Renderable, options?: ToastOptions) => {
    toast(message, options);
  },
  warning: (message: Renderable, options?: ToastOptions) => {
    toast(message, {
      icon: "⚠️",
      ...options,
    });
  },
  loading: (message: Renderable, options?: ToastOptions) => {
    return toast.loading(message, options);
  },
  dismiss: (id?: string) => {
    toast.dismiss(id);
  }
};

export default ToastService;
