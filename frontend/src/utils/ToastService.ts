import toast from "react-hot-toast";

const ToastService = {
  success: (message: string) => {
    toast.success(message);
  },
  error: (message: string) => {
    toast.error(message);
  },
  info: (message: string) => {
    toast(message);
  },
  warning: (message: string) => {
    toast(message, {
      icon: "⚠️",
    });
  },
  loading: (message: string) => {
    return toast.loading(message);
  },
};

export default ToastService;
