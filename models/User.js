const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ========================================
    // BASIC DETAILS
    // ========================================

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    // ========================================
    // ROLE
    // ========================================

    role: {
      type: String,
      enum: [
        "vendor_executive",
        "vendor",
        "state_head",
        "client",
        "admin",
      ],
      default: "vendor_executive",
      index: true,
    },

    // ========================================
    // PASSWORD
    // ========================================

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    // ========================================
    // ACCOUNT STATUS
    // ========================================

    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },

    is_email_verified: {
      type: Boolean,
      default: true,
    },

    // ========================================
    // EMAIL VERIFICATION
    // ========================================

    email_verification_token: {
      type: String,
      select: false,
    },

    email_verification_expiry: {
      type: Date,
      select: false,
    },

    // ========================================
    // PASSWORD RESET
    // ========================================

    password_reset_token: {
      type: String,
      select: false,
    },

    password_reset_expiry: {
      type: Date,
      select: false,
    },

    // ========================================
    // LOGIN
    // ========================================

    last_login: {
      type: Date,
    },

    password_changed_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);