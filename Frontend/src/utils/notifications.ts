import { toast, type ToastOptions } from 'react-toastify';

const baseOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 3000,
  closeOnClick: true,
  hideProgressBar: false,
  pauseOnHover: true,
  draggable: true,
};

export const notifySuccess = (message: string) => toast.success(message, baseOptions);
export const notifyError = (message: string) => toast.error(message, baseOptions);
export const notifyWarning = (message: string) => toast.warning(message, baseOptions);
