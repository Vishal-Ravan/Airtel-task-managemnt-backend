const mongoose = require("mongoose");

// =====================================================
// SITE HISTORY SCHEMA
// =====================================================

const siteHistorySchema = new mongoose.Schema(
  {
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SiteSubmission",
      default: null,
    },

    action: {
      type: String,
      enum: [
        "site_created",
        "submission_uploaded",
        "submission_reuploaded",
        "vendor_approved",
        "vendor_rejected",
        "state_head_approved",
        "state_head_rejected",
      ],
      required: true,
    },

    action_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    action_by_role: {
      type: String,
      default: "",
    },

    action_by_name: {
      type: String,
      default: "",
    },

    remarks: {
      type: String,
      default: "",
    },

    old_status: {
      type: String,
      default: null,
    },

    new_status: {
      type: String,
      default: null,
    },

    site_snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    submission_snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

// =====================================================
// SITE SCHEMA
// =====================================================

const siteSchema = new mongoose.Schema(
  {
    // ===================================================
    // CAMPAIGN
    // ===================================================

    campaign_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },

    // ===================================================
    // SITE CODE
    // OPTIONAL
    // ===================================================

    site_code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    // ===================================================
    // LOCATION
    // ===================================================

    state: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    zone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    // ===================================================
    // MEDIA
    // ===================================================

    media_type: {
      type: String,
      required: true,
      trim: true,
    },

    duration: {
      type: String,
      default: "",
    },

    type: {
      type: String,
      default: "",
    },

    unit: {
      type: String,
      default: "",
    },

    width: {
      type: Number,
      default: null,
    },

    height: {
      type: Number,
      default: null,
    },

    total_sqr_ft: {
      type: Number,
      default: null,
    },

    lat: {
      type: Number,
      default: null,
    },

    long: {
      type: Number,
      default: null,
    },

    // ===================================================
    // VENDOR
    // ===================================================

    vendor: {
      type: String,
      default: "DENTSU COMMUNICATIONS",
      trim: true,
    },

    // ===================================================
    // OTHER
    // ===================================================

    availability: {
      type: String,
      default: "",
    },

    remarks: {
      type: String,
      default: "",
    },

    start_date: {
      type: Date,
      default: null,
    },

    end_date: {
      type: Date,
      default: null,
    },

    // ===================================================
    // ASSIGNMENTS
    // ===================================================

    assigned_vendor_executive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assigned_vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assigned_state_head: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assigned_client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ===================================================
    // SUBMISSION
    // ===================================================

    current_submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SiteSubmission",
      default: null,
    },

    // ===================================================
    // HISTORY
    // ===================================================

    history: {
      type: [siteHistorySchema],
      default: [],
    },

    // ===================================================
    // STATUS
    // ===================================================

    status: {
      type: String,
      enum: [
        "pending_upload",
        "pending_vendor_approval",
        "vendor_rejected",
        "pending_state_head_approval",
        "state_head_rejected",
        "approved",
      ],
      default: "pending_upload",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// UNIQUE SITE CODE PER CAMPAIGN
//
// Empty site_code duplicate allowed.
// =====================================================

siteSchema.index(
  {
    campaign_id: 1,
    site_code: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      site_code: {
        $type: "string",
        $ne: "",
      },
    },
  }
);

// =====================================================
// INDEXES
// =====================================================

siteSchema.index({
  campaign_id: 1,
  state: 1,
  zone: 1,
});

siteSchema.index({
  campaign_id: 1,
  assigned_vendor_executive: 1,
  status: 1,
});

siteSchema.index({
  campaign_id: 1,
  assigned_vendor: 1,
  status: 1,
});

siteSchema.index({
  campaign_id: 1,
  assigned_state_head: 1,
  status: 1,
});

siteSchema.index({
  campaign_id: 1,
  assigned_client: 1,
  status: 1,
});

// =====================================================
// MODEL
// =====================================================

module.exports =
  mongoose.models.Site ||
  mongoose.model("Site", siteSchema);