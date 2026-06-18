import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/marketplace';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

// ==========================================
// FARMER FUNCTIONS
// ==========================================

export const addProduct = async (data: any): Promise<any> => {
  const response = await axios.post(`${API_BASE_URL}/farmer/products`, data, getAuthHeaders());
  return response.data;
};

export const getFarmerProducts = async (): Promise<any[]> => {
  const response = await axios.get(`${API_BASE_URL}/farmer/products`, getAuthHeaders());
  return response.data as any[];
};

// ==========================================
// FARM MANAGER FUNCTIONS
// ==========================================

export const getPendingProducts = async (): Promise<any[]> => {
  const response = await axios.get(`${API_BASE_URL}/manager/pending-products`, getAuthHeaders());
  return response.data as any[];
};

export const approveProduct = async (id: string, data: any): Promise<any> => {
  const response = await axios.put(`${API_BASE_URL}/manager/products/${id}/approve`, data, getAuthHeaders());
  return response.data;
};

export const rejectProduct = async (id: string, data: any): Promise<any> => {
  const response = await axios.put(`${API_BASE_URL}/manager/products/${id}/reject`, data, getAuthHeaders());
  return response.data;
};

export const getManagerOrders = async (): Promise<any[]> => {
  const response = await axios.get(`${API_BASE_URL}/manager/orders`, getAuthHeaders());
  return response.data as any[];
};

// ==========================================
// CUSTOMER FUNCTIONS
// ==========================================

export const getMarketplaceProducts = async (params?: any): Promise<any[]> => {
  const response = await axios.get(`${API_BASE_URL}/products`, {
    params
  });
  return response.data as any[];
};

export const addToCart = async (data: any): Promise<any> => {
  const response = await axios.post(`${API_BASE_URL}/cart/add`, data, getAuthHeaders());
  return response.data;
};

export const removeFromCart = async (cartItemId: string): Promise<any> => {
  const response = await axios.delete(`${API_BASE_URL}/cart/item/${cartItemId}`, getAuthHeaders());
  return response.data;
};

export const viewCart = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/cart`, getAuthHeaders());
  return response.data;
};

export const placeOrder = async (data?: any): Promise<any> => {
  const response = await axios.post(`${API_BASE_URL}/orders/create`, data || {}, getAuthHeaders());
  return response.data;
};

export const getOrderHistory = async (): Promise<any[]> => {
  const response = await axios.get(`${API_BASE_URL}/orders/customer/history`, getAuthHeaders());
  return response.data as any[];
};

// ==========================================
// SUPERADMIN FUNCTIONS
// ==========================================

export const getMarketplaceStats = async (): Promise<any> => {
  const response = await axios.get(`${API_BASE_URL}/admin/stats`, getAuthHeaders());
  return response.data;
};
