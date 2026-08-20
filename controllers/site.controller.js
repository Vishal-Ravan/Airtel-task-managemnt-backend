const Site = require("../models/Site");
const SiteSubmission = require("../models/SiteSubmission");

// ========================================
// CREATE SITE
// ========================================

const createSite = async (req, res) => {
  try {
    const {
      site_code,
      state,
      zone,
      media_type,
      duration,
      location,
      type,
      unit,
      width,
      height,
      total_sqr_ft,
      lat,
      long,
      vendor,
      availability,
      start_date,
      end_date,
    } = req.body;

    // -------------------------------
    // REQUIRED FIELDS
    // -------------------------------

    if (!site_code || !state || !zone) {
      return res.status(400).json({
        success: false,

        message: "site_code, state and zone are required",
      });
    }

    // -------------------------------
    // CHECK DUPLICATE SITE CODE
    // -------------------------------

    const existingSite = await Site.findOne({
      site_code,
    });

    if (existingSite) {
      return res.status(409).json({
        success: false,

        message: "Site code already exists",
      });
    }

    // -------------------------------
    // CREATE SITE
    // -------------------------------

    const site = await Site.create({
      site_code,

      state,

      zone,

      media_type,

      duration,

      location,

      type,

      unit,

      width,

      height,

      total_sqr_ft,

      lat,

      long,

      vendor,

      availability,

      start_date,

      end_date,

      status: "pending_submission",
    });

    await createHistory({
      site,
      action: "site_created",
      actionBy: req.user,
      actionByRole: req.user.role,
      remarks: "Site created",
      oldStatus: null,
      newStatus: "pending_upload",
    });
    return res.status(201).json({
      success: true,

      message: "Site created successfully",

      site,
    });
  } catch (error) {
    console.error("CREATE SITE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to create site",
    });
  }
};

// ========================================
// GET MY SITES
// ========================================

const getMySites = async (req, res) => {
  try {
    const user = req.user;

    const filter = {};

    // --------------------------------
    // VENDOR EXECUTIVE
    // --------------------------------

    if (user.role === "vendor_executive") {
      const conditions = [];

      // Site code restriction

      if (user.site_code) {
        const siteCodes = Array.isArray(user.site_code)
          ? user.site_code
          : [user.site_code];

        conditions.push({
          site_code: {
            $in: siteCodes,
          },
        });
      }

      // Zone restriction

      if (user.zone) {
        conditions.push({
          zone: user.zone,
        });
      }

      // State restriction

      if (user.state) {
        conditions.push({
          state: user.state,
        });
      }

      if (conditions.length) {
        filter.$and = conditions;
      }
    }

    // --------------------------------
    // VENDOR
    // --------------------------------
    else if (user.role === "vendor") {
      if (user.site_code) {
        const siteCodes = Array.isArray(user.site_code)
          ? user.site_code
          : [user.site_code];

        filter.site_code = {
          $in: siteCodes,
        };
      }

      if (user.zone) {
        filter.zone = user.zone;
      }

      if (user.state) {
        filter.state = user.state;
      }
    }

    // --------------------------------
    // STATE HEAD
    // --------------------------------
    else if (user.role === "state_head") {
      if (user.state) {
        filter.state = user.state;
      }
    }

    // --------------------------------
    // CLIENT
    // --------------------------------
    else if (user.role === "client") {
      // Client should only see
      // approved sites

      filter.status = "approved";
    }

    // --------------------------------
    // ADMIN
    // --------------------------------

    // Admin sees everything.
    // No filter required.

    const sites = await Site.find(filter).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,

      count: sites.length,

      sites,
    });
  } catch (error) {
    console.error("GET MY SITES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// ========================================
// GET SITE BY ID
// ========================================


const getSiteById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Site id is required",
      });
    }

    const site = await Site.findById(id)
      .populate({
        path: "vendor",
        select: "name email role",
      })
      .populate({
        path: "current_submission",
        select: `
          _id
          site
          submitted_by
          uploaded_by
          uploader_role
          person_name
          selfie
          site_images
          status
          createdAt
          updatedAt
        `,
        populate: [
          {
            path: "uploaded_by",
            select: "name email role",
          },
          {
            path: "submitted_by",
            select: "name email role",
          },
        ],
      })
      .lean();

    if (!site) {
      return res.status(404).json({
        success: false,
        message: "Site not found",
      });
    }

    return res.status(200).json({
      success: true,
      site,
    });
  } catch (error) {
    console.error("GET SITE BY ID ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to get site",
    });
  }
};

// ========================================
// UPDATE SITE
// ========================================

const updateSite = async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);

    if (!site) {
      return res.status(404).json({
        success: false,

        message: "Site not found",
      });
    }

    const allowedFields = [
      "site_code",

      "state",

      "zone",

      "media_type",

      "duration",

      "location",

      "type",

      "unit",

      "width",

      "height",

      "total_sqr_ft",

      "lat",

      "long",

      "vendor",

      "availability",

      "start_date",

      "end_date",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        site[field] = req.body[field];
      }
    });

    await site.save();

    return res.json({
      success: true,

      message: "Site updated successfully",

      site,
    });
  } catch (error) {
    console.error("UPDATE SITE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// ========================================
// GET ALL SITES
// ========================================

const getSites = async (req, res) => {
  try {
    const user = req.user;

    // =====================================================
    // AUTH CHECK
    // =====================================================

    if (!user || !user.role) {
      return res.status(401).json({
        success: false,
        message: "User role not found",
      });
    }

    console.log("==========================================");
    console.log("GET SITES");
    console.log("USER ID:", user._id);
    console.log("ROLE:", user.role);
    console.log("STATE:", user.state);
    console.log("ZONE:", user.zone);
    console.log("SITE CODES:", user.site_codes);
    console.log("==========================================");

    // =====================================================
    // ADMIN
    // =====================================================
    // Admin ko saari sites
    // =====================================================

    if (user.role === "admin") {
      const sites = await Site.find({})
        .sort({
          createdAt: -1,
        });

      return res.status(200).json({
        success: true,
        count: sites.length,
        data: sites,
      });
    }

    // =====================================================
    // VENDOR EXECUTIVE
    // =====================================================
    // Vendor Executive:
    //
    // 1. State
    // 2. Zone
    // 3. Site Codes
    //
    // ke according sites dekhega.
    // =====================================================

    if (user.role === "vendor_executive") {
      const conditions = [];

      // -----------------------------------------------------
      // STATE
      // -----------------------------------------------------

      if (user.state) {
        conditions.push({
          state: user.state.trim(),
        });
      }

      // -----------------------------------------------------
      // ZONE
      // -----------------------------------------------------

      if (user.zone) {
        conditions.push({
          zone: user.zone.trim(),
        });
      }

      // -----------------------------------------------------
      // SITE CODES
      // -----------------------------------------------------

      let siteCodes = [];

      if (
        Array.isArray(user.site_codes) &&
        user.site_codes.length > 0
      ) {
        siteCodes = user.site_codes
          .map((code) => String(code).trim())
          .filter(Boolean);
      }

      // Old field support
      else if (user.site_code) {
        siteCodes = Array.isArray(user.site_code)
          ? user.site_code
              .map((code) => String(code).trim())
              .filter(Boolean)
          : [String(user.site_code).trim()];
      }

      if (siteCodes.length > 0) {
        conditions.push({
          site_code: {
            $in: siteCodes,
          },
        });
      }

      // -----------------------------------------------------
      // FINAL FILTER
      // -----------------------------------------------------

      const filter =
        conditions.length > 0
          ? {
              $and: conditions,
            }
          : {};

      console.log(
        "VENDOR EXECUTIVE FILTER:",
        filter
      );

      const sites = await Site.find(filter)
        .sort({
          createdAt: -1,
        });

      return res.status(200).json({
        success: true,
        count: sites.length,
        data: sites,
      });
    }

    // =====================================================
    // VENDOR
    // =====================================================
    //
    // IMPORTANT:
    //
    // Vendor ko State / Zone ke according restrict nahi
    // karna hai.
    //
    // Vendor ko DENTSU COMMUNICATIONS ki ALL sites
    // dikhengi.
    //
    // Lekin submission/status bhi response me milega.
    // =====================================================

  if (user.role === "vendor") {
  // -----------------------------------------------------
  // ONLY SUBMISSIONS HAVING IMAGES
  // -----------------------------------------------------

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

    // Image uploaded hona mandatory
    site_images: {
      $exists: true,
      $ne: [],
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
        media_type
        duration
        location
        type
        unit
        width
        height
        total_sqr_ft
        lat
        long
        vendor
        vendor_name
        availability
        start_date
        end_date
        status
      `
    )
    .populate(
      "uploaded_by",
      "name email role"
    )
    .sort({
      createdAt: -1,
    });

  // -----------------------------------------------------
  // ONLY DENTSU COMMUNICATIONS
  // -----------------------------------------------------

  const filteredSubmissions =
    submissions.filter(
      (submission) =>
        submission.site &&
        submission.site.vendor ===
          "DENTSU COMMUNICATIONS"
    );

  // -----------------------------------------------------
  // LATEST SUBMISSION PER SITE
  // -----------------------------------------------------

  const siteMap = new Map();

  filteredSubmissions.forEach(
    (submission) => {
      if (!submission.site) {
        return;
      }

      const siteId =
        submission.site._id.toString();

      // Query createdAt DESC hai,
      // isliye first submission latest hai.
      if (!siteMap.has(siteId)) {
        siteMap.set(
          siteId,
          submission
        );
      }
    }
  );

  // -----------------------------------------------------
  // RESPONSE
  // -----------------------------------------------------

  const data = Array.from(
    siteMap.values()
  ).map((submission) => {
    const site =
      submission.site.toObject
        ? submission.site.toObject()
        : submission.site;

    return {
      ...site,

      // Submission ID
      submission_id:
        submission._id,

      // Current submission status
      submission_status:
        submission.status,

      // Complete submission
      submission,
    };
  });

  // -----------------------------------------------------
  // RESPONSE
  // -----------------------------------------------------

  return res.status(200).json({
    success: true,

    count: data.length,

    data,
  });
}

    // =====================================================
    // STATE HEAD
    // =====================================================
    //
    // State Head ke liye priority:
    //
    // 1. site_codes available
    //      =>
    //      sirf assigned site codes
    //
    // 2. site_codes nahi hain
    //      =>
    //      state + zone
    //
    // 3. Submission:
    //      pending_state_head_approval
    //      state_head_rejected
    //      approved
    //
    // Vendor approval ke pehle ki submission State Head
    // ko nahi dikhani.
    // =====================================================

    if (user.role === "state_head") {
      // -----------------------------------------------------
      // STATE
      // -----------------------------------------------------

      const stateHeadState =
        user.state?.trim();

      // -----------------------------------------------------
      // ZONE
      // -----------------------------------------------------

      const stateHeadZone =
        user.zone?.trim();

      // -----------------------------------------------------
      // SITE CODES
      // -----------------------------------------------------

      const siteCodes =
        Array.isArray(user.site_codes)
          ? user.site_codes
              .map((code) =>
                String(code).trim()
              )
              .filter(Boolean)
          : [];

      console.log(
        "STATE HEAD STATE:",
        stateHeadState
      );

      console.log(
        "STATE HEAD ZONE:",
        stateHeadZone
      );

      console.log(
        "STATE HEAD SITE CODES:",
        siteCodes
      );

      // -----------------------------------------------------
      // VALIDATION
      // -----------------------------------------------------

      if (!stateHeadState) {
        return res.status(400).json({
          success: false,
          message:
            "State is not assigned to this State Head",
        });
      }

      // -----------------------------------------------------
      // SITE FILTER
      // -----------------------------------------------------

      const siteFilter = {
        state: stateHeadState,
      };

      // -----------------------------------------------------
      // SITE CODE PRIORITY
      // -----------------------------------------------------
      //
      // Agar State Head ko specific site codes mile hain,
      // to wahi sites.
      //
      // Example:
      //
      // site_codes:
      // ["110001", "110003"]
      //
      // to sirf ye 2 sites.
      // -----------------------------------------------------

      if (siteCodes.length > 0) {
        siteFilter.site_code = {
          $in: siteCodes,
        };
      }

      // -----------------------------------------------------
      // AGAR SITE CODE NAHI HAI
      // -----------------------------------------------------
      //
      // State + Zone ke according sites.
      // -----------------------------------------------------

      else {
        if (!stateHeadZone) {
          return res.status(400).json({
            success: false,
            message:
              "Zone or site codes are required for State Head",
          });
        }

        siteFilter.zone = stateHeadZone;
      }

      console.log(
        "STATE HEAD SITE FILTER:",
        siteFilter
      );

      // -----------------------------------------------------
      // GET SITES
      // -----------------------------------------------------

      const sites = await Site.find(siteFilter)
        .populate({
          path: "current_submission",
          populate: {
            path: "uploaded_by",
            select: "name email role",
          },
        })
        .sort({
          createdAt: -1,
        });

      // -----------------------------------------------------
      // STATE HEAD ONLY SEES:
      //
      // pending_state_head_approval
      // state_head_rejected
      // approved
      //
      // Agar current submission nahi hai,
      // State Head ko nahi dikhani.
      // -----------------------------------------------------

      const validSites = sites.filter((site) => {
        const submission =
          site.current_submission;

        if (!submission) {
          return false;
        }

        return [
          "pending_state_head_approval",
          "state_head_rejected",
          "approved",
        ].includes(submission.status);
      });

      // -----------------------------------------------------
      // RESPONSE
      // -----------------------------------------------------

      const data = validSites.map((site) => {
        const siteData = site.toObject();

        const submission =
          site.current_submission;

        let state_head_status =
          "pending";

        if (
          submission.status ===
          "pending_state_head_approval"
        ) {
          state_head_status = "pending";
        }

        else if (
          submission.status ===
          "state_head_rejected"
        ) {
          state_head_status = "rejected";
        }

        else if (
          submission.status ===
          "approved"
        ) {
          state_head_status = "approved";
        }

        return {
          ...siteData,

          submission_id:
            submission._id,

          submission_status:
            submission.status,

          state_head_status,

          submission,
        };
      });

      console.log(
        "STATE HEAD TOTAL SITES:",
        data.length
      );

      console.log(
        "STATE HEAD SITES:",
        data.map((site) => ({
          site_code: site.site_code,
          state: site.state,
          zone: site.zone,
          submission_status:
            site.submission_status,
          state_head_status:
            site.state_head_status,
        }))
      );

      return res.status(200).json({
        success: true,

        count: data.length,

        data,
      });
    }

    // =====================================================
    // CLIENT
    // =====================================================
    //
    // Client ko sirf final approved sites.
    // =====================================================

    if (user.role === "client") {
      const sites = await Site.find({
        status: "approved",
      })
        .sort({
          createdAt: -1,
        });

      return res.status(200).json({
        success: true,
        count: sites.length,
        data: sites,
      });
    }

    // =====================================================
    // UNKNOWN ROLE
    // =====================================================

    return res.status(403).json({
      success: false,
      message: "Invalid user role",
    });
  } catch (error) {
    console.error(
      "GET SITES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch sites",

      error:
        error.message,
    });
  }
};
// ========================================
// DELETE SITE
// ========================================

const deleteSite = async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);

    if (!site) {
      return res.status(404).json({
        success: false,

        message: "Site not found",
      });
    }

    await Site.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,

      message: "Site deleted successfully",
    });
  } catch (error) {
    console.error("DELETE SITE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// ========================================
// EXPORT
// ========================================

module.exports = {
  createSite,
  getSites,
  getMySites,

  getSiteById,

  updateSite,

  deleteSite,
};
