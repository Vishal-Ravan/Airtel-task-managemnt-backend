const mongoose = require("mongoose");

const CampaignUser = require("../models/CampaignUser");
const Campaign = require("../models/Campaign");

// =====================================================
// NORMALIZE STRING
// =====================================================

const normalizeString = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
};

// =====================================================
// NORMALIZE ARRAY
// =====================================================

const normalizeArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      const normalized =
        normalizeString(item);

      if (!normalized) {
        return [];
      }

      // -----------------------------------------
      // "Mehsana, Himmatnagar"
      // =>
      // ["Mehsana", "Himmatnagar"]
      // -----------------------------------------

      if (normalized.includes(",")) {
        return normalized
          .split(",")
          .map((part) =>
            part.trim()
          )
          .filter(Boolean);
      }

      return [normalized];
    })
    .filter(Boolean);
};

// =====================================================
// NORMALIZE LOCATION
//
// Input:
//
// [
//   {
//     state: "Gujarat",
//     zones: ["Vadodara", "Surat"]
//   }
// ]
//
// Output:
//
// [
//   {
//     state: "Gujarat",
//     zones: ["Vadodara", "Surat"]
//   }
// ]
// =====================================================

const normalizeLocations = (locations) => {
  if (!Array.isArray(locations)) {
    return [];
  }

  return locations
    .map((location) => {
      if (!location) {
        return null;
      }

      const state = normalizeString(
        location.state
      );

      const zones = normalizeArray(
        location.zones
      );

      if (!state) {
        return null;
      }

      return {
        state,
        zones,
      };
    })
    .filter(Boolean);
};

// =====================================================
// GET CAMPAIGN ID
// =====================================================

const getCampaignId = (req) => {
  return (
    req.query?.campaign_id ||
    req.query?.campaignId ||
    req.body?.campaign_id ||
    req.body?.campaignId ||
    req.params?.campaign_id ||
    req.params?.campaignId ||
    null
  );
};

// =====================================================
// GET USER CAMPAIGN ACCESS
// =====================================================

const getUserCampaignAccess = async (
  userId,
  campaignId
) => {
  try {
    if (
      !userId ||
      !campaignId
    ) {
      return null;
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        campaignId
      )
    ) {
      return null;
    }

    const access =
      await CampaignUser.findOne({
        user_id: userId,
        campaign_id: campaignId,
        is_active: true,
      }).lean();

    return access || null;
  } catch (error) {
    console.error(
      "GET USER CAMPAIGN ACCESS ERROR:",
      error
    );

    throw error;
  }
};

// =====================================================
// GET ACTIVE CAMPAIGN
// =====================================================

const getActiveCampaign = async (
  campaignId
) => {
  if (!campaignId) {
    return null;
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      campaignId
    )
  ) {
    return null;
  }

  return Campaign.findOne({
    _id: campaignId,
    status: "active",
  }).lean();
};

// =====================================================
// BUILD ASSIGNED SITE FILTER
// =====================================================
//
// IMPORTANT:
//
// CampaignUser:
//
// locations: [
//   {
//     state: "Gujarat",
//     zones: [
//       "Vadodara",
//       "Surat"
//     ]
//   },
//   {
//     state: "Maharashtra",
//     zones: [
//       "Mumbai"
//     ]
//   }
// ]
//
// Mongo filter:
//
// {
//   $or: [
//     {
//       state: "Gujarat",
//       zone: {
//         $in: [
//           "Vadodara",
//           "Surat"
//         ]
//       }
//     },
//     {
//       state: "Maharashtra",
//       zone: {
//         $in: [
//           "Mumbai"
//         ]
//       }
//     }
//   ]
// }
//
// =====================================================

const buildAssignedSiteFilter = (
  access
) => {
  // ===================================================
  // NO ACCESS
  // ===================================================

  if (!access) {
    return {};
  }

  // ===================================================
  // LOCATIONS
  // ===================================================

  const locations =
    normalizeLocations(
      access.locations
    );

  // ===================================================
  // SITE CODES
  // ===================================================

  const siteCodes =
    normalizeArray(
      access.site_codes ||
      access.siteCodes ||
      []
    );

  const filter = {};

  // ===================================================
  // LOCATION FILTER
  // ===================================================

  if (locations.length > 0) {
    const locationConditions = [];

    locations.forEach(
      (location) => {
        const state =
          normalizeString(
            location.state
          );

        const zones =
          normalizeArray(
            location.zones
          );

        // =============================================
        // STATE + MULTIPLE ZONES
        // =============================================

        if (
          state &&
          zones.length > 0
        ) {
          locationConditions.push({
            state: new RegExp(
              `^${state.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              )}$`,
              "i"
            ),

            zone: {
              $in: zones.map(
                (zone) =>
                  new RegExp(
                    `^${zone.replace(
                      /[.*+?^${}()|[\]\\]/g,
                      "\\$&"
                    )}$`,
                    "i"
                  )
              ),
            },
          });

          return;
        }

        // =============================================
        // STATE ONLY
        // =============================================

        if (
          state &&
          zones.length === 0
        ) {
          locationConditions.push({
            state: new RegExp(
              `^${state.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              )}$`,
              "i"
            ),
          });
        }
      }
    );

    // ===============================================
    // APPLY LOCATION FILTER
    // ===============================================

    if (
      locationConditions.length === 1
    ) {
      Object.assign(
        filter,
        locationConditions[0]
      );
    } else if (
      locationConditions.length > 1
    ) {
      filter.$or =
        locationConditions;
    }
  }

  // ===================================================
  // SITE CODE FILTER
  // ===================================================

  if (siteCodes.length > 0) {
    filter.site_code = {
      $in: siteCodes.map(
        (code) =>
          new RegExp(
            `^${code.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            )}$`,
            "i"
          )
      ),
    };
  }

  return filter;
};

// =====================================================
// REQUIRE CAMPAIGN ACCESS
// =====================================================

const requireCampaignAccess = async (
  req,
  res,
  role = null
) => {
  try {
    // =================================================
    // USER
    // =================================================

    const userId =
      req.user?._id;

    // =================================================
    // CAMPAIGN ID
    // =================================================

    const campaignId =
      getCampaignId(req);

    // =================================================
    // AUTH CHECK
    // =================================================

    if (!userId) {
      return {
        error: true,

        response:
          res.status(401).json({
            success: false,

            message:
              "User not authenticated",
          }),
      };
    }

    // =================================================
    // CAMPAIGN ID REQUIRED
    // =================================================

    if (!campaignId) {
      return {
        error: true,

        response:
          res.status(400).json({
            success: false,

            message:
              "campaign_id is required",
          }),
      };
    }

    // =================================================
    // OBJECT ID VALIDATION
    // =================================================

    if (
      !mongoose.Types.ObjectId.isValid(
        campaignId
      )
    ) {
      return {
        error: true,

        response:
          res.status(400).json({
            success: false,

            message:
              "Invalid campaign_id",
          }),
      };
    }

    // =================================================
    // GET CAMPAIGN
    // =================================================

    const campaign =
      await getActiveCampaign(
        campaignId
      );

    if (!campaign) {
      return {
        error: true,

        response:
          res.status(404).json({
            success: false,

            message:
              "Campaign not found or inactive",
          }),
      };
    }

    // =================================================
    // ADMIN
    // =================================================
    //
    // Admin ko campaign ke saare sites milenge.
    //
    // =================================================

    if (
      req.user.role === "admin"
    ) {
      return {
        error: false,

        campaign,

        campaignId,

        access: null,
      };
    }

    // =================================================
    // ROLE CHECK
    // =================================================

    if (
      role &&
      req.user.role !== role
    ) {
      return {
        error: true,

        response:
          res.status(403).json({
            success: false,

            message:
              `Only ${role} can access this resource`,
          }),
      };
    }

    // =================================================
    // GET CAMPAIGN USER ACCESS
    // =================================================

    const access =
      await getUserCampaignAccess(
        userId,
        campaignId
      );

    // =================================================
    // NOT ASSIGNED
    // =================================================

    if (!access) {
      return {
        error: true,

        response:
          res.status(403).json({
            success: false,

            message:
              "You are not assigned to this campaign",
          }),
      };
    }

    // =================================================
    // ROLE CHECK
    // =================================================

    if (
      access.role &&
      access.role !== req.user.role
    ) {
      return {
        error: true,

        response:
          res.status(403).json({
            success: false,

            message:
              "Your role is not assigned to this campaign",
          }),
      };
    }

    // =================================================
    // ACCESS SUCCESS
    // =================================================

    return {
      error: false,

      campaign,

      campaignId,

      access,
    };
  } catch (error) {
    console.error(
      "REQUIRE CAMPAIGN ACCESS ERROR:",
      error
    );

    return {
      error: true,

      response:
        res.status(500).json({
          success: false,

          message:
            error.message ||
            "Failed to validate campaign access",
        }),
    };
  }
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  normalizeArray,

  normalizeLocations,

  getCampaignId,

  getUserCampaignAccess,

  getActiveCampaign,

  buildAssignedSiteFilter,

  requireCampaignAccess,
};