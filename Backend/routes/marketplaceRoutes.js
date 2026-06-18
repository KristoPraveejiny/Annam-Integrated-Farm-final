import express from 'express';
import { verifyToken } from '../authMiddleware.js';
import upload from '../productUploadMiddleware.js';
import {
  addProduct,
  getFarmerProducts,
  getPendingProducts,
  approveProduct,
  rejectProduct,
  getMarketplaceProducts,
  addToCart,
  removeFromCart,
  viewCart,
  placeOrder,
  getOrderHistory,
  getMarketplaceStats,
  getManagerOrders
} from '../controllers/marketplaceController.js';

const router = express.Router();

// Public routes
router.get('/products', getMarketplaceProducts);

// All other routes require authentication
router.use(verifyToken);

// ==========================================
// FARMER ROUTES
// ==========================================
// Note: You can add role checking middleware here if you have one
router.post('/farmer/products', upload.single('image'), addProduct);
router.get('/farmer/products', getFarmerProducts);

// ==========================================
// FARM MANAGER ROUTES
// ==========================================
router.get('/manager/pending-products', getPendingProducts);
router.put('/manager/products/:id/approve', approveProduct);
router.put('/manager/products/:id/reject', rejectProduct);
router.get('/manager/orders', getManagerOrders);

// Cart Routes
router.post('/cart/add', addToCart);
router.delete('/cart/item/:id', removeFromCart);
router.get('/cart', viewCart);

// Order Routes
router.post('/orders/create', placeOrder);
router.get('/orders/customer/history', getOrderHistory);

// ==========================================
// SUPERADMIN ROUTES
// ==========================================
router.get('/admin/stats', getMarketplaceStats);

export default router;
