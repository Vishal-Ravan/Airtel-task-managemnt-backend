const mongoose = require("mongoose");


// =====================================================
// SITE HISTORY SCHEMA
// =====================================================

const siteHistorySchema = new mongoose.Schema(
    {
        // ========================================
        // SUBMISSION
        // ========================================

        submission: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SiteSubmission",
            default: null
        },


        // ========================================
        // ACTION
        // ========================================

        action: {
            type: String,
            enum: [
                "site_created",
                "submission_uploaded",
                "vendor_approved",
                "vendor_rejected",
                "state_head_approved",
                "state_head_rejected"
            ],
            required: true
        },


        // ========================================
        // ACTION BY
        // ========================================

        action_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        action_by_role: {
            type: String,
            default: ""
        },

        action_by_name: {
            type: String,
            default: ""
        },


        // ========================================
        // REMARKS
        // ========================================

        remarks: {
            type: String,
            default: ""
        },


        // ========================================
        // STATUS
        // ========================================

        old_status: {
            type: String,
            default: null
        },

        new_status: {
            type: String,
            default: null
        },


        // ========================================
        // COMPLETE SITE SNAPSHOT
        // ========================================

        site_snapshot: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },


        // ========================================
        // COMPLETE SUBMISSION SNAPSHOT
        // ========================================

        submission_snapshot: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },


        // ========================================
        // HISTORY DATE
        // ========================================

        created_at: {
            type: Date,
            default: Date.now
        }
    },
    {
        _id: true
    }
);


// =====================================================
// SITE SCHEMA
// =====================================================

const siteSchema = new mongoose.Schema(
    {

        // ========================================
        // SITE BASIC DETAILS
        // ========================================

        site_code: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },

        state: {
            type: String,
            required: true,
            index: true,
            trim: true
        },

        zone: {
            type: String,
            required: true,
            index: true,
            trim: true
        },

        media_type: {
            type: String,
            required: true,
            trim: true
        },

        duration: {
            type: String,
            default: ""
        },

        location: {
            type: String,
            required: true,
            trim: true
        },

        type: {
            type: String,
            default: ""
        },

        unit: {
            type: String,
            default: ""
        },

        width: {
            type: Number,
            default: null
        },

        height: {
            type: Number,
            default: null
        },

        total_sqr_ft: {
            type: Number,
            default: null
        },

        lat: {
            type: Number,
            default: null
        },

        long: {
            type: Number,
            default: null
        },


        // ========================================
        // VENDOR
        // ========================================

        vendor: {
            type: String,
            default: "DENTSU COMMUNICATIONS",
            trim: true
        },


        // ========================================
        // OTHER DETAILS
        // ========================================

        availability: {
            type: String,
            default: ""
        },

        remarks: {
            type: String,
            default: ""
        },

        start_date: {
            type: Date,
            default: null
        },

        end_date: {
            type: Date,
            default: null
        },


        // ========================================
        // ASSIGNMENTS
        // ========================================

        assigned_vendor_executive: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        assigned_state_head: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        assigned_client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },


        // ========================================
        // CURRENT SUBMISSION
        // ========================================

        current_submission: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SiteSubmission",
            default: null
        },


        // ========================================
        // SITE HISTORY
        //
        // Latest history = index 0
        // ========================================

        history: {
            type: [siteHistorySchema],
            default: []
        },


        // ========================================
        // SITE WORKFLOW STATUS
        // ========================================

        status: {
            type: String,

            enum: [
                "pending_upload",
                "pending_vendor_approval",
                "vendor_rejected",
                "pending_state_head_approval",
                "state_head_rejected",
                "approved"
            ],

            default: "pending_upload",

            index: true
        }
    },

    {
        timestamps: true
    }
);


// =====================================================
// MODEL
// =====================================================

module.exports =
    mongoose.model("Site", siteSchema);