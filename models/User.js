const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 100
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        role: {
            type: String,
            enum: [
                "vendor_executive",
                "vendor",
                "state_head",
                "client",
                "admin"
            ],
            default: "vendor_executive"
        },

        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false
        },

        zone: {
            type: String,
            trim: true
        },

        state: {
            type: String,
            trim: true
        },

        site_codes: [
            {
                type: String,
                trim: true
            }
        ],

        is_active: {
            type: Boolean,
            default: true
        },

        is_email_verified: {
            type: Boolean,
            default: false
        },

        email_verification_token: {
            type: String,
            select: false
        },

        email_verification_expiry: {
            type: Date,
            select: false
        },

        password_reset_token: {
            type: String,
            select: false
        },

        password_reset_expiry: {
            type: Date,
            select: false
        },

        last_login: {
            type: Date
        },

        password_changed_at: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);