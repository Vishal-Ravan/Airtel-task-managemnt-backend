const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
  {
    // ========================================
    // SITE
    // ========================================
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
      index: true,
    },

    // ========================================
    // SUBMITTED BY
    // ========================================
    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ========================================
    // UPLOADED BY
    // ========================================
    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ========================================
    // UPLOADER ROLE
    // ========================================
    uploader_role: {
      type: String,
      enum: [
        "vendor_executive",
        "admin",
      ],
      required: true,
    },

    // ========================================
    // PERSON NAME
    // ========================================
    person_name: {
      type: String,
      required: true,
      trim: true,
    },

    // ========================================
    // SELFIE
    // ========================================
    selfie: {
      type: String,
      required: true,
    },

    // ========================================
    // SITE IMAGES
    // ========================================
    site_images: [
      {
        type: String,
      },
    ],

    // ========================================
    // REMARKS
    // ========================================
    remarks: {
      type: String,
      default: "",
    },

    // ========================================
    // VENDOR STATUS
    // ========================================
    vendor_status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
      ],
      default: "pending",
      index: true,
    },

    // ========================================
    // VENDOR REMARKS
    // ========================================
    vendor_remarks: {
      type: String,
      default: "",
    },

    // ========================================
    // STATE HEAD STATUS
    // ========================================
    state_head_status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
      ],
      default: "pending",
      index: true,
    },

    // ========================================
    // STATE HEAD REMARKS
    // ========================================
    state_head_remarks: {
      type: String,
      default: "",
    },

    // ========================================
    // GENERAL STATUS
    // ========================================
    status: {
      type: String,
      enum: [
        "pending_vendor_approval",
        "vendor_rejected",
        "pending_state_head_approval",
        "state_head_rejected",
        "approved",
      ],
      default: "pending_vendor_approval",
      index: true,
    },

    // ========================================
    // UPLOADED AT
    // ========================================
    uploaded_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.SiteSubmission ||
  mongoose.model(
    "SiteSubmission",
    submissionSchema
  );