const mongoose = require("mongoose");

const campaignUserSchema = new mongoose.Schema(
    {
        campaign_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campaign",
            required: true,
            index: true
        },

        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        role: {
            type: String,
            enum: [
                "vendor_executive",
                "vendor",
                "state_head",
                "client"
            ],
            required: true
        },

        is_active: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

campaignUserSchema.index(
    {
        campaign_id: 1,
        user_id: 1,
        role: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model(
    "CampaignUser",
    campaignUserSchema
);