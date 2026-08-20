const Site = require("../models/Site");

const SiteSubmission = require("../models/SiteSubmission");

const { createHistory } = require("../services/history.service");


// =====================================================
// GET VENDOR PENDING APPROVALS
// =====================================================

const getVendorPendingApprovals = async (req, res) => {
  try {
    console.log("========================================");
    console.log("VENDOR PENDING APPROVAL");
    console.log("========================================");

    console.log("USER ID:", req.user?._id);
    console.log("USER ROLE:", req.user?.role);
    console.log("USER NAME:", req.user?.name);

    // ==========================================
    // ROLE CHECK
    // ==========================================

    if (req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Only vendor can view approvals",
      });
    }

    // ==========================================
    // FIND ALL PENDING VENDOR SUBMISSIONS
    // ==========================================

    const submissions = await SiteSubmission.find({
      status: "pending_vendor_approval",
    })
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
                assigned_vendor_executive
                assigned_state_head
                assigned_client
                `,
      )
      .populate("uploaded_by", "name email role")
      .sort({
        createdAt: -1,
      });

    console.log("TOTAL PENDING:", submissions.length);

    // ==========================================
    // ONLY DENTSU COMMUNICATIONS
    // ==========================================

    const filteredSubmissions = submissions.filter(
      (submission) =>
        submission.site && submission.site.vendor === "DENTSU COMMUNICATIONS",
    );

    console.log("DENTSU PENDING:", filteredSubmissions.length);

    console.log("PENDING DATA:", filteredSubmissions);

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,

      count: filteredSubmissions.length,

      submissions: filteredSubmissions,
    });
  } catch (error) {
    console.error("GET VENDOR PENDING APPROVAL ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to get vendor approvals",
    });
  }
};

// =====================================================
// VENDOR APPROVE
// =====================================================

const vendorApprove = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const remarks =
      typeof req.body?.remarks === "string" ? req.body.remarks.trim() : "";

    console.log("========================================");
    console.log("VENDOR APPROVE");
    console.log("USER:", req.user?._id);
    console.log("ROLE:", req.user?.role);
    console.log("PARAMS:", req.params);
    console.log("BODY:", req.body);
    console.log("SUBMISSION ID:", submissionId);
    console.log("REMARKS:", remarks);
    console.log("========================================");

    // ==========================================
    // ROLE CHECK
    // ==========================================

    if (req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Only vendor can approve",
      });
    }

    // ==========================================
    // SUBMISSION ID CHECK
    // ==========================================

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: "Submission ID is required",
      });
    }

    // ==========================================
    // FIND SUBMISSION
    // ==========================================

    const submission = await SiteSubmission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    // ==========================================
    // FIND SITE
    // ==========================================

    const site = await Site.findById(submission.site);

    if (!site) {
      return res.status(404).json({
        success: false,
        message: "Site not found",
      });
    }

    // ==========================================
    // STATUS CHECK
    // ==========================================

    if (submission.status !== "pending_vendor_approval") {
      return res.status(400).json({
        success: false,
        message: "This submission is not pending vendor approval",
      });
    }

    // ==========================================
    // OLD STATUS
    // ==========================================

    const oldStatus = site.status;

    // ==========================================
    // UPDATE SUBMISSION
    // ==========================================

    submission.status = "pending_state_head_approval";

    submission.remarks = remarks;

    await submission.save();

    // ==========================================
    // UPDATE SITE
    // ==========================================

    site.status = "pending_state_head_approval";

    await site.save();

    // ==========================================
    // HISTORY
    // ==========================================

    await createHistory({
      site,

      submission,

      action: "vendor_approved",

      actionBy: req.user,

      actionByRole: req.user.role,

      remarks: remarks,

      oldStatus,

      newStatus: "pending_state_head_approval",
    });

   
 

    // ==========================================
    // SUCCESS
    // ==========================================

    return res.status(200).json({
      success: true,

      message: "Site approved by vendor",

      status: site.status,
    });
  } catch (error) {
    console.error("VENDOR APPROVE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Vendor approval failed",
    });
  }
};

// =====================================================
// GET VENDOR SITES
// Complete vendor dashboard status
// =====================================================

const getVendorSites = async (req, res) => {
  try {
    // ==========================================
    // ROLE CHECK
    // ==========================================

    if (req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Only vendor can access this data",
      });
    }

    // ==========================================
    // GET SUBMISSIONS
    // ==========================================

    const submissions = await SiteSubmission.find({
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
        `
                site_code
                site_name
                state
                zone
                town
                location
                media_type
                type
                unit
                width
                height
                total_sqr_ft
                lat
                long
                vendor
                status
                assigned_vendor_executive
                assigned_state_head
                assigned_client
                current_submission
                `,
      )
      .populate("uploaded_by", "name email role")
      .sort({
        createdAt: -1,
      });

    // ==========================================
    // ONLY VALID SITES
    // ==========================================

    const validSubmissions = submissions.filter(
      (submission) => submission.site,
    );

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,

      count: validSubmissions.length,

      submissions: validSubmissions,
    });
  } catch (error) {
    console.error("GET VENDOR SITES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to get vendor sites",
    });
  }
};
// =====================================================
// VENDOR REJECT
// =====================================================

const vendorReject = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const remarks =
      typeof req.body?.remarks === "string" ? req.body.remarks.trim() : "";

    console.log("========================================");
    console.log("VENDOR REJECT");
    console.log("USER:", req.user?._id);
    console.log("ROLE:", req.user?.role);
    console.log("PARAMS:", req.params);
    console.log("BODY:", req.body);
    console.log("SUBMISSION ID:", submissionId);
    console.log("REMARKS:", remarks);
    console.log("========================================");

    // ==========================================
    // ROLE
    // ==========================================

    if (req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Only vendor can reject",
      });
    }

    // ==========================================
    // SUBMISSION ID
    // ==========================================

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: "Submission ID is required",
      });
    }

    // ==========================================
    // REMARKS
    // ==========================================

    if (!remarks) {
      return res.status(400).json({
        success: false,
        message: "Remarks are required for rejection",
      });
    }

    // ==========================================
    // FIND SUBMISSION
    // ==========================================

    const submission = await SiteSubmission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    // ==========================================
    // FIND SITE
    // ==========================================

    const site = await Site.findById(submission.site);

    if (!site) {
      return res.status(404).json({
        success: false,
        message: "Site not found",
      });
    }

    // ==========================================
    // STATUS CHECK
    // ==========================================

    if (submission.status !== "pending_vendor_approval") {
      return res.status(400).json({
        success: false,
        message: "This submission is not pending vendor approval",
      });
    }

    // ==========================================
    // OLD STATUS
    // ==========================================

    const oldStatus = site.status;

    // ==========================================
    // UPDATE SUBMISSION
    // ==========================================

    submission.status = "vendor_rejected";

    submission.remarks = remarks;

    await submission.save();

    // ==========================================
    // UPDATE SITE
    // ==========================================

    site.status = "vendor_rejected";

    await site.save();

    // ==========================================
    // HISTORY
    // ==========================================

    await createHistory({
      site,

      submission,

      action: "vendor_rejected",

      actionBy: req.user,

      actionByRole: req.user.role,

      remarks: remarks,

      oldStatus,

      newStatus: "vendor_rejected",
    });

 
    // ==========================================
    // SUCCESS
    // ==========================================

    return res.status(200).json({
      success: true,

      message: "Site rejected by vendor",

      status: site.status,
    });
  } catch (error) {
    console.error("VENDOR REJECT ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Vendor rejection failed",
    });
  }
};

// =====================================================
// STATE HEAD APPROVE
// =====================================================

// =====================================================
// STATE HEAD APPROVE
// =====================================================

const stateHeadApprove = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const remarks =
      typeof req.body?.remarks === "string"
        ? req.body.remarks.trim()
        : "";

    console.log("========================================");
    console.log("STATE HEAD APPROVE");
    console.log("USER:", req.user?._id);
    console.log("ROLE:", req.user?.role);
    console.log("SUBMISSION:", submissionId);
    console.log("========================================");

    // ==========================================
    // ROLE
    // ==========================================

    if (req.user.role !== "state_head") {
      return res.status(403).json({
        success: false,
        message: "Only state head can approve",
      });
    }

    // ==========================================
    // FIND SUBMISSION
    // ==========================================

    const submission =
      await SiteSubmission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    // ==========================================
    // STATUS
    // ==========================================

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

    // ==========================================
    // FIND SITE
    // ==========================================

    const site =
      await Site.findById(submission.site);

    if (!site) {
      return res.status(404).json({
        success: false,
        message: "Site not found",
      });
    }

    // ==========================================
    // CHECK STATE HEAD ACCESS
    // ==========================================

    const stateHeadZone =
      req.user.zone?.trim();

    const stateHeadState =
      req.user.state?.trim();

    const siteCodes =
      Array.isArray(req.user.site_codes)
        ? req.user.site_codes
        : [];

    let allowed = false;

    // ==========================================
    // SITE CODE ACCESS
    // ==========================================

    if (siteCodes.length > 0) {
      allowed = siteCodes.includes(
        site.site_code
      );
    }

    // ==========================================
    // ZONE ACCESS
    // ==========================================

    else {
      allowed =
        site.zone === stateHeadZone &&
        site.state === stateHeadState;
    }

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message:
          "This site is not assigned to you",
      });
    }

    // ==========================================
    // OLD STATUS
    // ==========================================

    const oldStatus = site.status;

    // ==========================================
    // UPDATE SUBMISSION
    // ==========================================

    submission.status = "approved";
    submission.remarks = remarks;

    await submission.save();

    // ==========================================
    // UPDATE SITE
    // ==========================================

    site.status = "approved";

    await site.save();

    // ==========================================
    // HISTORY
    // ==========================================

    await createHistory({
      site,
      submission,

      action: "state_head_approved",

      actionBy: req.user,

      actionByRole: req.user.role,

      remarks,

      oldStatus,

      newStatus: "approved",
    });


    return res.status(200).json({
      success: true,

      message:
        "Site approved by state head",

      status: site.status,
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

// =====================================================
// STATE HEAD REJECT
// =====================================================

const stateHeadReject = async (req, res) => {
  try {
    // ==========================================
    // PARAMS
    // ==========================================

    const { submissionId } = req.params;

    // ==========================================
    // BODY
    // ==========================================

    const remarks =
      typeof req.body?.remarks === "string"
        ? req.body.remarks.trim()
        : "";

    console.log("========================================");
    console.log("STATE HEAD REJECT");
    console.log("USER:", req.user?._id);
    console.log("ROLE:", req.user?.role);
    console.log("PARAMS:", req.params);
    console.log("BODY:", req.body);
    console.log("SUBMISSION ID:", submissionId);
    console.log("REMARKS:", remarks);
    console.log("========================================");

    // ==========================================
    // ROLE CHECK
    // ==========================================

    if (!req.user || req.user.role !== "state_head") {
      return res.status(403).json({
        success: false,
        message: "Only state head can reject",
      });
    }

    // ==========================================
    // SUBMISSION ID CHECK
    // ==========================================

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: "Submission ID is required",
      });
    }

    // ==========================================
    // REMARKS CHECK
    // ==========================================

    if (!remarks) {
      return res.status(400).json({
        success: false,
        message: "Remarks are required for rejection",
      });
    }

    // ==========================================
    // FIND SUBMISSION
    // ==========================================

    const submission =
      await SiteSubmission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    // ==========================================
    // STATUS CHECK
    // ==========================================

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

    // ==========================================
    // FIND SITE
    // ==========================================

    const site =
      await Site.findById(submission.site);

    if (!site) {
      return res.status(404).json({
        success: false,
        message: "Site not found",
      });
    }

    // ==========================================
    // STATE HEAD ACCESS
    // ==========================================

    const stateHeadZone =
      req.user.zone?.trim();

    const stateHeadState =
      req.user.state?.trim();

    const siteCodes =
      Array.isArray(req.user.site_codes)
        ? req.user.site_codes
            .map((code) => code?.trim())
            .filter(Boolean)
        : [];

    let allowed = false;

    // ==========================================
    // SITE CODE ACCESS
    // ==========================================

    if (siteCodes.length > 0) {
      allowed = siteCodes.includes(
        site.site_code
      );
    }

    // ==========================================
    // ZONE + STATE ACCESS
    // ==========================================

    else {
      allowed =
        site.zone === stateHeadZone &&
        site.state === stateHeadState;
    }

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "This site is not assigned to you",
      });
    }

    // ==========================================
    // OLD STATUS
    // ==========================================

    const oldStatus = site.status;

    // ==========================================
    // UPDATE SUBMISSION
    // ==========================================

    submission.status =
      "state_head_rejected";

    submission.remarks =
      remarks;

    await submission.save();

    // ==========================================
    // UPDATE SITE
    // ==========================================

    site.status =
      "state_head_rejected";

    await site.save();

    // ==========================================
    // HISTORY
    // ==========================================

    await createHistory({
      site,

      submission,

      action: "state_head_rejected",

      actionBy: req.user,

      actionByRole: req.user.role,

      remarks,

      oldStatus,

      newStatus: "state_head_rejected",
    });


    try {
      const recipients = [];

      if (site.assigned_vendor_executive) {
        recipients.push(
          site.assigned_vendor_executive
        );
      }

  
    } catch (err) {
      console.error(
        "STATE HEAD REJECTION NOTIFICATION ERROR:",
        err
      );

      // Don't fail rejection because notification failed
    }

    // ==========================================
    // SUCCESS
    // ==========================================

    return res.status(200).json({
      success: true,

      message:
        "Site rejected by state head",

      status:
        site.status,

      submission_id:
        submission._id,
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
// GET PENDING APPROVALS
// =====================================================

// =====================================================
// GET PENDING APPROVALS
// VENDOR / STATE HEAD / ADMIN
// =====================================================

const getPendingApprovals = async (req, res) => {
  try {
    console.log("========================================");
    console.log("GET PENDING APPROVALS");
    console.log("USER ID:", req.user?._id);
    console.log("USER ROLE:", req.user?.role);
    console.log("USER NAME:", req.user?.name);
    console.log("USER ZONE:", req.user?.zone);
    console.log("USER STATE:", req.user?.state);
    console.log("USER SITE CODES:", req.user?.site_codes);
    console.log("========================================");

    // =====================================================
    // VENDOR
    // =====================================================

    if (req.user.role === "vendor") {
      const submissions = await SiteSubmission.find({
        status: "pending_vendor_approval",
      })
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
            assigned_vendor_executive
            assigned_state_head
            assigned_client
          `
        )
        .populate("uploaded_by", "name email role")
        .sort({
          createdAt: -1,
        });

      // Only DENTSU
      const filtered = submissions.filter(
        (submission) =>
          submission.site &&
          submission.site.vendor === "DENTSU COMMUNICATIONS"
      );

      return res.status(200).json({
        success: true,
        count: filtered.length,
        submissions: filtered,
      });
    }

    // =====================================================
    // STATE HEAD
    // =====================================================

    if (req.user.role === "state_head") {
      // ---------------------------------------------
      // USER DETAILS
      // ---------------------------------------------

      const stateHeadId = req.user._id;

      const stateHeadZone = req.user.zone?.trim();

      const stateHeadState = req.user.state?.trim();

      const siteCodes = Array.isArray(req.user.site_codes)
        ? req.user.site_codes
            .map((code) => code?.trim())
            .filter(Boolean)
        : [];

      console.log("STATE HEAD ID:", stateHeadId);
      console.log("STATE HEAD ZONE:", stateHeadZone);
      console.log("STATE HEAD STATE:", stateHeadState);
      console.log("STATE HEAD SITE CODES:", siteCodes);

      // ---------------------------------------------
      // SITE FILTER
      // ---------------------------------------------

      const siteFilter = {};

      // =============================================
      // IMPORTANT:
      //
      // Agar site_codes available hain:
      // sirf wahi site codes
      //
      // Agar site_codes empty hain:
      // zone ke according sites
      // =============================================

      if (siteCodes.length > 0) {
        siteFilter.site_code = {
          $in: siteCodes,
        };
      } else if (stateHeadZone) {
        siteFilter.zone = stateHeadZone;
      }

      // Optional state filter
      if (stateHeadState) {
        siteFilter.state = stateHeadState;
      }

      console.log("STATE HEAD SITE FILTER:", siteFilter);

      // ---------------------------------------------
      // GET SITES
      // ---------------------------------------------

      const sites = await Site.find(siteFilter).select("_id");

      const siteIds = sites.map((site) => site._id);

      console.log("MATCHING SITE IDS:", siteIds.length);

      // ---------------------------------------------
      // GET PENDING SUBMISSIONS
      // ---------------------------------------------

      const submissions = await SiteSubmission.find({
        site: {
          $in: siteIds,
        },

        status: "pending_state_head_approval",
      })
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
            assigned_vendor_executive
            assigned_state_head
            assigned_client
          `
        )
        .populate("uploaded_by", "name email role")
        .sort({
          createdAt: -1,
        });

      console.log(
        "STATE HEAD PENDING COUNT:",
        submissions.length
      );

      return res.status(200).json({
        success: true,
        count: submissions.length,
        submissions,
      });
    }

    // =====================================================
    // ADMIN
    // =====================================================

    if (req.user.role === "admin") {
      const submissions = await SiteSubmission.find({
        status: {
          $in: [
            "pending_vendor_approval",
            "pending_state_head_approval",
          ],
        },
      })
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
            assigned_state_head
          `
        )
        .populate("uploaded_by", "name email role")
        .sort({
          createdAt: -1,
        });

      return res.status(200).json({
        success: true,
        count: submissions.length,
        submissions,
      });
    }

    // =====================================================
    // INVALID ROLE
    // =====================================================

    return res.status(403).json({
      success: false,
      message: "You are not allowed to view approvals",
    });
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
// GET VENDOR SITE STATUS
// Latest submission of every site only
// =====================================================

const getVendorApprovalStatus = async (req, res) => {
  try {
    // ==========================================
    // ROLE CHECK
    // ==========================================

    if (!req.user || req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Only vendor can access this data",
      });
    }

    // ==========================================
    // GET VENDOR SITES
    // ==========================================

    const sites = await Site.find({
      vendor: "DENTSU COMMUNICATIONS",
    })
      .populate({
        path: "current_submission",
        populate: {
          path: "uploaded_by",
          select: "name email role",
        },
      })
      .sort({
        updatedAt: -1,
      });

    // ==========================================
    // ONLY SITES HAVING UPLOADED IMAGES
    // ==========================================

    const result = sites
      .filter((site) => site.current_submission)
      .map((site) => {
        const submission = site.current_submission;

        return {
          _id: submission._id,

          site: {
            _id: site._id,
            site_name: site.site_name,
            site_code: site.site_code,
            state: site.state,
            town: site.town,
            zone: site.zone,
            location: site.location,
            media_type: site.media_type,
            type: site.type,
            unit: site.unit,
            width: site.width,
            height: site.height,
            total_sqr_ft: site.total_sqr_ft,
            lat: site.lat,
            long: site.long,
            vendor: site.vendor,
          },

          submission: {
            _id: submission._id,

            status: submission.status,

            remarks: submission.remarks || "",

            selfie: submission.selfie,

            site_images: submission.site_images,

            person_name: submission.person_name,

            uploaded_by: submission.uploaded_by,

            uploaded_at: submission.uploaded_at,

            createdAt: submission.createdAt,

            updatedAt: submission.updatedAt,
          },
        };
      });

    // ==========================================
    // VENDOR DASHBOARD STATUS
    // ==========================================

    const finalResult = result.map((item) => {
      const status = item.submission.status;

      let vendor_status = "pending";

      // Vendor approved
      if (
        status === "pending_state_head_approval" ||
        status === "approved"
      ) {
        vendor_status = "approved";
      }

      // Vendor pending
      if (status === "pending_vendor_approval") {
        vendor_status = "pending";
      }

      // Rejected
      if (
        status === "vendor_rejected" ||
        status === "state_head_rejected"
      ) {
        vendor_status = "rejected";
      }

      return {
        ...item,
        vendor_status,
      };
    });

    // ==========================================
    // COUNTS
    // ==========================================

    const counts = {
      all: finalResult.length,

      approved: finalResult.filter(
        (item) => item.vendor_status === "approved"
      ).length,

      pending: finalResult.filter(
        (item) => item.vendor_status === "pending"
      ).length,

      rejected: finalResult.filter(
        (item) => item.vendor_status === "rejected"
      ).length,
    };

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,

      counts,

      count: finalResult.length,

      submissions: finalResult,
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



const getStateHeadSiteStatus = async (req, res) => {
  try {
    // ==========================================
    // ROLE CHECK
    // ==========================================

    if (!req.user || req.user.role !== "state_head") {
      return res.status(403).json({
        success: false,
        message: "Only State Head can access this data",
      });
    }

    // ==========================================
    // STATE
    // ==========================================

    const stateHeadState = req.user.state?.trim();

    if (!stateHeadState) {
      return res.status(400).json({
        success: false,
        message: "State is not assigned to this State Head",
      });
    }

    // ==========================================
    // ZONE
    // ==========================================

    const stateHeadZone = req.user.zone?.trim();

    // ==========================================
    // SITE CODES
    // ==========================================

    const siteCodes = Array.isArray(req.user.site_codes)
      ? req.user.site_codes
          .map((code) => code?.trim())
          .filter(Boolean)
      : [];

    console.log("=================================");
    console.log("STATE HEAD:", req.user.name);
    console.log("STATE:", stateHeadState);
    console.log("ZONE:", stateHeadZone);
    console.log("SITE CODES:", siteCodes);
    console.log("=================================");

    // ==========================================
    // SITE FILTER
    // ==========================================

    const siteFilter = {
      state: stateHeadState,
      vendor: "DENTSU COMMUNICATIONS",
    };

    // Zone
    if (stateHeadZone) {
      siteFilter.zone = stateHeadZone;
    }

    // Site codes
    if (siteCodes.length > 0) {
      siteFilter.site_code = {
        $in: siteCodes,
      };
    }

    console.log("SITE FILTER:", siteFilter);

    // ==========================================
    // GET SITES
    // ==========================================

    const sites = await Site.find(siteFilter)
      .populate({
        path: "current_submission",
        populate: {
          path: "uploaded_by",
          select: "name email role",
        },
      })
      .sort({
        updatedAt: -1,
      });

    console.log("TOTAL MATCHING SITES:", sites.length);

    // ==========================================
    // ONLY SITES WITH SUBMISSION
    // ==========================================

    const result = sites
      .filter((site) => {
        const submission = site.current_submission;

        if (!submission) {
          return false;
        }

        // ======================================
        // ONLY STATE HEAD RELATED SUBMISSIONS
        // ======================================

        return [
          "pending_state_head_approval",
          "approved",
          "state_head_rejected",
        ].includes(submission.status);
      })
      .map((site) => {
        const submission = site.current_submission;

        let state_head_status = null;

        if (
          submission.status ===
          "pending_state_head_approval"
        ) {
          state_head_status = "pending";
        }

        if (submission.status === "approved") {
          state_head_status = "approved";
        }

        if (
          submission.status ===
          "state_head_rejected"
        ) {
          state_head_status = "rejected";
        }

        return {
          _id: submission._id,

          state_head_status,

          site: {
            _id: site._id,

            site_name: site.site_name,

            site_code: site.site_code,

            state: site.state,

            town: site.town,

            zone: site.zone,

            location: site.location,

            media_type: site.media_type,

            type: site.type,

            unit: site.unit,

            width: site.width,

            height: site.height,

            total_sqr_ft: site.total_sqr_ft,

            lat: site.lat,

            long: site.long,

            vendor: site.vendor,
          },

          submission: {
            _id: submission._id,

            status: submission.status,

            remarks: submission.remarks || "",

            selfie: submission.selfie,

            site_images: submission.site_images,

            person_name: submission.person_name,

            uploaded_by: submission.uploaded_by,

            uploaded_at: submission.uploaded_at,

            createdAt: submission.createdAt,

            updatedAt: submission.updatedAt,
          },
        };
      });

    // ==========================================
    // COUNTS
    // ==========================================

    const counts = {
      all: result.length,

      pending: result.filter(
        (item) =>
          item.state_head_status === "pending"
      ).length,

      approved: result.filter(
        (item) =>
          item.state_head_status === "approved"
      ).length,

      rejected: result.filter(
        (item) =>
          item.state_head_status === "rejected"
      ).length,
    };

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,

      state_head: {
        id: req.user._id,
        name: req.user.name,
        state: stateHeadState,
        zone: stateHeadZone,
        site_codes: siteCodes,
      },

      counts,

      count: result.length,

      submissions: result,
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




const getClientDashboard = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "client") {
      return res.status(403).json({
        success: false,
        message: "Only client can access this data",
      });
    }

    // ==========================================
    // CLIENT KE ASSIGNED SITES
    // ==========================================

    const sites = await Site.find({
      assigned_client: req.user._id,
    })
      .populate({
        path: "current_submission",
        populate: {
          path: "uploaded_by",
          select: "name email role",
        },
      })
      .sort({
        updatedAt: -1,
      });

    // ==========================================
    // SITE DATA
    // ==========================================

    const siteDetails = sites.map((site) => {
      const submission = site.current_submission;

      let vendor_status = "pending";
      let state_head_status = "pending";
      let image_uploaded = false;

      if (submission) {
        // Image uploaded
        image_uploaded =
          Array.isArray(submission.site_images) &&
          submission.site_images.length > 0;

        // ======================================
        // VENDOR STATUS
        // ======================================

        if (
          submission.status === "pending_vendor_approval"
        ) {
          vendor_status = "pending";
        }

        if (
          submission.status === "vendor_rejected"
        ) {
          vendor_status = "rejected";
        }

        if (
          submission.status === "pending_state_head_approval" ||
          submission.status === "approved" ||
          submission.status === "state_head_rejected"
        ) {
          vendor_status = "approved";
        }

        // ======================================
        // STATE HEAD STATUS
        // ======================================

        if (
          submission.status === "pending_state_head_approval"
        ) {
          state_head_status = "pending";
        }

        if (
          submission.status === "state_head_rejected"
        ) {
          state_head_status = "rejected";
        }

        if (
          submission.status === "approved"
        ) {
          state_head_status = "approved";
        }

        // Vendor rejected means State Head has not
        // received it yet
        if (
          submission.status === "vendor_rejected" ||
          submission.status === "pending_vendor_approval"
        ) {
          state_head_status = "pending";
        }
      }

      return {
        site_id: site._id,

        site_code: site.site_code,

        site_name: site.site_name,

        state: site.state,

        zone: site.zone,

        town: site.town,

        vendor: site.vendor,

        image_uploaded,

        vendor_status,

        state_head_status,

        submission_status:
          submission?.status || "not_uploaded",

        submission_id:
          submission?._id || null,

        remarks:
          submission?.remarks || "",

        uploaded_by:
          submission?.uploaded_by || null,

        updatedAt:
          submission?.updatedAt || site.updatedAt,
      };
    });

    // ==========================================
    // COUNTS
    // ==========================================

    const counts = {
      total_sites: siteDetails.length,

      image_uploaded: siteDetails.filter(
        (site) => site.image_uploaded
      ).length,

      image_not_uploaded: siteDetails.filter(
        (site) => !site.image_uploaded
      ).length,

      vendor: {
        pending: siteDetails.filter(
          (site) =>
            site.vendor_status === "pending"
        ).length,

        approved: siteDetails.filter(
          (site) =>
            site.vendor_status === "approved"
        ).length,

        rejected: siteDetails.filter(
          (site) =>
            site.vendor_status === "rejected"
        ).length,
      },

      state_head: {
        pending: siteDetails.filter(
          (site) =>
            site.state_head_status === "pending"
        ).length,

        approved: siteDetails.filter(
          (site) =>
            site.state_head_status === "approved"
        ).length,

        rejected: siteDetails.filter(
          (site) =>
            site.state_head_status === "rejected"
        ).length,
      },
    };

    return res.status(200).json({
      success: true,
      counts,
      sites: siteDetails,
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
// ROLE BASED DASHBOARD
// vendor / state_head / client
// =====================================================

const getDashboardStats = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const role = req.user.role;

    console.log("=================================");
    console.log("DASHBOARD");
    console.log("ROLE:", role);
    console.log("USER:", req.user.name);
    console.log("=================================");

    // =====================================================
    // BASE SITE FILTER
    // =====================================================

    let siteFilter = {};

    // =====================================================
    // VENDOR
    // =====================================================

    if (role === "vendor") {
      siteFilter.vendor = "DENTSU COMMUNICATIONS";
    }

    // =====================================================
    // STATE HEAD
    // =====================================================

    if (role === "state_head") {
      const state = req.user.state?.trim();
      const zone = req.user.zone?.trim();

      const siteCodes = Array.isArray(req.user.site_codes)
        ? req.user.site_codes
            .map((code) => code?.trim())
            .filter(Boolean)
        : [];

      if (!state) {
        return res.status(400).json({
          success: false,
          message: "State is not assigned to State Head",
        });
      }

      siteFilter.state = state;

      if (zone) {
        siteFilter.zone = zone;
      }

      if (siteCodes.length > 0) {
        siteFilter.site_code = {
          $in: siteCodes,
        };
      }
    }

    // =====================================================
    // CLIENT
    // =====================================================

    if (role === "client") {
      // IMPORTANT:
      // Client ko koi state / zone restriction nahi
      siteFilter = {};
    }

    // =====================================================
    // INVALID ROLE
    // =====================================================

    if (!["vendor", "state_head", "client"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role",
      });
    }

    console.log("SITE FILTER:", siteFilter);

    // =====================================================
    // GET SITES
    // =====================================================

    const sites = await Site.find(siteFilter)
      .populate({
        path: "current_submission",
        populate: {
          path: "uploaded_by",
          select: "name email role",
        },
      })
      .sort({
        updatedAt: -1,
      });

    // =====================================================
    // INITIAL COUNTS
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
    // LOOP SITES
    // =====================================================

    sites.forEach((site) => {
      const submission = site.current_submission;

      let imageUploaded = false;

      let vendorStatus = "pending";
      let stateHeadStatus = "pending";

      // ===================================================
      // IMAGE CHECK
      // ===================================================

      if (submission) {
        const hasImages =
          Array.isArray(submission.site_images) &&
          submission.site_images.length > 0;

        const hasSelfie = !!submission.selfie;

        if (hasImages || hasSelfie) {
          imageUploaded = true;
          counts.imageUploaded++;
        } else {
          counts.imagePending++;
        }
      } else {
        counts.imagePending++;
      }

      // ===================================================
      // VENDOR STATUS
      // ===================================================

      if (submission) {
        switch (submission.status) {
          case "pending_vendor_approval":
            vendorStatus = "pending";
            counts.vendorPending++;
            break;

          case "pending_state_head_approval":
          case "approved":
          case "state_head_rejected":
            vendorStatus = "approved";
            counts.vendorApproved++;
            break;

          case "vendor_rejected":
            vendorStatus = "rejected";
            counts.vendorRejected++;
            break;
        }
      } else {
        counts.vendorPending++;
      }

      // ===================================================
      // STATE HEAD STATUS
      // ===================================================

      if (submission) {
        switch (submission.status) {
          case "pending_vendor_approval":
            stateHeadStatus = "pending";
            break;

          case "pending_state_head_approval":
            stateHeadStatus = "pending";
            counts.stateHeadPending++;
            break;

          case "approved":
            stateHeadStatus = "approved";
            counts.stateHeadApproved++;
            break;

          case "state_head_rejected":
            stateHeadStatus = "rejected";
            counts.stateHeadRejected++;
            break;

          case "vendor_rejected":
            stateHeadStatus = "pending";
            break;
        }
      } else {
        stateHeadStatus = "pending";
      }

      // ===================================================
      // SITE DETAILS
      // ===================================================

      siteDetails.push({
        _id: site._id,

        site_name: site.site_name,
        site_code: site.site_code,

        state: site.state,
        zone: site.zone,
        town: site.town,

        vendor: site.vendor,

        status: site.status,

        imageUploaded,

        imageCount:
          submission?.site_images?.length || 0,

        vendorStatus,

        stateHeadStatus,

        submissionId:
          submission?._id || null,

        uploadedBy:
          submission?.uploaded_by || null,

        remarks:
          submission?.remarks || "",

        updatedAt:
          submission?.updatedAt ||
          site.updatedAt,
      });
    });

    // =====================================================
    // CHART DATA
    // =====================================================

    const chartData = {
      vendor: {
        pending: counts.vendorPending,
        approved: counts.vendorApproved,
        rejected: counts.vendorRejected,
      },

      stateHead: {
        pending: counts.stateHeadPending,
        approved: counts.stateHeadApproved,
        rejected: counts.stateHeadRejected,
      },

      images: {
        uploaded: counts.imageUploaded,
        pending: counts.imagePending,
      },
    };

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,

      role,

      user: {
        id: req.user._id,
        name: req.user.name,
        role: req.user.role,
      },

      counts,

      chartData,

      sites: siteDetails,
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





module.exports = {
  getVendorPendingApprovals,
  getVendorSites,
  getPendingApprovals,
  getVendorApprovalStatus,
  getStateHeadSiteStatus,
  vendorApprove,
  vendorReject,
getClientDashboard,
  stateHeadApprove,
  getDashboardStats,
  stateHeadReject,
};
