const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    // ========================================
    // CAMPAIGN NAME
    // ========================================

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    // ========================================
    // CAMPAIGN CODE
    // ========================================

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // ========================================
    // DESCRIPTION
    // ========================================

    description: {
      type: String,
      default: "",
      trim: true,
    },

    // ========================================
    // STATUS
    // ========================================

    status: {
      type: String,
      enum: [
        "active",
        "inactive",
        "completed",
      ],
      default: "active",
      index: true,
    },

    // ========================================
    // CREATED BY
    // ========================================

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Campaign ||
  mongoose.model("Campaign", campaignSchema);