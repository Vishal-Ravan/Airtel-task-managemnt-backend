const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/User");

const {
    generateAccessToken
} = require("../utils/token");

const {
    sendEmail
} = require("../config/mail");


// =====================================================
// HELPER
// =====================================================

const sanitizeUser = (user) => {

    return {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        zone: user.zone,
        state: user.state,
        site_codes: user.site_codes,
        is_active: user.is_active,
        is_email_verified: user.is_email_verified
    };

};


// =====================================================
// REGISTER
// =====================================================

const register = async (req, res) => {

    try {

        const {
            name,
            email,
            phone,
            password,
            zone,
            state,
            site_codes
        } = req.body;


        if (
            !name ||
            !email ||
            !phone ||
            !password
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Name, email, phone and password are required"
            });

        }


        if (password.length < 6) {

            return res.status(400).json({
                success: false,
                message:
                    "Password must contain at least 6 characters"
            });

        }


        const normalizedEmail =
            email.toLowerCase().trim();


        const existingUser =
            await User.findOne({
                email: normalizedEmail
            });


        if (existingUser) {

            return res.status(409).json({
                success: false,
                message:
                    "An account already exists with this email"
            });

        }


        const hashedPassword =
            await bcrypt.hash(
                password,
                12
            );


        const verificationToken =
            crypto.randomBytes(32).toString("hex");


        const verificationExpiry =
            new Date(
                Date.now() +
                24 * 60 * 60 * 1000
            );


        const user = await User.create({

            name: name.trim(),

            email: normalizedEmail,

            phone: phone.trim(),

            // IMPORTANT:
            // Public registration can NEVER select role
            role: "vendor_executive",

            password: hashedPassword,

            zone,

            state,

            site_codes:
                Array.isArray(site_codes)
                    ? site_codes
                    : [],

            is_email_verified: false,

            email_verification_token:
                crypto
                    .createHash("sha256")
                    .update(verificationToken)
                    .digest("hex"),

            email_verification_expiry:
                verificationExpiry

        });


        const verificationUrl =
            `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;


        try {

            await sendEmail({

                to: user.email,

                subject:
                    "Verify your Site Management account",

                html: `
                    <div style="font-family:Arial">

                        <h2>Welcome ${user.name}</h2>

                        <p>
                            Thank you for registering.
                            Please verify your email address.
                        </p>

                        <a
                            href="${verificationUrl}"
                            style="
                                display:inline-block;
                                padding:12px 20px;
                                background:#2563eb;
                                color:white;
                                text-decoration:none;
                                border-radius:6px;
                            "
                        >
                            Verify Email
                        </a>

                        <p>
                            This link will expire in 24 hours.
                        </p>

                    </div>
                `

            });

        } catch (mailError) {

            console.error(
                "Verification email failed:",
                mailError.message
            );

            // User is already created.
            // We can provide resend verification API.
        }


        return res.status(201).json({

            success: true,

            message:
                "Registration successful. Please verify your email.",

            user: sanitizeUser(user)

        });


    } catch (error) {

        console.error(
            "REGISTER ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Registration failed"

        });

    }

};


// =====================================================
// VERIFY EMAIL
// =====================================================

const verifyEmail = async (req, res) => {

    try {

        const { token } = req.params;


        if (!token) {

            return res.status(400).json({
                success: false,
                message: "Verification token is required"
            });

        }


        const hashedToken =
            crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");


        const user =
            await User.findOne({

                email_verification_token:
                    hashedToken,

                email_verification_expiry: {
                    $gt: new Date()
                }

            }).select(
                "+email_verification_token"
            );


        if (!user) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid or expired verification link"

            });

        }


        user.is_email_verified = true;

        user.email_verification_token =
            undefined;

        user.email_verification_expiry =
            undefined;


        await user.save();


        return res.json({

            success: true,

            message:
                "Email verified successfully"

        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message:
                "Email verification failed"

        });

    }

};


// =====================================================
// RESEND VERIFICATION
// =====================================================

const resendVerification = async (req, res) => {

    try {

        const {
            email
        } = req.body;


        if (!email) {

            return res.status(400).json({
                success: false,
                message: "Email is required"
            });

        }


        const user =
            await User.findOne({
                email: email.toLowerCase().trim()
            }).select(
                "+email_verification_token"
            );


        // Don't reveal whether email exists
        if (!user) {

            return res.json({
                success: true,
                message:
                    "If the account exists, a verification email has been sent."
            });

        }


        if (user.is_email_verified) {

            return res.json({

                success: true,

                message:
                    "Email is already verified"

            });

        }


        const verificationToken =
            crypto.randomBytes(32).toString("hex");


        user.email_verification_token =
            crypto
                .createHash("sha256")
                .update(verificationToken)
                .digest("hex");


        user.email_verification_expiry =
            new Date(
                Date.now() +
                24 * 60 * 60 * 1000
            );


        await user.save();


        const verificationUrl =
            `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;


        await sendEmail({

            to: user.email,

            subject:
                "Verify your Site Management account",

            html: `
                <h2>Email Verification</h2>

                <p>Hello ${user.name},</p>

                <p>Please verify your email:</p>

                <a href="${verificationUrl}">
                    Verify Email
                </a>

                <p>
                    This link expires in 24 hours.
                </p>
            `

        });


        return res.json({

            success: true,

            message:
                "Verification email sent"

        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message:
                "Unable to send verification email"

        });

    }

};


// =====================================================
// LOGIN
// =====================================================

const login = async (req, res) => {

    try {

        const {email,password} = req.body;


        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required"

            });

        }


        const user =
            await User.findOne({

                email:
                    email.toLowerCase().trim()

            }).select("+password");


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password"

            });

        }


        if (!user.is_active) {

            return res.status(403).json({

                success: false,

                message:
                    "Your account is inactive"

            });

        }


        if (!user.is_email_verified) {

            return res.status(403).json({

                success: false,

                message:
                    "Please verify your email before login"

            });

        }


        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordMatch) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password"

            });

        }


        user.last_login =
            new Date();


        await user.save();


        const token =
            generateAccessToken(user);


        return res.json({

            success: true,

            message:
                "Login successful",

            token,

            user:
                sanitizeUser(user)

        });


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Login failed"

        });

    }

};


// =====================================================
// CHANGE PASSWORD
// =====================================================

const changePassword = async (req, res) => {

    try {

        const {
            current_password,
            new_password
        } = req.body;


        if (
            !current_password ||
            !new_password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Current and new password are required"

            });

        }


        if (new_password.length < 6) {

            return res.status(400).json({

                success: false,

                message:
                    "New password must contain at least 6 characters"

            });

        }


        const user =
            await User.findById(
                req.user._id
            ).select("+password");


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found"

            });

        }


        const isCorrect =
            await bcrypt.compare(
                current_password,
                user.password
            );


        if (!isCorrect) {

            return res.status(400).json({

                success: false,

                message:
                    "Current password is incorrect"

            });

        }


        const samePassword =
            await bcrypt.compare(
                new_password,
                user.password
            );


        if (samePassword) {

            return res.status(400).json({

                success: false,

                message:
                    "New password must be different"

            });

        }


        user.password =
            await bcrypt.hash(
                new_password,
                12
            );


        user.password_changed_at =
            new Date();


        await user.save();


        return res.json({

            success: true,

            message:
                "Password changed successfully"

        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message:
                "Unable to change password"

        });

    }

};


// =====================================================
// FORGOT PASSWORD
// =====================================================

const forgotPassword = async (req, res) => {

    try {

        const {
            email
        } = req.body;


        if (!email) {

            return res.status(400).json({

                success: false,

                message:
                    "Email is required"

            });

        }


        const user =
            await User.findOne({

                email:
                    email.toLowerCase().trim()

            });


        // Security:
        // Don't tell attacker whether account exists
        if (!user) {

            return res.json({

                success: true,

                message:
                    "If an account exists with this email, a password reset link has been sent."

            });

        }


        const resetToken =
            crypto.randomBytes(32).toString("hex");


        const hashedResetToken =
            crypto
                .createHash("sha256")
                .update(resetToken)
                .digest("hex");


        user.password_reset_token =
            hashedResetToken;


        // 15 minutes
        user.password_reset_expiry =
            new Date(
                Date.now() +
                15 * 60 * 1000
            );


        await user.save();


        const resetUrl =
            `${process.env.CLIENT_URL}/reset-password/${resetToken}`;


        try {

            await sendEmail({

                to: user.email,

                subject:
                    "Reset your Site Management password",

                html: `

                    <div style="font-family:Arial">

                        <h2>Password Reset</h2>

                        <p>
                            Hello ${user.name},
                        </p>

                        <p>
                            We received a request to reset
                            your password.
                        </p>

                        <a
                            href="${resetUrl}"
                            style="
                                display:inline-block;
                                padding:12px 20px;
                                background:#2563eb;
                                color:#fff;
                                text-decoration:none;
                                border-radius:6px;
                            "
                        >
                            Reset Password
                        </a>

                        <p>
                            This link will expire in 15 minutes.
                        </p>

                        <p>
                            If you didn't request this,
                            you can safely ignore this email.
                        </p>

                    </div>

                `

            });

        } catch (mailError) {

            // Don't leave a valid reset token if email failed

            user.password_reset_token =
                undefined;

            user.password_reset_expiry =
                undefined;

            await user.save();

            console.error(
                "RESET EMAIL ERROR:",
                mailError
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to send reset email"

            });

        }


        return res.json({

            success: true,

            message:
                "If an account exists with this email, a password reset link has been sent."

        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message:
                "Unable to process forgot password request"

        });

    }

};


// =====================================================
// RESET PASSWORD
// =====================================================

const resetPassword = async (req, res) => {

    try {

        const {
            token
        } = req.params;

        const {
            new_password
        } = req.body;


        if (!token) {

            return res.status(400).json({

                success: false,

                message:
                    "Reset token is required"

            });

        }


        if (!new_password) {

            return res.status(400).json({

                success: false,

                message:
                    "New password is required"

            });

        }


        if (new_password.length < 6) {

            return res.status(400).json({

                success: false,

                message:
                    "Password must contain at least 6 characters"

            });

        }


        const hashedToken =
            crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");


        const user =
            await User.findOne({

                password_reset_token:
                    hashedToken,

                password_reset_expiry: {
                    $gt: new Date()
                }

            }).select(
                "+password_reset_token"
            );


        if (!user) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid or expired reset link"

            });

        }


        user.password =
            await bcrypt.hash(
                new_password,
                12
            );


        user.password_changed_at =
            new Date();


        // Invalidate reset token
        user.password_reset_token =
            undefined;

        user.password_reset_expiry =
            undefined;


        await user.save();


        return res.json({

            success: true,

            message:
                "Password reset successfully. You can now login."

        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message:
                "Unable to reset password"

        });

    }

};


module.exports = {

    register,

    verifyEmail,

    resendVerification,

    login,

    changePassword,

    forgotPassword,

    resetPassword

};