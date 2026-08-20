const express = require("express");

const {
    register,
    verifyEmail,
    resendVerification,
    login,
    changePassword,
    forgotPassword,
    resetPassword
} = require("../controllers/auth.controller");

const authMiddleware =
    require("../middleware/auth.middleware");

const router = express.Router();


// Register
router.post(
    "/register",
    register
);


// Verify email
router.get(
    "/verify-email/:token",
    verifyEmail
);


// Resend verification
router.post(
    "/resend-verification",
    resendVerification
);


// Login
router.post(
    "/login",
    login
);


// Change password
router.post(
    "/change-password",
    authMiddleware,
    changePassword
);


// Forgot password
router.post(
    "/forgot-password",
    forgotPassword
);


// Reset password
router.post(
    "/reset-password/:token",
    resetPassword
);


module.exports = router;