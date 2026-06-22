import { Router } from 'express';
import {
    register,
    login,
    refreshToken,
    logout,
} from '../authController.js';
import {
    sendPasswordResetOtp,
    resetPasswordWithOtp,
} from '../passwordResetController.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/password-reset/send-otp', sendPasswordResetOtp);
router.post('/password-reset/confirm', resetPasswordWithOtp);

export default router;
