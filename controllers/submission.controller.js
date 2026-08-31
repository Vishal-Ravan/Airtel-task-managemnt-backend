const mongoose = require("mongoose");

const Site = require("../models/Site");
const SiteSubmission = require("../models/SiteSubmission");

const {
  requireCampaignAccess,
  buildAssignedSiteFilter,
} = require("../services/campaignAccess.service");

const {
  createHistory,
} = require("../services/history.service");

// =====================================================
// HELPERS
// =====================================================

const getUserId = (req) => {
  return (
    req?.user?._id ||
    req?.user?.id ||
    null
  );
};

// =====================================================
// NORMALIZE UPLOAD PATH
// =====================================================

const normalizeUploadPath = (filePath) => {
  if (!filePath) {
    return "";
  }

  let normalized = String(filePath).replace(
    /\\/g,
    "/"
  );

  const uploadsIndex =
    normalized.toLowerCase().lastIndexOf(
      "/uploads/"
    );

  if (uploadsIndex !== -1) {
    return normalized.substring(
      uploadsIndex + 1
    );
  }

  if (
    normalized
      .toLowerCase()
      .startsWith("uploads/")
  ) {
    return normalized;
  }

  const filename =
    normalized.split("/").pop();

  return `uploads/${filename}`;
};

// =====================================================
// GET MY SUBMISSIONS
//
// GET /api/submissions?campaign_id=xxx
//
// ADMIN:
// All submissions
//
// VENDOR EXECUTIVE:
// Only submissions uploaded by himself
// =====================================================

const getMySubmissions = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "User not authenticated",
      });
    }

    // =================================================
    // CAMPAIGN ACCESS
    // =================================================

    const accessResult =
      await requireCampaignAccess(
        req,
        res
      );

    if (accessResult.error) {
      return accessResult.response;
    }

    const {
      campaignId,
      access,
    } = accessResult;

    // =================================================
    // FILTER
    // =================================================

    const filter = {
      campaign_id: campaignId,
    };

    // =================================================
    // NON ADMIN
    // =================================================

    if (
      req.user.role !== "admin"
    ) {
      filter.uploaded_by = userId;
    }

    // =================================================
    // GET SUBMISSIONS
    // =================================================

    const submissions =
      await SiteSubmission.find(
        filter
      )
        .populate(
          "site"
        )
        .populate(
          "submitted_by",
          "name email role"
        )
        .populate(
          "uploaded_by",
          "name email role"
        )
        .populate(
          "vendor",
          "name email role"
        )
        .populate(
          "state_head",
          "name email role"
        )
        .populate(
          "client",
          "name email role"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    // =================================================
    // NON ADMIN SITE ACCESS
    // =================================================

    let finalSubmissions =
      submissions;

    if (
      req.user.role !== "admin" &&
      access
    ) {
      const siteFilter =
        buildAssignedSiteFilter(
          access
        );

      const assignedSites =
        await Site.find({
          campaign_id:
            campaignId,

          ...siteFilter,
        })
          .select("_id")
          .lean();

      const assignedSiteIds =
        new Set(
          assignedSites.map(
            (site) =>
              String(site._id)
          )
        );

      finalSubmissions =
        submissions.filter(
          (submission) =>
            submission.site &&
            assignedSiteIds.has(
              String(
                submission.site._id
              )
            )
        );
    }

    // =================================================
    // RESPONSE
    // =================================================

    return res.json({
      success: true,

      campaign_id:
        campaignId,

      count:
        finalSubmissions.length,

      submissions:
        finalSubmissions,
    });
  } catch (error) {
    console.error(
      "GET MY SUBMISSIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to get submissions",
    });
  }
};

// =====================================================
// GET SUBMISSION BY ID
//
// GET /api/submissions/:id?campaign_id=xxx
// =====================================================

const getSubmissionById =
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      // =================================================
      // VALIDATE ID
      // =================================================

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid submission ID",
        });
      }

      // =================================================
      // CAMPAIGN ACCESS
      // =================================================

      const accessResult =
        await requireCampaignAccess(
          req,
          res
        );

      if (accessResult.error) {
        return accessResult.response;
      }

      const {
        campaignId,
        access,
      } = accessResult;

      // =================================================
      // FIND SUBMISSION
      // =================================================

      const submission =
        await SiteSubmission.findOne({
          _id: id,

          campaign_id:
            campaignId,
        })
          .populate(
            "site"
          )
          .populate(
            "submitted_by",
            "name email role"
          )
          .populate(
            "uploaded_by",
            "name email role"
          )
          .populate(
            "vendor",
            "name email role"
          )
          .populate(
            "state_head",
            "name email role"
          )
          .populate(
            "client",
            "name email role"
          )
          .lean();

      if (!submission) {
        return res.status(404).json({
          success: false,

          message:
            "Submission not found in this campaign",
        });
      }

      // =================================================
      // NON ADMIN ACCESS
      // =================================================

      if (
        req.user.role !== "admin"
      ) {
        if (!submission.site) {
          return res.status(404).json({
            success: false,

            message:
              "Site not found",
          });
        }

        const siteFilter =
          buildAssignedSiteFilter(
            access
          );

        const assignedSite =
          await Site.findOne({
            _id:
              submission.site._id,

            campaign_id:
              campaignId,

            ...siteFilter,
          });

        if (!assignedSite) {
          return res.status(403).json({
            success: false,

            message:
              "You are not allowed to view this submission",
          });
        }
      }

      // =================================================
      // RESPONSE
      // =================================================

      return res.json({
        success: true,

        campaign_id:
          campaignId,

        submission,
      });
    } catch (error) {
      console.error(
        "GET SUBMISSION BY ID ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to get submission",
      });
    }
  };

// =====================================================
// SUBMIT SITE
//
// POST /api/submissions
//
// IMPORTANT:
//
// Every upload creates a NEW submission.
//
// Same campaign + same site:
//
// Upload 1 -> Submission 1
// Upload 2 -> Submission 2
// Upload 3 -> Submission 3
//
// Previous submissions are NOT updated.
// =====================================================

const submitSite = async (
  req,
  res
) => {
  try {
    // =================================================
    // USER
    // =================================================

    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,

        message:
          "User authentication failed",
      });
    }

    // =================================================
    // ROLE
    // =================================================

    if (
      ![
        "vendor_executive",
        "admin",
      ].includes(
        req.user.role
      )
    ) {
      return res.status(403).json({
        success: false,

        message:
          "You are not allowed to submit a site",
      });
    }

    // =================================================
    // CAMPAIGN ACCESS
    // =================================================

    const accessResult =
      await requireCampaignAccess(
        req,
        res
      );

    if (accessResult.error) {
      return accessResult.response;
    }

    const {
      campaignId,
      access,
    } = accessResult;

    // =================================================
    // BODY
    // =================================================

    const site_id =
      req.body?.site_id;

    const person_name =
      req.body?.person_name;

    // =================================================
    // SITE ID VALIDATION
    // =================================================

    if (!site_id) {
      return res.status(400).json({
        success: false,

        message:
          "site_id is required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        site_id
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid site_id",
      });
    }

    // =================================================
    // PERSON NAME VALIDATION
    // =================================================

    if (
      !person_name ||
      !String(
        person_name
      ).trim()
    ) {
      return res.status(400).json({
        success: false,

        message:
          "person_name is required",
      });
    }

    // =================================================
    // FIND SITE
    // =================================================

    const site =
      await Site.findOne({
        _id: site_id,

        campaign_id:
          campaignId,

        ...(req.user.role ===
        "admin"
          ? {}
          : buildAssignedSiteFilter(
              access
            )),
      });

    if (!site) {
      return res.status(404).json({
        success: false,

        message:
          "Site not found or not assigned to you in this campaign",
      });
    }

    // =================================================
    // FILES
    // =================================================

    const selfie =
      req.files?.selfie?.[0];

    const siteImages =
      req.files?.site_images ||
      [];

    // =================================================
    // SELFIE
    // =================================================

    if (!selfie) {
      return res.status(400).json({
        success: false,

        message:
          "Selfie is required",
      });
    }

    // =================================================
    // SITE IMAGES
    // =================================================

    if (
      siteImages.length === 0
    ) {
      return res.status(400).json({
        success: false,

        message:
          "At least one site image is required",
      });
    }

    // =================================================
    // FILE PATHS
    // =================================================

    const selfiePath =
      normalizeUploadPath(
        selfie.path
      );

    const imagePaths =
      siteImages.map(
        (file) =>
          normalizeUploadPath(
            file.path
          )
      );

    // =================================================
    // OLD SITE STATUS
    // =================================================

    const oldStatus =
      site.status;

    // =================================================
    // FIND LAST SUBMISSION
    //
    // ONLY TO CALCULATE VERSION.
    //
    // We DO NOT BLOCK UPLOAD.
    // =================================================

    const lastSubmission =
      await SiteSubmission.findOne({
        campaign_id:
          campaignId,

        site:
          site._id,
      })
        .sort({
          upload_version: -1,
          createdAt: -1,
        })
        .select(
          "_id upload_version"
        )
        .lean();

    // =================================================
    // NEXT VERSION
    // =================================================

    const nextUploadVersion =
      lastSubmission
        ? Number(
            lastSubmission.upload_version ||
              1
          ) + 1
        : 1;

    console.log(
      "========================================"
    );

    console.log(
      "NEW SITE SUBMISSION"
    );

    console.log(
      "CAMPAIGN:",
      campaignId
    );

    console.log(
      "SITE:",
      site._id
    );

    console.log(
      "PREVIOUS SUBMISSION:",
      lastSubmission?._id ||
        "NONE"
    );

    console.log(
      "NEW VERSION:",
      nextUploadVersion
    );

    console.log(
      "========================================"
    );

    // =================================================
    // CREATE NEW SUBMISSION
    //
    // NEVER UPDATE OLD SUBMISSION
    // =================================================

    const submission =
      await SiteSubmission.create({
        campaign_id:
          campaignId,

        site:
          site._id,

        submitted_by:
          userId,

        uploaded_by:
          userId,

        uploader_role:
          req.user.role,

        person_name:
          String(
            person_name
          ).trim(),

        selfie:
          selfiePath,

        site_images:
          imagePaths,

        remarks:
          "",

        // =================================================
        // VENDOR
        // =================================================

        vendor:
          null,

        vendor_status:
          "pending",

        vendor_remarks:
          "",

        vendor_action_at:
          null,

        // =================================================
        // STATE HEAD
        // =================================================

        state_head:
          null,

        state_head_status:
          "pending",

        state_head_remarks:
          "",

        state_head_action_at:
          null,

        // =================================================
        // CLIENT
        // =================================================

        client:
          null,

        // =================================================
        // STATUS
        // =================================================

        status:
          "pending_vendor_approval",

        // =================================================
        // VERSION
        // =================================================

        upload_version:
          nextUploadVersion,

        // =================================================
        // DATES
        // =================================================

        uploaded_at:
          new Date(),

        reuploaded_at:
          nextUploadVersion > 1
            ? new Date()
            : null,

        approved_at:
          null,
      });

    // =================================================
    // UPDATE SITE
    //
    // Only latest submission is stored here.
    //
    // Old submissions remain in DB.
    // =================================================

    site.status =
      "pending_vendor_approval";

    site.current_submission =
      submission._id;

    await site.save();

    // =================================================
    // HISTORY REMARKS
    // =================================================

    let remarks =
      "Site submitted by vendor executive";

    if (
      nextUploadVersion > 1
    ) {
      remarks =
        `New submission uploaded by vendor executive (Version ${nextUploadVersion})`;
    }

    // =================================================
    // HISTORY
    // =================================================

    const history =
      await createHistory({
        site,

        submission,

        action:
          "submission_uploaded",

        actionBy:
          req.user,

        actionByRole:
          req.user.role,

        remarks,

        oldStatus,

        newStatus:
          "pending_vendor_approval",
      });

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(201).json({
      success: true,

      message:
        nextUploadVersion > 1
          ? "New submission uploaded successfully"
          : "Site submitted successfully",

      campaign_id:
        campaignId,

      site_id:
        site._id,

      submission_id:
        submission._id,

      upload_version:
        nextUploadVersion,

      submission,

      history,
    });
  } catch (error) {
    console.error(
      "SUBMIT SITE ERROR:",
      error
    );

    // =================================================
    // VALIDATION ERROR
    // =================================================

    if (
      error.name ===
      "ValidationError"
    ) {
      const errors = {};

      Object.keys(
        error.errors
      ).forEach(
        (key) => {
          errors[key] =
            error.errors[key].message;
        }
      );

      return res.status(400).json({
        success: false,

        message:
          "Validation failed",

        errors,
      });
    }

    // =================================================
    // DUPLICATE KEY
    // =================================================

    if (
      error.code === 11000
    ) {
      console.error(
        "DUPLICATE KEY ERROR:",
        error
      );

      return res.status(409).json({
        success: false,

        message:
          "Duplicate submission index exists in MongoDB. Please remove the old unique campaign_id + site index.",

        campaign_id:
          error?.keyValue?.campaign_id,

        site_id:
          error?.keyValue?.site,
      });
    }

    // =================================================
    // GENERAL ERROR
    // =================================================

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to submit site",
    });
  }
};

// =====================================================
// GET SITE SUBMISSIONS / HISTORY
//
// GET /api/submissions/site/:siteId/history
//
// ?campaign_id=xxx
//
// Returns ALL submissions of this site
// in this campaign.
// =====================================================

const getSiteSubmissions =
  async (req, res) => {
    try {
      const {
        siteId,
      } = req.params;

      // =================================================
      // SITE ID VALIDATION
      // =================================================

      if (
        !mongoose.Types.ObjectId.isValid(
          siteId
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid siteId",
        });
      }

      // =================================================
      // CAMPAIGN ACCESS
      // =================================================

      const accessResult =
        await requireCampaignAccess(
          req,
          res
        );

      if (accessResult.error) {
        return accessResult.response;
      }

      const {
        campaignId,
        access,
      } = accessResult;

      // =================================================
      // FIND SITE
      // =================================================

      const site =
        await Site.findOne({
          _id:
            siteId,

          campaign_id:
            campaignId,

          ...(req.user.role ===
          "admin"
            ? {}
            : buildAssignedSiteFilter(
                access
              )),
        });

      if (!site) {
        return res.status(404).json({
          success: false,

          message:
            "Site not found or not assigned to you in this campaign",
        });
      }

      // =================================================
      // GET ALL SUBMISSIONS
      // =================================================

      const submissions =
        await SiteSubmission.find({
          site:
            siteId,

          campaign_id:
            campaignId,
        })
          .populate(
            "site"
          )
          .populate(
            "submitted_by",
            "name email role"
          )
          .populate(
            "uploaded_by",
            "name email role"
          )
          .populate(
            "vendor",
            "name email role"
          )
          .populate(
            "state_head",
            "name email role"
          )
          .populate(
            "client",
            "name email role"
          )
          .sort({
            upload_version: -1,
            createdAt: -1,
          })
          .lean();

      // =================================================
      // RESPONSE
      // =================================================

      return res.json({
        success: true,

        campaign_id:
          campaignId,

        site_id:
          siteId,

        count:
          submissions.length,

        submissions,
      });
    } catch (error) {
      console.error(
        "GET SITE SUBMISSIONS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to get site submissions",
      });
    }
  };

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  submitSite,
  getSiteSubmissions,
  getMySubmissions,
  getSubmissionById,
};