import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/feedback';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const submitFeedback = async (payload: {
  rating: number;
  message: string;
  feedback_type?: string;
}): Promise<any> => {
  const response = await axios.post(API_BASE_URL, payload, getAuthHeaders());
  return response.data;
};

export const getMyFeedback = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/my-feedback`, getAuthHeaders());
  return response.data;
};

export const getPublicVisibleFeedback = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/public`);
  return response.data;
};

export const getAdminFeedback = async (params?: {
  role?: string;
  feedback_type?: string;
  rating?: string;
}): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/admin/feedback`, {
    ...getAuthHeaders(),
    params,
  });
  return response.data;
};

export const updateFeedbackStatus = async (id: string, status: 'pending' | 'visible' | 'hidden'): Promise<any> => {
  const response = await axios.put(`${API_BASE_URL}/admin/feedback/${id}/status`, { status }, getAuthHeaders());
  return response.data;
};

export const deleteFeedback = async (id: string): Promise<any> => {
  const response = await axios.delete(`${API_BASE_URL}/admin/feedback/${id}`, getAuthHeaders());
  return response.data;
};
