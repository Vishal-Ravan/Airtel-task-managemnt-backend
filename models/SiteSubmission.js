const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
  {
    // =====================================================
    // CAMPAIGN
    // =====================================================

    campaign_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },

    // =====================================================
    // SITE
    // =====================================================

    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
      index: true,
    },

    // =====================================================
    // SUBMITTED BY
    // =====================================================

    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // =====================================================
    // UPLOADED BY
    // =====================================================

    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // =====================================================
    // UPLOADER ROLE
    // =====================================================

    uploader_role: {
      type: String,
      enum: [
        "vendor_executive",
        "admin",
      ],
      required: true,
    },

    // =====================================================
    // PERSON NAME
    // =====================================================

    person_name: {
      type: String,
      required: true,
      trim: true,
    },

    // =====================================================
    // SELFIE
    // =====================================================

    selfie: {
      type: String,
      required: true,
    },

    // =====================================================
    // SITE IMAGES
    // =====================================================

    site_images: [
      {
        type: String,
      },
    ],

    // =====================================================
    // GENERAL REMARKS
    // =====================================================

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    // =====================================================
    // VENDOR
    // =====================================================

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

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

    vendor_remarks: {
      type: String,
      default: "",
      trim: true,
    },

    vendor_action_at: {
      type: Date,
      default: null,
    },

    // =====================================================
    // STATE HEAD
    // =====================================================

    state_head: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

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

    state_head_remarks: {
      type: String,
      default: "",
      trim: true,
    },

    state_head_action_at: {
      type: Date,
      default: null,
    },

    // =====================================================
    // CLIENT
    // =====================================================

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // =====================================================
    // FINAL STATUS
    // =====================================================

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

    // =====================================================
    // UPLOAD VERSION
    //
    // Same campaign + same site:
    //
    // First upload  = 1
    // Second upload = 2
    // Third upload  = 3
    // =====================================================

    upload_version: {
      type: Number,
      default: 1,
      min: 1,
    },

    // =====================================================
    // UPLOAD DATE
    // =====================================================

    uploaded_at: {
      type: Date,
      default: Date.now,
    },

    // =====================================================
    // RE-UPLOAD DATE
    // =====================================================

    reuploaded_at: {
      type: Date,
      default: null,
    },

    // =====================================================
    // FINAL APPROVAL DATE
    // =====================================================

    approved_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// CAMPAIGN + SITE
//
// IMPORTANT:
// NOT UNIQUE.
//
// Same campaign + same site can have
// multiple submissions.
//
// Example:
//
// Campaign A
// Site 101
//
// Submission 1 -> pending_vendor_approval
// Submission 2 -> pending_vendor_approval
// Submission 3 -> vendor_rejected
// Submission 4 -> pending_vendor_approval
// =====================================================

submissionSchema.index({
  campaign_id: 1,
  site: 1,
});

// =====================================================
// CAMPAIGN + STATUS
// =====================================================

submissionSchema.index({
  campaign_id: 1,
  status: 1,
});

// =====================================================
// CAMPAIGN + EXECUTIVE + STATUS
// =====================================================

submissionSchema.index({
  campaign_id: 1,
  submitted_by: 1,
  status: 1,
});

// =====================================================
// CAMPAIGN + VENDOR + STATUS
// =====================================================

submissionSchema.index({
  campaign_id: 1,
  vendor: 1,
  vendor_status: 1,
});

// =====================================================
// CAMPAIGN + STATE HEAD + STATUS
// =====================================================

submissionSchema.index({
  campaign_id: 1,
  state_head: 1,
  state_head_status: 1,
});

// =====================================================
// CAMPAIGN + CLIENT + STATUS
// =====================================================

submissionSchema.index({
  campaign_id: 1,
  client: 1,
  status: 1,
});

// =====================================================
// MODEL
// =====================================================

module.exports =
  mongoose.models.SiteSubmission ||
  mongoose.model(
    "SiteSubmission",
    submissionSchema
  );