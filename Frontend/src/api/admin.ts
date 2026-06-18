import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/admin';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

export const getDashboardOverview = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/dashboard-overview`, getAuthHeaders());
  return response.data;
};

export const getUsers = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/users`, getAuthHeaders());
  return response.data;
};

export const updateUserStatus = async (id: string, status: string): Promise<any> => {
  const response = await axios.patch(`${API_BASE_URL}/users/${id}/status`, { status }, getAuthHeaders());
  return response.data;
};

export const getAdminFarms = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/farms`, getAuthHeaders());
  return response.data;
};

export const getAdminFarmManagers = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/farm-managers`, getAuthHeaders());
  return response.data;
};

export const getAdminFarmers = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/farmers`, getAuthHeaders());
  return response.data;
};

export const getAdminCrops = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/crops`, getAuthHeaders());
  return response.data;
};

export const getAdminLivestock = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/livestock`, getAuthHeaders());
  return response.data;
};

export const getAdminAIAdvisories = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/ai-advisories`, getAuthHeaders());
  return response.data;
};

export const getAdminTasks = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/tasks`, getAuthHeaders());
  return response.data;
};

export const getAdminSalaries = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/salaries`, getAuthHeaders());
  return response.data;
};
