import { Router } from 'express';
import {
    register,
    login,
    refreshToken,
    logout,
    getProfile,
    updateProfile,
    changePassword,
} from '../authController.js';
import {
    sendPasswordResetOtp,
    resetPasswordWithOtp,
} from '../passwordResetController.js';
import { verifyToken } from '../authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);
router.put('/change-password', verifyToken, changePassword);
router.post('/password-reset/send-otp', sendPasswordResetOtp);
router.post('/password-reset/confirm', resetPasswordWithOtp);

export default router;
