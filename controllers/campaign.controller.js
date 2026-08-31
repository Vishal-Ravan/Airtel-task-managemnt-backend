const mongoose = require("mongoose");

const Campaign = require("../models/Campaign");
const Site = require("../models/Site");
const CampaignUser = require("../models/CampaignUser");

// =====================================================
// HELPER: GET USER CAMPAIGN ASSIGNMENTS
// =====================================================

const getUserCampaignAssignments = async (userId) => {
  if (!userId) {
    return [];
  }

  const assignments = await CampaignUser.find({
    user_id: userId,
    is_active: true,
  })
    .select(
      "campaign_id role locations site_codes is_active"
    )
    .lean();

  return assignments;
};

// =====================================================
// HELPER: GET USER CAMPAIGN IDS
// =====================================================

const getUserCampaignIds = async (user) => {
  // Admin => all campaigns
  if (user?.role === "admin") {
    return null;
  }

  if (!user?._id) {
    return [];
  }

  const assignments =
    await getUserCampaignAssignments(
      user._id
    );

  return assignments
    .map((assignment) => assignment.campaign_id)
    .filter(Boolean);
};

// =====================================================
// HELPER: CHECK CAMPAIGN ACCESS
// =====================================================

const hasCampaignAccess = async (
  user,
  campaignId
) => {
  // Admin has access to everything
  if (user?.role === "admin") {
    return true;
  }

  if (!user?._id || !campaignId) {
    return false;
  }

  const assignment =
    await CampaignUser.findOne({
      user_id: user._id,
      campaign_id: campaignId,
      is_active: true,
    });

  return !!assignment;
};

// =====================================================
// CREATE CAMPAIGN
// =====================================================

const createCampaign = async (req, res) => {
  try {
    if (
      !req.user ||
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin can create campaigns",
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

    if (
      !name ||
      !name.trim() ||
      !code ||
      !code.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Campaign name and code are required",
      });
    }

    const campaignName = name.trim();

    const campaignCode =
      code.trim().toUpperCase();

    // Duplicate code
    const existingCampaign =
      await Campaign.findOne({
        code: campaignCode,
      });

    if (existingCampaign) {
      return res.status(409).json({
        success: false,
        message:
          "Campaign code already exists",
      });
    }

    // Date validation
    if (
      start_date &&
      end_date &&
      new Date(start_date) >
        new Date(end_date)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Start date cannot be after end date",
      });
    }

    const campaign =
      await Campaign.create({
        name: campaignName,

        code: campaignCode,

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

        created_by:
          req.user._id,
      });

    return res.status(201).json({
      success: true,

      message:
        "Campaign created successfully",

      campaign,
    });
  } catch (error) {
    console.error(
      "CREATE CAMPAIGN ERROR:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Campaign code already exists",
      });
    }

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
//
// ADMIN
// -> All campaigns
//
// OTHER USERS
// -> Only campaigns assigned in CampaignUser
// =====================================================

const getCampaigns = async (req, res) => {
  try {
    if (
      !req.user ||
      !req.user.role
    ) {
      return res.status(401).json({
        success: false,
        message:
          "User authentication required",
      });
    }

    const {
      is_active,
      search,
    } = req.query;

    const filter = {};

    // =================================================
    // ACTIVE FILTER
    // =================================================

    if (
      is_active !== undefined
    ) {
      filter.is_active =
        is_active === "true";
    }

    // =================================================
    // SEARCH
    // =================================================

    if (
      search &&
      search.trim()
    ) {
      const searchValue =
        search.trim();

      filter.$or = [
        {
          name: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          code: {
            $regex: searchValue,
            $options: "i",
          },
        },
      ];
    }

    // =================================================
    // USER CAMPAIGN ACCESS
    // =================================================

    if (
      req.user.role !== "admin"
    ) {
      const campaignIds =
        await getUserCampaignIds(
          req.user
        );

      console.log(
        "USER ID:",
        req.user._id
      );

      console.log(
        "USER CAMPAIGN IDS:",
        campaignIds
      );

      // No assignment
      if (
        !campaignIds ||
        campaignIds.length === 0
      ) {
        return res.json({
          success: true,
          count: 0,
          campaigns: [],
        });
      }

      filter._id = {
        $in: campaignIds,
      };
    }

    // =================================================
    // GET CAMPAIGNS
    // =================================================

    const campaigns =
      await Campaign.find(filter)
        .populate(
          "created_by",
          "name email role"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    // =================================================
    // SITE COUNTS
    // =================================================

    const campaignsWithCounts =
      await Promise.all(
        campaigns.map(
          async (campaign) => {
            const siteCount =
              await Site.countDocuments({
                campaign_id:
                  campaign._id,
              });

            return {
              ...campaign,

              site_count:
                siteCount,
            };
          }
        )
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
//
// User sirf wahi campaign dekh sakta hai
// jisme CampaignUser assignment hai.
//
// Aur sites sirf us campaign ki aayengi.
// =====================================================

const getCampaignById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid campaign ID",
      });
    }

    const campaign =
      await Campaign.findById(id)
        .populate(
          "created_by",
          "name email role"
        )
        .lean();

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message:
          "Campaign not found",
      });
    }

    // =================================================
    // ACCESS CHECK
    // =================================================

    const hasAccess =
      await hasCampaignAccess(
        req.user,
        campaign._id
      );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "You are not assigned to this campaign",
      });
    }

    // =================================================
    // GET ONLY THIS CAMPAIGN'S SITES
    // =================================================

    const sites =
      await Site.find({
        campaign_id:
          campaign._id,
      })
        .sort({
          createdAt: -1,
        })
        .lean();

    // =================================================
    // USER ASSIGNMENT
    // =================================================

    let campaignAccess = null;

    if (
      req.user.role !== "admin"
    ) {
      campaignAccess =
        await CampaignUser.findOne({
          user_id: req.user._id,

          campaign_id:
            campaign._id,

          is_active: true,
        })
          .select(
            "role locations site_codes is_active"
          )
          .lean();
    }

    return res.json({
      success: true,

      campaign: {
        ...campaign,

        site_count:
          sites.length,

        sites,

        access:
          campaignAccess,
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

const updateCampaign = async (
  req,
  res
) => {
  try {
    if (
      !req.user ||
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin can update campaigns",
      });
    }

    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid campaign ID",
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
        message:
          "Campaign not found",
      });
    }

    // CODE
    if (code !== undefined) {
      if (
        !code ||
        !code.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Campaign code cannot be empty",
        });
      }

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

    // NAME
    if (name !== undefined) {
      if (
        !name ||
        !name.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Campaign name cannot be empty",
        });
      }

      campaign.name =
        name.trim();
    }

    // DESCRIPTION
    if (
      description !== undefined
    ) {
      campaign.description =
        description?.trim() || "";
    }

    // START DATE
    if (
      start_date !== undefined
    ) {
      campaign.start_date =
        start_date || null;
    }

    // END DATE
    if (
      end_date !== undefined
    ) {
      campaign.end_date =
        end_date || null;
    }

    // STATUS
    if (
      typeof is_active === "boolean"
    ) {
      campaign.is_active =
        is_active;
    }

    // DATE VALIDATION
    if (
      campaign.start_date &&
      campaign.end_date &&
      new Date(
        campaign.start_date
      ) >
        new Date(
          campaign.end_date
        )
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

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Campaign code already exists",
      });
    }

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
      const { is_active } =
        req.body;

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
            runValidators: true,
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

const deleteCampaign = async (
  req,
  res
) => {
  try {
    if (
      !req.user ||
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin can delete campaigns",
      });
    }

    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
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

    const siteCount =
      await Site.countDocuments({
        campaign_id:
          campaign._id,
      });

    if (siteCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete campaign because sites are assigned to it",
        site_count:
          siteCount,
      });
    }

    await Campaign.findByIdAndDelete(
      campaign._id
    );

    // Also remove campaign assignments
    await CampaignUser.deleteMany({
      campaign_id:
        campaign._id,
    });

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
// EXPORTS
// =====================================================

module.exports = {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  updateCampaignStatus,
  deleteCampaign,
};