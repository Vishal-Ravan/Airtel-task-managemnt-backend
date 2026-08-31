const mongoose = require("mongoose");

// =====================================================
// LOCATION SCHEMA
// State -> Multiple Zones
//
// Example:
//
// {
//   state: "Maharashtra",
//   zones: ["Pune", "Mumbai"]
// }
//
// =====================================================

const locationSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      required: true,
      trim: true,
    },

    zones: {
      type: [
        {
          type: String,
      required: true,
          trim: true,
        },
      ],
      default: [],
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// CAMPAIGN USER SCHEMA
// =====================================================

const campaignUserSchema = new mongoose.Schema(
  {
    // =================================================
    // CAMPAIGN
    // =================================================

    campaign_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },

    // =================================================
    // USER
    // =================================================

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // =================================================
    // ROLE
    // =================================================

    role: {
      type: String,
      enum: [
        "vendor_executive",
        "vendor",
        "state_head",
        "client",
      ],
      required: true,
      index: true,
    },

    // =================================================
    // LOCATIONS
    //
    // Example:
    //
    // [
    //   {
    //     state: "Maharashtra",
    //     zones: ["Pune", "Mumbai"]
    //   },
    //   {
    //     state: "Gujarat",
    //     zones: ["Ahmedabad", "Surat"]
    //   }
    // ]
    //
    // =================================================

    locations: {
      type: [locationSchema],
      default: [],
    },

    // =================================================
    // OPTIONAL SITE CODES
    //
    // Empty:
    //
    // []
    //
    // Means user can see all sites matching
    // campaign + locations.
    //
    // Example:
    //
    // [
    //   "MH001",
    //   "MH002"
    // ]
    //
    // Means user can see only these site codes.
    //
    // =================================================

    site_codes: {
      type: [
        {
          type: String,
          trim: true,
          uppercase: true,
        },
      ],
      default: [],
    },

    // =================================================
    // ACTIVE
    // =================================================

    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },

  {
    timestamps: true,
  }
);

// =====================================================
// UNIQUE CAMPAIGN ASSIGNMENT
//
// Same user + same campaign
// can exist only once.
//
// User A
//   Campaign 1 -> allowed
//   Campaign 2 -> allowed
//
// User A
//   Campaign 1 -> duplicate -> NOT allowed
//
// =====================================================

campaignUserSchema.index(
  {
    campaign_id: 1,
    user_id: 1,
  },
  {
    unique: true,
  }
);

// =====================================================
// USER -> CAMPAIGN QUERY
//
// Used frequently when logged-in user selects
// a campaign.
//
// =====================================================

campaignUserSchema.index({
  user_id: 1,
  campaign_id: 1,
  is_active: 1,
});

// =====================================================
// CAMPAIGN -> ROLE QUERY
//
// Example:
//
// Get all vendor executives
// of Campaign 1
//
// =====================================================

campaignUserSchema.index({
  campaign_id: 1,
  role: 1,
  is_active: 1,
});

// =====================================================
// LOCATION QUERY
//
// Useful for filtering users/access by state.
//
// =====================================================

campaignUserSchema.index({
  campaign_id: 1,
  "locations.state": 1,
  is_active: 1,
});

// =====================================================
// SITE CODE QUERY
//
// Useful when a user has specific site codes.
//
// =====================================================

campaignUserSchema.index({
  campaign_id: 1,
  site_codes: 1,
  is_active: 1,
});

// =====================================================
// MODEL
// =====================================================

module.exports =
  mongoose.models.CampaignUser ||
  mongoose.model(
    "CampaignUser",
    campaignUserSchema
  );