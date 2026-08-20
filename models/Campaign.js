const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 150
        },

        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },

        description: {
            type: String,
            default: "",
            trim: true
        },

        status: {
            type: String,
            enum: [
                "active",
                "inactive",
                "completed"
            ],
            default: "active"
        },

        start_date: {
            type: Date
        },

        end_date: {
            type: Date
        },

        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

campaignSchema.index({
    status: 1
});

module.exports = mongoose.model(
    "Campaign",
    campaignSchema
);