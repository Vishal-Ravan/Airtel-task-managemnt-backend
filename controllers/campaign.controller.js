const mongoose = require("mongoose");

const Campaign = require("../models/Campaign");
const Site = require("../models/Site");

// =====================================================
// CREATE CAMPAIGN
// =====================================================

const createCampaign = async (req, res) => {
  try {
    // ========================================
    // ROLE CHECK
    // ========================================

    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can create campaigns",
      });
    }

    // ========================================
    // BODY
    // ========================================

    const {
      name,
      code,
      description,
      start_date,
      end_date,
      is_active,
    } = req.body;

    // ========================================
    // REQUIRED
    // ========================================

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Campaign name and code are required",
      });
    }

    // ========================================
    // CHECK CODE
    // ========================================

    const existingCampaign = await Campaign.findOne({
      code: code.trim().toUpperCase(),
    });

    if (existingCampaign) {
      return res.status(409).json({
        success: false,
        message: "Campaign code already exists",
      });
    }

    // ========================================
    // DATE VALIDATION
    // ========================================

    if (
      start_date &&
      end_date &&
      new Date(start_date) > new Date(end_date)
    ) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be after end date",
      });
    }

    // ========================================
    // CREATE
    // ========================================

    const campaign = await Campaign.create({
      name: name.trim(),

      code: code.trim().toUpperCase(),

      description:
        description?.trim() || "",

      start_date:
        start_date || null,

      end_date:
        end_date || null,

      is_active:
        typeof is_active === "boolean"
          ? is_active
          : true,

      created_by: req.user._id,
    });

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      campaign,
    });
  } catch (error) {
    console.error(
      "CREATE CAMPAIGN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create campaign",
    });
  }
};


// =====================================================
// GET ALL CAMPAIGNS
// =====================================================

const getCampaigns = async (req, res) => {
  try {
    const {
      is_active,
      search,
    } = req.query;

    const filter = {};

    // ========================================
    // STATUS FILTER
    // ========================================

    if (is_active !== undefined) {
      filter.is_active =
        is_active === "true";
    }

    // ========================================
    // SEARCH
    // ========================================

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          code: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    // ========================================
    // GET
    // ========================================

    const campaigns =
      await Campaign.find(filter)
        .populate(
          "created_by",
          "name email role"
        )
        .sort({
          createdAt: -1,
        });

    // ========================================
    // SITE COUNTS
    // ========================================

    const campaignsWithCounts =
      await Promise.all(
        campaigns.map(async (campaign) => {
          const siteCount =
            await Site.countDocuments({
              campaign_id:
                campaign._id,
            });

          return {
            ...campaign.toObject(),
            site_count: siteCount,
          };
        })
      );

    return res.json({
      success: true,
      count:
        campaignsWithCounts.length,
      campaigns:
        campaignsWithCounts,
    });
  } catch (error) {
    console.error(
      "GET CAMPAIGNS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch campaigns",
    });
  }
};


// =====================================================
// GET CAMPAIGN BY ID
// =====================================================

const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    // ========================================
    // OBJECT ID CHECK
    // ========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID",
      });
    }

    // ========================================
    // FIND
    // ========================================

    const campaign =
      await Campaign.findById(id)
        .populate(
          "created_by",
          "name email role"
        );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // ========================================
    // GET SITES
    // ========================================

    const sites =
      await Site.find({
        campaign_id: campaign._id,
      })
        .sort({
          createdAt: -1,
        });

    return res.json({
      success: true,

      campaign: {
        ...campaign.toObject(),

        site_count:
          sites.length,

        sites,
      },
    });
  } catch (error) {
    console.error(
      "GET CAMPAIGN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch campaign",
    });
  }
};


// =====================================================
// UPDATE CAMPAIGN
// =====================================================

const updateCampaign = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can update campaigns",
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID",
      });
    }

    const {
      name,
      code,
      description,
      start_date,
      end_date,
      is_active,
    } = req.body;

    const campaign =
      await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // ========================================
    // CODE CHECK
    // ========================================

    if (code !== undefined) {
      const normalizedCode =
        code.trim().toUpperCase();

      const existing =
        await Campaign.findOne({
          code: normalizedCode,
          _id: {
            $ne: id,
          },
        });

      if (existing) {
        return res.status(409).json({
          success: false,
          message:
            "Campaign code already exists",
        });
      }

      campaign.code =
        normalizedCode;
    }

    // ========================================
    // UPDATE
    // ========================================

    if (name !== undefined) {
      campaign.name =
        name.trim();
    }

    if (description !== undefined) {
      campaign.description =
        description.trim();
    }

    if (start_date !== undefined) {
      campaign.start_date =
        start_date || null;
    }

    if (end_date !== undefined) {
      campaign.end_date =
        end_date || null;
    }

    if (typeof is_active === "boolean") {
      campaign.is_active =
        is_active;
    }

    // ========================================
    // DATE CHECK
    // ========================================

    if (
      campaign.start_date &&
      campaign.end_date &&
      campaign.start_date >
        campaign.end_date
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Start date cannot be after end date",
      });
    }

    await campaign.save();

    return res.json({
      success: true,
      message:
        "Campaign updated successfully",
      campaign,
    });
  } catch (error) {
    console.error(
      "UPDATE CAMPAIGN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update campaign",
    });
  }
};


// =====================================================
// UPDATE CAMPAIGN STATUS
// =====================================================

const updateCampaignStatus =
  async (req, res) => {
    try {
      if (
        !req.user ||
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Only admin can update campaign status",
        });
      }

      const { id } = req.params;
      const { is_active } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid campaign ID",
        });
      }

      if (
        typeof is_active !== "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "is_active must be boolean",
        });
      }

      const campaign =
        await Campaign.findByIdAndUpdate(
          id,
          {
            is_active,
          },
          {
            new: true,
          }
        );

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message:
            "Campaign not found",
        });
      }

      return res.json({
        success: true,
        message:
          "Campaign status updated successfully",
        campaign,
      });
    } catch (error) {
      console.error(
        "CAMPAIGN STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update campaign status",
      });
    }
  };


// =====================================================
// DELETE CAMPAIGN
// =====================================================

const deleteCampaign = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Only admin can delete campaigns",
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid campaign ID",
      });
    }

    const campaign =
      await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message:
          "Campaign not found",
      });
    }

    // ========================================
    // CHECK SITES
    // ========================================

    const siteCount =
      await Site.countDocuments({
        campaign_id: id,
      });

    if (siteCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete campaign because sites are assigned to it",
        site_count: siteCount,
      });
    }

    await Campaign.findByIdAndDelete(id);

    return res.json({
      success: true,
      message:
        "Campaign deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE CAMPAIGN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete campaign",
    });
  }
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  updateCampaignStatus,
  deleteCampaign,
};