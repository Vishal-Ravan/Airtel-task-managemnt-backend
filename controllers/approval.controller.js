const mongoose = require("mongoose");

const Site = require("../models/Site");
const SiteSubmission = require("../models/SiteSubmission");
const CampaignUser = require("../models/CampaignUser");

const { createHistory } = require("../services/history.service");

// =====================================================
// COMMON HELPERS
// =====================================================

// -----------------------------------------------------
// GET CAMPAIGN ID
// -----------------------------------------------------

const getCampaignId = (req) => {
  return (
    req.query?.campaign_id ||
    req.query?.campaignId ||
    req.body?.campaign_id ||
    req.body?.campaignId ||
    null
  );
};

// -----------------------------------------------------
// VALIDATE CAMPAIGN ID
// -----------------------------------------------------

const validateCampaignId = (campaignId) => {
  if (!campaignId) {
    return {
      valid: false,
      message: "Campaign ID is required",
    };
  }

  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    return {
      valid: false,
      message: "Invalid campaign ID",
    };
  }

  return {
    valid: true,
  };
};

// -----------------------------------------------------
// CAMPAIGN FILTER
// -----------------------------------------------------

const getCampaignFilter = (campaignId) => {
  return {
    campaign_id: new mongoose.Types.ObjectId(campaignId),
  };
};

// -----------------------------------------------------
// NORMALIZE
// -----------------------------------------------------

const normalize = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toLowerCase();
};

// -----------------------------------------------------
// ESCAPE REGEX
// -----------------------------------------------------

const escapeRegex = (value) => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

// -----------------------------------------------------
// SITE FIELDS
// -----------------------------------------------------

const SITE_FIELDS = `
  campaign_id
  site_name
  site_code
  state
  town
  zone
  vendor
  vendor_name
  location
  media_type
  type
  unit
  duration
  width
  height
  total_sqr_ft
  lat
  long
  status
  current_submission
  assigned_vendor_executive
  assigned_state_head
  assigned_client
`;

// =====================================================
// STATE HEAD CAMPAIGN ACCESS
// =====================================================
//
// Finds ONLY the selected campaign assignment.
//
// user
//   ↓
// campaign
//   ↓
// state_head
//
// =====================================================

const getStateHeadCampaignAccess = async (
  user,
  campaignId
) => {
  if (!user?._id || !campaignId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    return null;
  }

  const campaignAccess = await CampaignUser.findOne({
    user_id: user._id,
    campaign_id: new mongoose.Types.ObjectId(campaignId),
    role: "state_head",
    is_active: true,
  }).lean();

  return campaignAccess || null;
};

// =====================================================
// STATE HEAD ACCESS DATA
// =====================================================
//
// Schema:
//
// locations: [
//   {
//     state: "Maharashtra",
//     zones: ["Pune", "Mumbai"]
//   }
// ]
//
// =====================================================

const getStateHeadAccessData = async (
  user,
  campaignId
) => {
  const campaignAccess =
    await getStateHeadCampaignAccess(
      user,
      campaignId
    );

  if (!campaignAccess) {
    return {
      campaignAccess: null,
      locations: [],
      siteCodes: [],
    };
  }

  // ===================================================
  // LOCATIONS
  // ===================================================

  const locations = Array.isArray(
    campaignAccess.locations
  )
    ? campaignAccess.locations
        .map((location) => {
          const state = normalize(
            location?.state
          );

          // ---------------------------------------------
          // ZONES
          // ---------------------------------------------

          const zones =
            Array.isArray(
              location?.zones
            )
              ? location.zones
                  .flatMap((zone) => {
                    let value = "";

                    // String / Number
                    if (
                      typeof zone ===
                        "string" ||
                      typeof zone ===
                        "number"
                    ) {
                      value = String(zone);
                    }

                    // Object
                    else if (
                      zone &&
                      typeof zone ===
                        "object"
                    ) {
                      value =
                        zone.name ||
                        zone.zone ||
                        zone.value ||
                        zone.label ||
                        "";
                    }

                    // -----------------------------------
                    // SPLIT COMMA SEPARATED ZONES
                    // -----------------------------------

                    return String(value)
                      .split(",")
                      .map((item) =>
                        normalize(item)
                      )
                      .filter(Boolean);
                  })
                  .filter(Boolean)
              : [];

          return {
            state,
            zones,
          };
        })
        .filter(
          (location) =>
            location.state ||
            location.zones.length > 0
        )
    : [];

  // ===================================================
  // SITE CODES
  // ===================================================

  const rawSiteCodes =
    campaignAccess.site_codes ||
    campaignAccess.siteCodes ||
    [];

  const siteCodes = Array.isArray(
    rawSiteCodes
  )
    ? rawSiteCodes
        .flatMap((code) => {
          let value = "";

          if (
            typeof code === "string" ||
            typeof code === "number"
          ) {
            value = String(code);
          } else if (
            code &&
            typeof code === "object"
          ) {
            value =
              code.site_code ||
              code.siteCode ||
              code.code ||
              code.value ||
              "";
          }

          return String(value)
            .split(",")
            .map((item) =>
              normalize(item)
            )
            .filter(Boolean);
        })
        .filter(Boolean)
    : [];

  console.log(
    "========== STATE HEAD ACCESS =========="
  );

  console.log(
    "Campaign:",
    campaignId
  );

  console.log(
    "State Head:",
    user?._id
  );

  console.log(
    "Locations:",
    JSON.stringify(
      locations,
      null,
      2
    )
  );

  console.log(
    "Site Codes:",
    siteCodes
  );

  console.log(
    "======================================"
  );

  return {
    campaignAccess,
    locations,
    siteCodes,
  };
};

// =====================================================
// CHECK STATE HEAD SITE ACCESS
// =====================================================
//
// Permission:
//
// Campaign
//   AND
// State
//   AND
// Zone
//   AND optional Site Code
//
// =====================================================

const checkStateHeadSiteAccess = async (
  user,
  site,
  campaignId
) => {
  if (!user?._id || !site || !campaignId) {
    return false;
  }

  const {
    campaignAccess,
    locations,
    siteCodes,
  } = await getStateHeadAccessData(
    user,
    campaignId
  );

  // ---------------------------------------------------
  // CAMPAIGN ACCESS
  // ---------------------------------------------------

  if (!campaignAccess) {
    return false;
  }

  // ---------------------------------------------------
  // SITE CODE
  // ---------------------------------------------------

  if (siteCodes.length > 0) {
    const siteCode = normalize(
      site.site_code
    );

    if (!siteCode) {
      return false;
    }

    if (!siteCodes.includes(siteCode)) {
      return false;
    }
  }

  // ---------------------------------------------------
  // LOCATION
  // ---------------------------------------------------

  if (locations.length === 0) {
    return false;
  }

  const siteState = normalize(
    site.state
  );

  const siteZone = normalize(
    site.zone
  );

  const locationMatched =
    locations.some((location) => {
      // -----------------------------------------------
      // STATE MUST MATCH
      // -----------------------------------------------

      if (
        location.state &&
        location.state !== siteState
      ) {
        return false;
      }

      // -----------------------------------------------
      // ZONES
      // -----------------------------------------------

      // Empty zones means
      // entire state is allowed
      if (
        location.zones.length === 0
      ) {
        return true;
      }

      // Zone assigned
      return location.zones.includes(
        siteZone
      );
    });

  return locationMatched;
};

// =====================================================
// BUILD STATE HEAD SITE FILTER
// =====================================================
//
// Converts permission into MongoDB query.
//
// Example:
//
// Maharashtra
//   Pune
//   Mumbai
//
// Gujarat
//   Ahmedabad
//
// becomes:
//
// campaign_id = X
// AND
// (
//   state=Maharashtra AND zone IN(Pune,Mumbai)
//   OR
//   state=Gujarat AND zone IN(Ahmedabad)
// )
//
// =====================================================

const buildStateHeadSiteFilter = async (
  user,
  campaignId
) => {
  const {
    campaignAccess,
    locations,
    siteCodes,
  } = await getStateHeadAccessData(
    user,
    campaignId
  );

  if (!campaignAccess) {
    return null;
  }

  const filter = {
    ...getCampaignFilter(campaignId),
  };

  // ===================================================
  // LOCATION FILTER
  // ===================================================

  if (locations.length > 0) {
    const locationConditions =
      locations
        .map((location) => {
          const condition = {};

          // STATE
          if (location.state) {
            condition.state =
              new RegExp(
                `^${escapeRegex(
                  location.state
                )}$`,
                "i"
              );
          }

          // ZONES
          if (
            Array.isArray(
              location.zones
            ) &&
            location.zones.length > 0
          ) {
            condition.zone = {
              $in: location.zones.map(
                (zone) =>
                  new RegExp(
                    `^${escapeRegex(
                      zone
                    )}$`,
                    "i"
                  )
              ),
            };
          }

          return condition;
        })
        .filter(
          (condition) =>
            Object.keys(condition).length > 0
        );

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
  // SITE CODE
  // ===================================================

  if (siteCodes.length > 0) {
    filter.site_code = {
      $in: siteCodes.map(
        (code) =>
          new RegExp(
            `^${escapeRegex(code)}$`,
            "i"
          )
      ),
    };
  }

  console.log(
    "======================================"
  );
  console.log(
    "STATE HEAD SITE FILTER"
  );
  console.log(
    JSON.stringify(
      filter,
      null,
      2
    )
  );
  console.log(
    "======================================"
  );

  return filter;
};

// =====================================================
// GET VENDOR PENDING APPROVALS
// =====================================================

const getVendorPendingApprovals =
  async (req, res) => {
    try {
      if (
        !req.user ||
        req.user.role !== "vendor"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Only vendor can view approvals",
        });
      }

      const campaignId =
        getCampaignId(req);

      const validation =
        validateCampaignId(
          campaignId
        );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message:
            validation.message,
        });
      }

      const sites =
        await Site.find({
          ...getCampaignFilter(
            campaignId
          ),
          vendor: "DENTSU COMMUNICATIONS",
        }).select("_id");

      const siteIds =
        sites.map(
          (site) => site._id
        );

      const submissions =
        await SiteSubmission.find({
          site: {
            $in: siteIds,
          },
          status:
            "pending_vendor_approval",
        })
          .populate(
            "site",
            SITE_FIELDS
          )
          .populate(
            "uploaded_by",
            "name email role"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        campaign_id:
          campaignId,
        count:
          submissions.length,
        submissions,
      });
    } catch (error) {
      console.error(
        "GET VENDOR PENDING APPROVAL ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to get vendor approvals",
      });
    }
  };

// =====================================================
// VENDOR APPROVE
// =====================================================

const vendorApprove = async (
  req,
  res
) => {
  try {
    if (
      !req.user ||
      req.user.role !== "vendor"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only vendor can approve",
      });
    }

    const {
      submissionId,
    } = req.params;

    const remarks =
      typeof req.body?.remarks ===
      "string"
        ? req.body.remarks.trim()
        : "";

    const campaignId =
      getCampaignId(req);

    const validation =
      validateCampaignId(
        campaignId
      );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message:
          validation.message,
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        submissionId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid submission ID is required",
      });
    }

    const submission =
      await SiteSubmission.findById(
        submissionId
      );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message:
          "Submission not found",
      });
    }

    const site =
      await Site.findOne({
        _id: submission.site,
        ...getCampaignFilter(
          campaignId
        ),
        vendor:
          "DENTSU COMMUNICATIONS",
      });

    if (!site) {
      return res.status(404).json({
        success: false,
        message:
          "Site not found in selected campaign",
      });
    }

    if (
      submission.status !==
      "pending_vendor_approval"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This submission is not pending vendor approval",
      });
    }

    const oldStatus =
      site.status;

    submission.status =
      "pending_state_head_approval";

    submission.remarks =
      remarks;

    await submission.save();

    site.status =
      "pending_state_head_approval";

    site.current_submission =
      submission._id;

    await site.save();

    await createHistory({
      site,
      submission,
      action:
        "vendor_approved",
      actionBy:
        req.user,
      actionByRole:
        req.user.role,
      remarks,
      oldStatus,
      newStatus:
        "pending_state_head_approval",
    });

    return res.status(200).json({
      success: true,
      message:
        "Site approved by vendor",
      campaign_id:
        campaignId,
      submission_id:
        submission._id,
      site_id:
        site._id,
      status:
        site.status,
    });
  } catch (error) {
    console.error(
      "VENDOR APPROVE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Vendor approval failed",
    });
  }
};

// =====================================================
// VENDOR REJECT
// =====================================================

const vendorReject = async (
  req,
  res
) => {
  try {
    if (
      !req.user ||
      req.user.role !== "vendor"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only vendor can reject",
      });
    }

    const {
      submissionId,
    } = req.params;

    const remarks =
      typeof req.body?.remarks ===
      "string"
        ? req.body.remarks.trim()
        : "";

    if (!remarks) {
      return res.status(400).json({
        success: false,
        message:
          "Remarks are required for rejection",
      });
    }

    const campaignId =
      getCampaignId(req);

    const validation =
      validateCampaignId(
        campaignId
      );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message:
          validation.message,
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        submissionId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid submission ID is required",
      });
    }

    const submission =
      await SiteSubmission.findById(
        submissionId
      );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message:
          "Submission not found",
      });
    }

    const site =
      await Site.findOne({
        _id: submission.site,
        ...getCampaignFilter(
          campaignId
        ),
        vendor:
          "DENTSU COMMUNICATIONS",
      });

    if (!site) {
      return res.status(404).json({
        success: false,
        message:
          "Site not found in selected campaign",
      });
    }

    if (
      submission.status !==
      "pending_vendor_approval"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This submission is not pending vendor approval",
      });
    }

    const oldStatus =
      site.status;

    submission.status =
      "vendor_rejected";

    submission.remarks =
      remarks;

    await submission.save();

    site.status =
      "vendor_rejected";

    site.current_submission =
      submission._id;

    await site.save();

    await createHistory({
      site,
      submission,
      action:
        "vendor_rejected",
      actionBy:
        req.user,
      actionByRole:
        req.user.role,
      remarks,
      oldStatus,
      newStatus:
        "vendor_rejected",
    });

    return res.status(200).json({
      success: true,
      message:
        "Site rejected by vendor",
      campaign_id:
        campaignId,
      submission_id:
        submission._id,
      site_id:
        site._id,
      status:
        site.status,
    });
  } catch (error) {
    console.error(
      "VENDOR REJECT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Vendor rejection failed",
    });
  }
};

// =====================================================
// GET VENDOR SITES
// =====================================================

const getVendorSites = async (
  req,
  res
) => {
  try {
    if (
      !req.user ||
      req.user.role !== "vendor"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only vendor can access this data",
      });
    }

    const campaignId =
      getCampaignId(req);

    const validation =
      validateCampaignId(
        campaignId
      );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message:
          validation.message,
      });
    }

    const sites =
      await Site.find({
        ...getCampaignFilter(
          campaignId
        ),
        vendor:
          "DENTSU COMMUNICATIONS",
      }).select("_id");

    const siteIds =
      sites.map(
        (site) => site._id
      );

    const submissions =
      await SiteSubmission.find({
        site: {
          $in: siteIds,
        },
        status: {
          $in: [
            "pending_vendor_approval",
            "vendor_rejected",
            "pending_state_head_approval",
            "state_head_rejected",
            "approved",
          ],
        },
      })
        .populate(
          "site",
          SITE_FIELDS
        )
        .populate(
          "uploaded_by",
          "name email role"
        )
        .sort({
          createdAt: -1,
        });

    return res.status(200).json({
      success: true,
      campaign_id:
        campaignId,
      count:
        submissions.length,
      submissions:
        submissions.filter(
          (item) => item.site
        ),
    });
  } catch (error) {
    console.error(
      "GET VENDOR SITES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to get vendor sites",
    });
  }
};

// =====================================================
// GET PENDING APPROVALS
// =====================================================
//
// STATE HEAD
//   -> campaign + state + zone + site code
//
// VENDOR
//   -> campaign + vendor
//
// ADMIN
//   -> campaign
//
// =====================================================

const getPendingApprovals = async (
  req,
  res
) => {
  try {
    const role =
      req.user?.role;

    if (
      ![
        "state_head",
        "vendor",
        "admin",
      ].includes(role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to view approvals",
      });
    }

    const campaignId =
      getCampaignId(req);

    const validation =
      validateCampaignId(
        campaignId
      );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message:
          validation.message,
      });
    }

    // =================================================
    // STATE HEAD
    // =================================================

    if (role === "state_head") {
      const campaignAccess =
        await getStateHeadCampaignAccess(
          req.user,
          campaignId
        );

      if (!campaignAccess) {
        return res.status(200).json({
          success: true,
          campaign_id:
            campaignId,
          count: 0,
          submissions: [],
        });
      }

      const siteFilter =
        await buildStateHeadSiteFilter(
          req.user,
          campaignId
        );

      if (!siteFilter) {
        return res.status(200).json({
          success: true,
          campaign_id:
            campaignId,
          count: 0,
          submissions: [],
        });
      }

      // -----------------------------------------------
      // IMPORTANT
      // State Head ONLY gets pending_state_head_approval
      // -----------------------------------------------

      const sites =
        await Site.find(
          siteFilter
        ).select("_id");

      const siteIds =
        sites.map(
          (site) => site._id
        );

      if (siteIds.length === 0) {
        return res.status(200).json({
          success: true,
          campaign_id:
            campaignId,
          state_head: {
            id:
              req.user._id,
            name:
              req.user.name,
            campaign_access:
              campaignAccess,
          },
          count: 0,
          submissions: [],
        });
      }

      const submissions =
        await SiteSubmission.find({
          site: {
            $in: siteIds,
          },
          status:
            "pending_state_head_approval",
        })
          .populate({
            path: "site",
            select: SITE_FIELDS,
          })
          .populate({
            path: "uploaded_by",
            select:
              "name email role",
          })
          .sort({
            createdAt: -1,
          });

      // -----------------------------------------------
      // FINAL SECURITY CHECK
      // -----------------------------------------------

      const filtered =
        [];

      for (
        const submission of submissions
      ) {
        if (!submission.site) {
          continue;
        }

        const allowed =
          await checkStateHeadSiteAccess(
            req.user,
            submission.site,
            campaignId
          );

        if (allowed) {
          filtered.push(
            submission
          );
        }
      }

      return res.status(200).json({
        success: true,

        campaign_id:
          campaignId,

        state_head: {
          id:
            req.user._id,

          name:
            req.user.name,

          campaign_access:
            campaignAccess,
        },

        count:
          filtered.length,

        submissions:
          filtered,
      });
    }

    // =================================================
    // VENDOR
    // =================================================

    if (role === "vendor") {
      const sites =
        await Site.find({
          ...getCampaignFilter(
            campaignId
          ),
          vendor:
            "DENTSU COMMUNICATIONS",
        }).select("_id");

      const siteIds =
        sites.map(
          (site) => site._id
        );

      const submissions =
        await SiteSubmission.find({
          site: {
            $in: siteIds,
          },
          status:
            "pending_vendor_approval",
        })
          .populate({
            path: "site",
            select: SITE_FIELDS,
          })
          .populate({
            path: "uploaded_by",
            select:
              "name email role",
          })
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        campaign_id:
          campaignId,
        count:
          submissions.length,
        submissions,
      });
    }

    // =================================================
    // ADMIN
    // =================================================

    if (role === "admin") {
      const submissions =
        await SiteSubmission.find({
          status: {
            $in: [
              "pending_vendor_approval",
              "pending_state_head_approval",
            ],
          },
        })
          .populate({
            path: "site",
            match: {
              ...getCampaignFilter(
                campaignId
              ),
            },
            select:
              SITE_FIELDS,
          })
          .populate({
            path: "uploaded_by",
            select:
              "name email role",
          })
          .sort({
            createdAt: -1,
          });

      const filtered =
        submissions.filter(
          (item) =>
            item.site
        );

      return res.status(200).json({
        success: true,
        campaign_id:
          campaignId,
        count:
          filtered.length,
        submissions:
          filtered,
      });
    }
  } catch (error) {
    console.error(
      "GET PENDING APPROVALS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to load pending approvals",
    });
  }
};

// =====================================================
// STATE HEAD APPROVE
// =====================================================

const stateHeadApprove = async (
  req,
  res
) => {
  try {
    if (
      !req.user ||
      req.user.role !==
        "state_head"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only state head can approve",
      });
    }

    const {
      submissionId,
    } = req.params;

    const remarks =
      typeof req.body?.remarks ===
      "string"
        ? req.body.remarks.trim()
        : "";

    const campaignId =
      getCampaignId(req);

    const validation =
      validateCampaignId(
        campaignId
      );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message:
          validation.message,
      });
    }

    // =================================================
    // CHECK CAMPAIGN ACCESS
    // =================================================

    const campaignAccess =
      await getStateHeadCampaignAccess(
        req.user,
        campaignId
      );

    if (!campaignAccess) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this campaign",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        submissionId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid submission ID is required",
      });
    }

    // =================================================
    // SUBMISSION
    // =================================================

    const submission =
      await SiteSubmission.findById(
        submissionId
      );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message:
          "Submission not found",
      });
    }

    if (
      submission.status !==
      "pending_state_head_approval"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This submission is not pending state head approval",
      });
    }

    // =================================================
    // SITE + CAMPAIGN
    // =================================================

    const site =
      await Site.findOne({
        _id: submission.site,
        ...getCampaignFilter(
          campaignId
        ),
      });

    if (!site) {
      return res.status(404).json({
        success: false,
        message:
          "Site not found in selected campaign",
      });
    }

    // =================================================
    // PERMISSION CHECK
    // =================================================

    const allowed =
      await checkStateHeadSiteAccess(
        req.user,
        site,
        campaignId
      );

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to approve this site",
      });
    }

    // =================================================
    // UPDATE
    // =================================================

    const oldStatus =
      site.status;

    submission.status =
      "approved";

    submission.remarks =
      remarks;

    await submission.save();

    site.status =
      "approved";

    site.current_submission =
      submission._id;

    await site.save();

    // =================================================
    // HISTORY
    // =================================================

    await createHistory({
      site,
      submission,
      action:
        "state_head_approved",
      actionBy:
        req.user,
      actionByRole:
        req.user.role,
      remarks,
      oldStatus,
      newStatus:
        "approved",
    });

    return res.status(200).json({
      success: true,
      message:
        "Site approved by state head",
      campaign_id:
        campaignId,
      submission_id:
        submission._id,
      site_id:
        site._id,
      status:
        site.status,
    });
  } catch (error) {
    console.error(
      "STATE HEAD APPROVE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "State head approval failed",
    });
  }
};

// =====================================================
// STATE HEAD REJECT
// =====================================================

const stateHeadReject = async (
  req,
  res
) => {
  try {
    if (
      !req.user ||
      req.user.role !==
        "state_head"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only state head can reject",
      });
    }

    const {
      submissionId,
    } = req.params;

    const remarks =
      typeof req.body?.remarks ===
      "string"
        ? req.body.remarks.trim()
        : "";

    if (!remarks) {
      return res.status(400).json({
        success: false,
        message:
          "Remarks are required for rejection",
      });
    }

    const campaignId =
      getCampaignId(req);

    const validation =
      validateCampaignId(
        campaignId
      );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message:
          validation.message,
      });
    }

    // =================================================
    // CAMPAIGN ACCESS
    // =================================================

    const campaignAccess =
      await getStateHeadCampaignAccess(
        req.user,
        campaignId
      );

    if (!campaignAccess) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this campaign",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        submissionId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid submission ID is required",
      });
    }

    const submission =
      await SiteSubmission.findById(
        submissionId
      );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message:
          "Submission not found",
      });
    }

    if (
      submission.status !==
      "pending_state_head_approval"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This submission is not pending state head approval",
      });
    }

    // =================================================
    // SITE
    // =================================================

    const site =
      await Site.findOne({
        _id: submission.site,
        ...getCampaignFilter(
          campaignId
        ),
      });

    if (!site) {
      return res.status(404).json({
        success: false,
        message:
          "Site not found in selected campaign",
      });
    }

    // =================================================
    // PERMISSION
    // =================================================

    const allowed =
      await checkStateHeadSiteAccess(
        req.user,
        site,
        campaignId
      );

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to reject this site",
      });
    }

    // =================================================
    // UPDATE
    // =================================================

    const oldStatus =
      site.status;

    submission.status =
      "state_head_rejected";

    submission.remarks =
      remarks;

    await submission.save();

    site.status =
      "state_head_rejected";

    site.current_submission =
      submission._id;

    await site.save();

    // =================================================
    // HISTORY
    // =================================================

    await createHistory({
      site,
      submission,
      action:
        "state_head_rejected",
      actionBy:
        req.user,
      actionByRole:
        req.user.role,
      remarks,
      oldStatus,
      newStatus:
        "state_head_rejected",
    });

    return res.status(200).json({
      success: true,
      message:
        "Site rejected by state head",
      campaign_id:
        campaignId,
      submission_id:
        submission._id,
      site_id:
        site._id,
      status:
        site.status,
    });
  } catch (error) {
    console.error(
      "STATE HEAD REJECT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "State head rejection failed",
    });
  }
};

// =====================================================
// GET VENDOR APPROVAL STATUS
// =====================================================

const getVendorApprovalStatus =
  async (req, res) => {
    try {
      if (
        !req.user ||
        req.user.role !==
          "vendor"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Only vendor can access this data",
        });
      }

      const campaignId =
        getCampaignId(req);

      const validation =
        validateCampaignId(
          campaignId
        );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message:
            validation.message,
        });
      }

      const sites =
        await Site.find({
          ...getCampaignFilter(
            campaignId
          ),
          vendor:
            "DENTSU COMMUNICATIONS",
        })
          .populate({
            path:
              "current_submission",
            populate: {
              path:
                "uploaded_by",
              select:
                "name email role",
            },
          })
          .sort({
            updatedAt: -1,
          });

      const result =
        sites
          .filter(
            (site) =>
              site.current_submission
          )
          .map((site) => {
            const submission =
              site.current_submission;

            let vendor_status =
              "pending";

            if (
              [
                "pending_state_head_approval",
                "approved",
                "state_head_rejected",
              ].includes(
                submission.status
              )
            ) {
              vendor_status =
                "approved";
            }

            if (
              submission.status ===
              "vendor_rejected"
            ) {
              vendor_status =
                "rejected";
            }

            return {
              _id:
                submission._id,

              campaign_id:
                site.campaign_id,

              site: {
                _id:
                  site._id,
                site_name:
                  site.site_name,
                site_code:
                  site.site_code,
                state:
                  site.state,
                town:
                  site.town,
                zone:
                  site.zone,
                location:
                  site.location,
                media_type:
                  site.media_type,
                type:
                  site.type,
                unit:
                  site.unit,
                width:
                  site.width,
                height:
                  site.height,
                total_sqr_ft:
                  site.total_sqr_ft,
                lat:
                  site.lat,
                long:
                  site.long,
                vendor:
                  site.vendor,
              },

              submission: {
                _id:
                  submission._id,
                status:
                  submission.status,
                remarks:
                  submission.remarks ||
                  "",
                selfie:
                  submission.selfie,
                site_images:
                  submission.site_images,
                person_name:
                  submission.person_name,
                uploaded_by:
                  submission.uploaded_by,
                uploaded_at:
                  submission.uploaded_at,
                createdAt:
                  submission.createdAt,
                updatedAt:
                  submission.updatedAt,
              },

              vendor_status,
            };
          });

      const counts = {
        all:
          result.length,

        approved:
          result.filter(
            (item) =>
              item.vendor_status ===
              "approved"
          ).length,

        pending:
          result.filter(
            (item) =>
              item.vendor_status ===
              "pending"
          ).length,

        rejected:
          result.filter(
            (item) =>
              item.vendor_status ===
              "rejected"
          ).length,
      };

      return res.status(200).json({
        success: true,
        campaign_id:
          campaignId,
        counts,
        count:
          result.length,
        submissions:
          result,
      });
    } catch (error) {
      console.error(
        "GET VENDOR SITE STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch vendor site status",
      });
    }
  };

// =====================================================
// GET STATE HEAD SITE STATUS
// =====================================================
//
// State Head gets only:
//
// Campaign
//   + assigned State
//   + assigned Zone
//   + optional Site Code
//
// =====================================================

const getStateHeadSiteStatus =
  async (req, res) => {
    try {
      if (
        !req.user ||
        req.user.role !==
          "state_head"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Only State Head can access this data",
        });
      }

      const campaignId =
        getCampaignId(req);

      const validation =
        validateCampaignId(
          campaignId
        );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message:
            validation.message,
        });
      }

      // =================================================
      // CAMPAIGN ACCESS
      // =================================================

      const campaignAccess =
        await getStateHeadCampaignAccess(
          req.user,
          campaignId
        );

      if (!campaignAccess) {
        return res.status(200).json({
          success: true,
          campaign_id:
            campaignId,
          counts: {
            all: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
          },
          count: 0,
          submissions: [],
        });
      }

      // =================================================
      // BUILD PERMISSION FILTER
      // =================================================

      const siteFilter =
        await buildStateHeadSiteFilter(
          req.user,
          campaignId
        );

      if (!siteFilter) {
        return res.status(200).json({
          success: true,
          campaign_id:
            campaignId,
          counts: {
            all: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
          },
          count: 0,
          submissions: [],
        });
      }

      // =================================================
      // SITES
      // =================================================

      const sites =
        await Site.find(
          siteFilter
        )
          .populate({
            path:
              "current_submission",
            populate: {
              path:
                "uploaded_by",
              select:
                "name email role",
            },
          })
          .sort({
            updatedAt: -1,
          });

      // =================================================
      // RESULT
      // =================================================

      const result =
        [];

      for (
        const site of sites
      ) {
        const submission =
          site.current_submission;

        if (!submission) {
          continue;
        }

        if (
          ![
            "pending_state_head_approval",
            "approved",
            "state_head_rejected",
          ].includes(
            submission.status
          )
        ) {
          continue;
        }

        // -----------------------------------------------
        // FINAL SECURITY
        // -----------------------------------------------

        const allowed =
          await checkStateHeadSiteAccess(
            req.user,
            site,
            campaignId
          );

        if (!allowed) {
          continue;
        }

        let state_head_status =
          "pending";

        if (
          submission.status ===
          "approved"
        ) {
          state_head_status =
            "approved";
        }

        if (
          submission.status ===
          "state_head_rejected"
        ) {
          state_head_status =
            "rejected";
        }

        result.push({
          _id:
            submission._id,

          campaign_id:
            site.campaign_id,

          state_head_status,

          site: {
            _id:
              site._id,
            site_name:
              site.site_name,
            site_code:
              site.site_code,
            state:
              site.state,
            town:
              site.town,
            zone:
              site.zone,
            location:
              site.location,
            media_type:
              site.media_type,
            type:
              site.type,
            unit:
              site.unit,
            width:
              site.width,
            height:
              site.height,
            total_sqr_ft:
              site.total_sqr_ft,
            lat:
              site.lat,
            long:
              site.long,
            vendor:
              site.vendor,
          },

          submission: {
            _id:
              submission._id,
            status:
              submission.status,
            remarks:
              submission.remarks ||
              "",
            selfie:
              submission.selfie,
            site_images:
              submission.site_images,
            person_name:
              submission.person_name,
            uploaded_by:
              submission.uploaded_by,
            uploaded_at:
              submission.uploaded_at,
            createdAt:
              submission.createdAt,
            updatedAt:
              submission.updatedAt,
          },
        });
      }

      // =================================================
      // COUNTS
      // =================================================

      const counts = {
        all:
          result.length,

        pending:
          result.filter(
            (item) =>
              item.state_head_status ===
              "pending"
          ).length,

        approved:
          result.filter(
            (item) =>
              item.state_head_status ===
              "approved"
          ).length,

        rejected:
          result.filter(
            (item) =>
              item.state_head_status ===
              "rejected"
          ).length,
      };

      return res.status(200).json({
        success: true,

        campaign_id:
          campaignId,

        state_head: {
          id:
            req.user._id,

          name:
            req.user.name,

          campaign_access:
            campaignAccess,
        },

        counts,

        count:
          result.length,

        submissions:
          result,
      });
    } catch (error) {
      console.error(
        "GET STATE HEAD SITE STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch State Head site status",
      });
    }
  };

// =====================================================
// CLIENT DASHBOARD
// =====================================================

const getClientDashboard =
  async (req, res) => {
    try {
      if (
        !req.user ||
        req.user.role !== "client"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Only client can access this data",
        });
      }

      const campaignId =
        getCampaignId(req);

      const validation =
        validateCampaignId(
          campaignId
        );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message:
            validation.message,
        });
      }

      const sites =
        await Site.find({
          ...getCampaignFilter(
            campaignId
          ),
          assigned_client:
            req.user._id,
        })
          .populate({
            path:
              "current_submission",
            populate: {
              path:
                "uploaded_by",
              select:
                "name email role",
            },
          })
          .sort({
            updatedAt: -1,
          });

      const siteDetails =
        sites.map((site) => {
          const submission =
            site.current_submission;

          let vendor_status =
            "pending";

          let state_head_status =
            "pending";

          let image_uploaded =
            false;

          if (submission) {
            image_uploaded =
              Array.isArray(
                submission.site_images
              ) &&
              submission.site_images
                .length > 0;

            if (
              submission.status ===
              "vendor_rejected"
            ) {
              vendor_status =
                "rejected";
            }

            if (
              [
                "pending_state_head_approval",
                "approved",
                "state_head_rejected",
              ].includes(
                submission.status
              )
            ) {
              vendor_status =
                "approved";
            }

            if (
              submission.status ===
              "state_head_rejected"
            ) {
              state_head_status =
                "rejected";
            }

            if (
              submission.status ===
              "approved"
            ) {
              state_head_status =
                "approved";
            }
          }

          return {
            site_id:
              site._id,

            campaign_id:
              site.campaign_id,

            site_code:
              site.site_code,

            site_name:
              site.site_name,

            state:
              site.state,

            zone:
              site.zone,

            town:
              site.town,

            vendor:
              site.vendor,

            image_uploaded,

            vendor_status,

            state_head_status,

            submission_status:
              submission?.status ||
              "not_uploaded",

            submission_id:
              submission?._id ||
              null,

            remarks:
              submission?.remarks ||
              "",

            uploaded_by:
              submission?.uploaded_by ||
              null,

            updatedAt:
              submission?.updatedAt ||
              site.updatedAt,
          };
        });

      const counts = {
        total_sites:
          siteDetails.length,

        image_uploaded:
          siteDetails.filter(
            (site) =>
              site.image_uploaded
          ).length,

        image_not_uploaded:
          siteDetails.filter(
            (site) =>
              !site.image_uploaded
          ).length,

        vendor: {
          pending:
            siteDetails.filter(
              (site) =>
                site.vendor_status ===
                "pending"
            ).length,

          approved:
            siteDetails.filter(
              (site) =>
                site.vendor_status ===
                "approved"
            ).length,

          rejected:
            siteDetails.filter(
              (site) =>
                site.vendor_status ===
                "rejected"
            ).length,
        },

        state_head: {
          pending:
            siteDetails.filter(
              (site) =>
                site.state_head_status ===
                "pending"
            ).length,

          approved:
            siteDetails.filter(
              (site) =>
                site.state_head_status ===
                "approved"
            ).length,

          rejected:
            siteDetails.filter(
              (site) =>
                site.state_head_status ===
                "rejected"
            ).length,
        },
      };

      return res.status(200).json({
        success: true,
        campaign_id:
          campaignId,
        counts,
        sites:
          siteDetails,
      });
    } catch (error) {
      console.error(
        "CLIENT DASHBOARD ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to load client dashboard",
      });
    }
  };

// =====================================================
// DASHBOARD STATS
// =====================================================

const getDashboardStats = async (req, res) => {
  try {
    // =====================================================
    // AUTH
    // =====================================================

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = req.user._id;

    // =====================================================
    // CAMPAIGN
    // =====================================================

    const campaignId = getCampaignId(req);

    const validation = validateCampaignId(campaignId);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    // =====================================================
    // GET CAMPAIGN ASSIGNMENT
    // =====================================================
    // IMPORTANT:
    // Role campaign ke according niklega.
    //
    // Example:
    // Global User Role = vendor_executive
    // Campaign 1 Role  = vendor_executive
    // Campaign 2 Role  = client
    //
    // Campaign 2 select hone par role = client hona chahiye.
    // =====================================================

    let campaignAssignment = null;

    if (req.user.role === "admin") {
      campaignAssignment = {
        role: "admin",
        locations: [],
        site_codes: [],
        is_active: true,
      };
    } else {
      campaignAssignment = await CampaignUser.findOne({
        user_id: userId,
        campaign_id: campaignId,
        is_active: true,
      }).lean();

      if (!campaignAssignment) {
        return res.status(403).json({
          success: false,
          message:
            "You are not assigned to this campaign",
        });
      }

      // Campaign role is more important than global role
      if (!campaignAssignment.role) {
        return res.status(403).json({
          success: false,
          message:
            "No role assigned for this campaign",
        });
      }
    }

    // =====================================================
    // CAMPAIGN ROLE
    // =====================================================

    const role =
      req.user.role === "admin"
        ? "admin"
        : campaignAssignment.role;

    // =====================================================
    // VALID ROLES
    // =====================================================

    if (
      ![
        "admin",
        "vendor",
        "state_head",
        "client",
      ].includes(role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This role does not have dashboard access",
      });
    }

    // =====================================================
    // ASSIGNMENT ACCESS
    // =====================================================

    const assignedLocations =
      Array.isArray(
        campaignAssignment?.locations
      )
        ? campaignAssignment.locations.filter(Boolean)
        : [];

    const assignedSiteCodes =
      Array.isArray(
        campaignAssignment?.site_codes
      )
        ? campaignAssignment.site_codes.filter(Boolean)
        : [];

    console.log(
      "========================================"
    );

    console.log(
      "DASHBOARD USER:",
      userId
    );

    console.log(
      "GLOBAL ROLE:",
      req.user.role
    );

    console.log(
      "CAMPAIGN ROLE:",
      role
    );

    console.log(
      "CAMPAIGN ID:",
      campaignId
    );

    console.log(
      "ASSIGNED LOCATIONS:",
      assignedLocations
    );

    console.log(
      "ASSIGNED SITE CODES:",
      assignedSiteCodes
    );

    console.log(
      "========================================"
    );

    // =====================================================
    // BASE CAMPAIGN FILTER
    // =====================================================

    let siteFilter = {
      ...getCampaignFilter(campaignId),
    };

    // =====================================================
    // ADMIN
    // =====================================================

    if (role === "admin") {
      // Admin can see all campaign sites.
    }

    // =====================================================
    // VENDOR
    // =====================================================

    if (role === "vendor") {
      siteFilter.vendor =
        req.user.vendor ||
        "DENTSU COMMUNICATIONS";
    }

    // =====================================================
    // STATE HEAD
    // =====================================================

    if (role === "state_head") {
      const stateHeadFilter =
        await buildStateHeadSiteFilter(
          req.user,
          campaignId
        );

      if (!stateHeadFilter) {
        return res.status(200).json({
          success: true,

          campaign_id:
            campaignId,

          role,

          user: {
            id: req.user._id,
            name: req.user.name,
            role,
          },

          counts: {
            totalSites: 0,

            imageUploaded: 0,
            imagePending: 0,

            vendorPending: 0,
            vendorApproved: 0,
            vendorRejected: 0,

            stateHeadPending: 0,
            stateHeadApproved: 0,
            stateHeadRejected: 0,
          },

          chartData: {
            vendor: {
              pending: 0,
              approved: 0,
              rejected: 0,
            },

            stateHead: {
              pending: 0,
              approved: 0,
              rejected: 0,
            },

            images: {
              uploaded: 0,
              pending: 0,
            },
          },

          sites: [],
        });
      }

      siteFilter = {
        ...stateHeadFilter,
        ...getCampaignFilter(campaignId),
      };
    }

    // =====================================================
    // CLIENT
    // =====================================================
    //
    // IMPORTANT:
    //
    // Client ka access CampaignUser se aayega.
    //
    // Priority:
    //
    // 1. assigned_client
    // 2. locations
    // 3. site_codes
    //
    // =====================================================

   if (role === "client") {
  const clientConditions = [];

  // ===================================================
  // DIRECT CLIENT ASSIGNMENT
  // ===================================================

  clientConditions.push({
    assigned_client: userId,
  });

  // ===================================================
  // SITE CODE ACCESS
  // ===================================================

  if (assignedSiteCodes.length > 0) {
    clientConditions.push({
      site_code: {
        $in: assignedSiteCodes,
      },
    });
  }

  // ===================================================
  // LOCATION ACCESS
  // ===================================================

  if (assignedLocations.length > 0) {
    for (const location of assignedLocations) {
      // -----------------------------------------------
      // Expected:
      //
      // {
      //   state: "Gujarat",
      //   zones: ["Mehsana"]
      // }
      // -----------------------------------------------

      if (!location) {
        continue;
      }

      // =================================================
      // LOCATION OBJECT
      // =================================================

      if (
        typeof location === "object" &&
        !Array.isArray(location)
      ) {
        const state =
          typeof location.state === "string"
            ? location.state.trim()
            : "";

        const zones =
          Array.isArray(location.zones)
            ? location.zones.filter(
                (zone) =>
                  typeof zone === "string" &&
                  zone.trim()
              )
            : [];

        // ---------------------------------------------
        // STATE + ZONES
        // ---------------------------------------------

        if (
          state &&
          zones.length > 0
        ) {
          clientConditions.push({
            state: state,

            zone: {
              $in: zones,
            },
          });

          continue;
        }

        // ---------------------------------------------
        // STATE ONLY
        // ---------------------------------------------

        if (state) {
          clientConditions.push({
            state: state,
          });

          continue;
        }

        // ---------------------------------------------
        // ZONE ONLY
        // ---------------------------------------------

        if (zones.length > 0) {
          clientConditions.push({
            zone: {
              $in: zones,
            },
          });

          continue;
        }
      }

      // =================================================
      // STRING LOCATION
      // =================================================
      //
      // Backward compatibility:
      //
      // locations: ["Gujarat", "Mehsana"]
      //
      // =================================================

      if (
        typeof location === "string" &&
        location.trim()
      ) {
        clientConditions.push({
          $or: [
            {
              state: location.trim(),
            },
            {
              zone: location.trim(),
            },
            {
              town: location.trim(),
            },
            {
              location: location.trim(),
            },
          ],
        });
      }
    }
  }

  // ===================================================
  // CLIENT FILTER
  // ===================================================

  siteFilter = {
    ...siteFilter,

    $or: clientConditions,
  };
}

    // =====================================================
    // LOG FILTER
    // =====================================================

    console.log(
      "========================================"
    );

    console.log(
      "FINAL DASHBOARD FILTER:"
    );

    console.log(
      JSON.stringify(
        siteFilter,
        null,
        2
      )
    );

    console.log(
      "========================================"
    );

    // =====================================================
    // GET SITES
    // =====================================================

    const sites =
      await Site.find(siteFilter)
        .populate({
          path: "current_submission",

          populate: {
            path: "uploaded_by",

            select:
              "name email role",
          },
        })
        .sort({
          updatedAt: -1,
        });

    console.log(
      "DASHBOARD SITES FOUND:",
      sites.length
    );

    // =====================================================
    // COUNTS
    // =====================================================

    const counts = {
      totalSites: sites.length,

      imageUploaded: 0,
      imagePending: 0,

      vendorPending: 0,
      vendorApproved: 0,
      vendorRejected: 0,

      stateHeadPending: 0,
      stateHeadApproved: 0,
      stateHeadRejected: 0,
    };

    // =====================================================
    // SITE DETAILS
    // =====================================================

    const siteDetails = [];

    // =====================================================
    // LOOP
    // =====================================================

    for (const site of sites) {
      // ===================================================
      // STATE HEAD ACCESS
      // ===================================================

      if (role === "state_head") {
        const allowed =
          await checkStateHeadSiteAccess(
            req.user,
            site,
            campaignId
          );

        if (!allowed) {
          continue;
        }
      }

      // ===================================================
      // CURRENT SUBMISSION
      // ===================================================

      const submission =
        site.current_submission;

      // ===================================================
      // DEFAULT STATUS
      // ===================================================

      let imageUploaded = false;

      let vendorStatus = "pending";

      let stateHeadStatus = "pending";

      // ===================================================
      // IMAGE COUNT
      // ===================================================

      const imageCount =
        Array.isArray(
          submission?.site_images
        )
          ? submission.site_images.length
          : 0;

      const hasSelfie =
        !!submission?.selfie;

      // ===================================================
      // IMAGE STATUS
      // ===================================================

      if (imageCount > 0) {
        imageUploaded = true;

        counts.imageUploaded++;
      } else {
        counts.imagePending++;
      }

      // ===================================================
      // VENDOR STATUS
      // ===================================================

      if (!submission) {
        vendorStatus = "pending";

        counts.vendorPending++;
      } else {
        switch (
          submission.status
        ) {
          // =============================================
          // PENDING
          // =============================================

          case "pending_vendor_approval":

          case "pending_upload":

            vendorStatus = "pending";

            counts.vendorPending++;

            break;

          // =============================================
          // APPROVED
          // =============================================

          case "pending_state_head_approval":

          case "approved":

          case "state_head_rejected":

            vendorStatus = "approved";

            counts.vendorApproved++;

            break;

          // =============================================
          // REJECTED
          // =============================================

          case "vendor_rejected":

            vendorStatus = "rejected";

            counts.vendorRejected++;

            break;

          // =============================================
          // DEFAULT
          // =============================================

          default:

            vendorStatus = "pending";

            counts.vendorPending++;

            break;
        }
      }

      // ===================================================
      // STATE HEAD STATUS
      // ===================================================

      if (!submission) {
        stateHeadStatus = "pending";

        counts.stateHeadPending++;
      } else {
        switch (
          submission.status
        ) {
          // =============================================
          // PENDING
          // =============================================

          case "pending_vendor_approval":

          case "vendor_rejected":

            stateHeadStatus = "pending";

            counts.stateHeadPending++;

            break;

          // =============================================
          // STATE HEAD PENDING
          // =============================================

          case "pending_state_head_approval":

            stateHeadStatus = "pending";

            counts.stateHeadPending++;

            break;

          // =============================================
          // APPROVED
          // =============================================

          case "approved":

            stateHeadStatus = "approved";

            counts.stateHeadApproved++;

            break;

          // =============================================
          // REJECTED
          // =============================================

          case "state_head_rejected":

            stateHeadStatus = "rejected";

            counts.stateHeadRejected++;

            break;

          // =============================================
          // DEFAULT
          // =============================================

          default:

            stateHeadStatus = "pending";

            counts.stateHeadPending++;

            break;
        }
      }

      // ===================================================
      // SITE DETAILS
      // ===================================================

      siteDetails.push({
        _id:
          site._id,

        campaign_id:
          site.campaign_id,

        site_name:
          site.site_name,

        site_code:
          site.site_code,

        state:
          site.state,

        zone:
          site.zone,

        town:
          site.town,

        location:
          site.location || "",

        vendor:
          site.vendor,

        assigned_client:
          site.assigned_client || null,

        status:
          site.status,

        // IMAGE
        imageUploaded,

        imageCount,

        hasSelfie,

        // VENDOR
        vendorStatus,

        // STATE HEAD
        stateHeadStatus,

        // SUBMISSION
        submissionId:
          submission?._id ||
          null,

        uploadedBy:
          submission?.uploaded_by ||
          null,

        remarks:
          submission?.remarks ||
          submission?.state_head_remarks ||
          submission?.client_remarks ||
          "",

        submissionStatus:
          submission?.status ||
          null,

        updatedAt:
          submission?.updatedAt ||
          site.updatedAt,
      });
    }

    // =====================================================
    // CHART DATA
    // =====================================================

    const chartData = {
      vendor: {
        pending:
          counts.vendorPending,

        approved:
          counts.vendorApproved,

        rejected:
          counts.vendorRejected,
      },

      stateHead: {
        pending:
          counts.stateHeadPending,

        approved:
          counts.stateHeadApproved,

        rejected:
          counts.stateHeadRejected,
      },

      images: {
        uploaded:
          counts.imageUploaded,

        pending:
          counts.imagePending,
      },
    };

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,

      campaign_id:
        campaignId,

      role,

      user: {
        id:
          req.user._id,

        name:
          req.user.name,

        role,
      },

      campaign_access: {
        role,

        locations:
          assignedLocations,

        site_codes:
          assignedSiteCodes,
      },

      counts,

      chartData,

      sites:
        siteDetails,
    });
  } catch (error) {
    console.error(
      "GET DASHBOARD STATS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to fetch dashboard statistics",
    });
  }
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  getVendorPendingApprovals,
  getVendorSites,
  getPendingApprovals,

  getVendorApprovalStatus,
  getStateHeadSiteStatus,

  vendorApprove,
  vendorReject,

  stateHeadApprove,
  stateHeadReject,

  getClientDashboard,
  getDashboardStats,
};