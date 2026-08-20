const mongoose = require("mongoose");

const Site = require("../models/Site");
const SiteSubmission = require("../models/SiteSubmission");

const { createHistory } = require("../services/history.service");


// ======================================================
// HELPER: AUTH USER
// ======================================================

const getUserId = (req) => {
  return req?.user?._id || req?.user?.id || null;
};


// ======================================================
// HELPER: NORMALIZE UPLOAD PATH
// ======================================================
//
// Windows:
// E:\site-management-system\backend\uploads\abc.jpg
//
// Database me save hoga:
// uploads/abc.jpg
//
// Frontend:
// http://localhost:5000/uploads/abc.jpg
// ======================================================

const normalizeUploadPath = (filePath) => {

  if (!filePath) {
    return "";
  }

  let normalized = String(filePath)
    .replace(/\\/g, "/");

  // uploads ke pehle ka complete path remove karo
  const uploadsIndex = normalized.lastIndexOf("/uploads/");

  if (uploadsIndex !== -1) {
    return normalized.substring(
      uploadsIndex + 1
    );
  }

  // Agar path already uploads/ se start ho
  if (normalized.startsWith("uploads/")) {
    return normalized;
  }

  // Agar sirf filename ho
  const filename = normalized.split("/").pop();

  return `uploads/${filename}`;
};


// ======================================================
// GET MY SUBMISSIONS
// ======================================================

const getMySubmissions = async (req, res) => {

  try {

    // ========================================
    // AUTH CHECK
    // ========================================

    const userId = getUserId(req);

    console.log(
      "GET MY SUBMISSIONS USER:",
      req.user
    );

    console.log(
      "GET MY SUBMISSIONS USER ID:",
      userId
    );

    if (!userId) {

      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });

    }


    // ========================================
    // GET SUBMISSIONS
    // ========================================

    const submissions =
      await SiteSubmission.find({
        uploaded_by: userId,
      })

        // ========================================
        // SITE
        // ========================================

        .populate({
          path: "site",

          select: `
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
            history
          `,

          populate: {

            path: "current_submission",

            populate: [
              {
                path: "submitted_by",
                select: "name email role",
              },

              {
                path: "uploaded_by",
                select: "name email role",
              },
            ],
          },
        })

        // ========================================
        // SUBMITTED BY
        // ========================================

        .populate(
          "submitted_by",
          "name email role"
        )

        // ========================================
        // UPLOADED BY
        // ========================================

        .populate(
          "uploaded_by",
          "name email role"
        )

        .sort({
          createdAt: -1,
        });


    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({

      success: true,

      count:
        submissions.length,

      submissions,

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


// ======================================================
// GET SUBMISSION BY ID
// ======================================================

const getSubmissionById = async (req, res) => {

  try {

    const { id } = req.params;


    // ========================================
    // ID VALIDATION
    // ========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {

      return res.status(400).json({

        success: false,

        message: "Invalid submission ID",

      });

    }


    console.log(
      "GET SUBMISSION ID:",
      id
    );


    // ========================================
    // FIND SUBMISSION
    // ========================================

    const submission =
      await SiteSubmission.findById(id)

        // ========================================
        // SITE
        // ========================================

        .populate({
          path: "site",

          select: `
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
            history
          `,

          populate: {

            path: "current_submission",

            populate: [
              {
                path: "submitted_by",
                select: "name email role",
              },

              {
                path: "uploaded_by",
                select: "name email role",
              },
            ],
          },
        })

        // ========================================
        // SUBMITTED BY
        // ========================================

        .populate(
          "submitted_by",
          "name email role"
        )

        // ========================================
        // UPLOADED BY
        // ========================================

        .populate(
          "uploaded_by",
          "name email role"
        );


    // ========================================
    // NOT FOUND
    // ========================================

    if (!submission) {

      return res.status(404).json({

        success: false,

        message:
          "Submission not found",

      });

    }


    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({

      success: true,

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


// ======================================================
// SUBMIT / RE-UPLOAD SITE
// ======================================================

const submitSite = async (req, res) => {

  try {

    // ========================================
    // AUTH USER
    // ========================================

    const userId =
      getUserId(req);


    console.log(
      "===================================="
    );

    console.log(
      "SUBMIT SITE USER:",
      req.user
    );

    console.log(
      "SUBMIT SITE USER ID:",
      userId
    );

    console.log(
      "SUBMIT SITE USER ROLE:",
      req.user?.role
    );

    console.log(
      "===================================="
    );


    // ========================================
    // AUTH CHECK
    // ========================================

    if (!userId) {

      return res.status(401).json({

        success: false,

        message:
          "User authentication failed. User ID not found.",

      });

    }


    // ========================================
    // ROLE CHECK
    // ========================================

    const allowedRoles = [
      "vendor_executive",
      "admin",
    ];

    if (
      req.user?.role &&
      !allowedRoles.includes(
        req.user.role
      )
    ) {

      return res.status(403).json({

        success: false,

        message:
          "You are not allowed to submit a site.",

      });

    }


    // ========================================
    // REQUEST BODY
    // ========================================

    const {
      site_id,
      person_name,
    } = req.body;


    // ========================================
    // VALIDATE SITE ID
    // ========================================

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


    // ========================================
    // VALIDATE PERSON NAME
    // ========================================

    if (!person_name?.trim()) {

      return res.status(400).json({

        success: false,

        message:
          "person_name is required",

      });

    }


    // ========================================
    // FIND SITE
    // ========================================

    const site =
      await Site.findById(site_id);


    if (!site) {

      return res.status(404).json({

        success: false,

        message:
          "Site not found",

      });

    }


    // ========================================
    // SAVE OLD STATUS
    // ========================================

    const oldStatus =
      site.status;


    // ========================================
    // FILES
    // ========================================

    const selfie =
      req.files?.selfie?.[0];

    const siteImages =
      req.files?.site_images || [];


    // ========================================
    // SELFIE VALIDATION
    // ========================================

    if (!selfie) {

      return res.status(400).json({

        success: false,

        message:
          "Selfie is required",

      });

    }


    // ========================================
    // SITE IMAGE VALIDATION
    // ========================================

    if (
      !siteImages.length
    ) {

      return res.status(400).json({

        success: false,

        message:
          "At least one site image is required",

      });

    }


    // ========================================
    // SELFIE PATH
    // ========================================

    if (!selfie.path) {

      return res.status(400).json({

        success: false,

        message:
          "Selfie file path not found",

      });

    }


    const selfiePath =
      normalizeUploadPath(
        selfie.path
      );


    // ========================================
    // SITE IMAGE PATHS
    // ========================================

    const imagePaths =
      siteImages.map(
        (file) => {

          if (!file.path) {

            throw new Error(
              "Site image file path not found"
            );

          }

          return normalizeUploadPath(
            file.path
          );

        }
      );


    console.log(
      "SELFIE PATH:",
      selfiePath
    );

    console.log(
      "SITE IMAGE PATHS:",
      imagePaths
    );


    // ========================================
    // CREATE SUBMISSION
    // ========================================

    const submission =
      await SiteSubmission.create({

        site:
          site._id,

        // IMPORTANT
        submitted_by:
          userId,

        uploaded_by:
          userId,

        uploader_role:
          req.user.role,

        person_name:
          person_name.trim(),

        selfie:
          selfiePath,

        site_images:
          imagePaths,

        uploaded_at:
          new Date(),

        status:
          "pending_vendor_approval",

      });


    console.log(
      "SUBMISSION CREATED:",
      submission._id
    );


    // ========================================
    // UPDATE SITE
    // ========================================

    site.status =
      "pending_vendor_approval";

    site.current_submission =
      submission._id;


    // ========================================
    // CREATE HISTORY
    // ========================================

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

        remarks:

          oldStatus ===
          "vendor_rejected"

            ? "Site re-uploaded after vendor rejection"

            : oldStatus ===
              "state_head_rejected"

              ? "Site re-uploaded after state head rejection"

              : "Site submitted by vendor executive",

        oldStatus,

        newStatus:
          "pending_vendor_approval",

      });


    // ========================================
    // SUCCESS
    // ========================================

    return res.status(201).json({

      success: true,

      message:

        oldStatus ===
          "vendor_rejected" ||

        oldStatus ===
          "state_head_rejected"

          ? "Site re-uploaded successfully"

          : "Site submitted successfully",

      submission,

      history,

    });

  } catch (error) {

    console.error(
      "===================================="
    );

    console.error(
      "SUBMIT SITE ERROR:"
    );

    console.error(
      error
    );

    console.error(
      "===================================="
    );


    // ========================================
    // MONGOOSE VALIDATION ERROR
    // ========================================

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


    // ========================================
    // GENERAL ERROR
    // ========================================

    return res.status(500).json({

      success: false,

      message:
        error.message ||
        "Failed to submit site",

    });

  }

};


// ======================================================
// GET ALL SUBMISSIONS OF A PARTICULAR SITE
// ======================================================

const getSiteSubmissions = async (
  req,
  res
) => {

  try {

    const { siteId } =
      req.params;


    // ========================================
    // VALIDATE SITE ID
    // ========================================

    if (!siteId) {

      return res.status(400).json({

        success: false,

        message:
          "siteId is required",

      });

    }


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


    // ========================================
    // GET SUBMISSIONS
    // ========================================

    const submissions =
      await SiteSubmission.find({

        site:
          siteId,

      })

        // ========================================
        // SUBMITTED BY
        // ========================================

        .populate(
          "submitted_by",
          "name email role"
        )

        // ========================================
        // UPLOADED BY
        // ========================================

        .populate(
          "uploaded_by",
          "name email role"
        )

        .populate(
          "site",
          `
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
          `
        )

        .sort({
          createdAt: -1,
        });


    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({

      success: true,

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


// ======================================================
// EXPORT
// ======================================================

module.exports = {

  submitSite,

  getSiteSubmissions,

  getMySubmissions,

  getSubmissionById,

};