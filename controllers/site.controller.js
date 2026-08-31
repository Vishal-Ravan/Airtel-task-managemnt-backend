const mongoose = require("mongoose");
const XLSX = require("xlsx");

const Site = require("../models/Site");
const SiteSubmission = require("../models/SiteSubmission");
const Campaign = require("../models/Campaign");

const {
  getCampaignId,
  requireCampaignAccess,
  buildAssignedSiteFilter,
} = require("../services/campaignAccess.service");

const {
  createHistory,
} = require("../services/history.service");

// =====================================================
// HELPER
// =====================================================

const cleanString = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
};

// =====================================================
// NUMBER HELPER
// =====================================================

const toNumberOrNull = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isNaN(number)
    ? null
    : number;
};

// =====================================================
// DATE HELPER
// =====================================================

const toDateOrNull = (value) => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  // Already Date object
  if (value instanceof Date) {
    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  const stringValue =
    String(value).trim();

  // -----------------------------------------------
  // DD/MM/YYYY
  // -----------------------------------------------

  let match =
    stringValue.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (match) {
    const day =
      Number(match[1]);

    const month =
      Number(match[2]) - 1;

    const year =
      Number(match[3]);

    const date = new Date(
      year,
      month,
      day
    );

    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  // -----------------------------------------------
  // DD-MM-YYYY
  // -----------------------------------------------

  match =
    stringValue.match(
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/
    );

  if (match) {
    const day =
      Number(match[1]);

    const month =
      Number(match[2]) - 1;

    const year =
      Number(match[3]);

    const date = new Date(
      year,
      month,
      day
    );

    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  // -----------------------------------------------
  // YYYY-MM-DD
  // -----------------------------------------------

  match =
    stringValue.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (match) {
    const year =
      Number(match[1]);

    const month =
      Number(match[2]) - 1;

    const day =
      Number(match[3]);

    const date = new Date(
      year,
      month,
      day
    );

    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  // -----------------------------------------------
  // NORMAL JS DATE
  // -----------------------------------------------

  const date =
    new Date(stringValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
};

// =====================================================
// NORMALIZE EXCEL HEADER
// =====================================================

const normalizeHeader = (header) => {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[()./-]/g, "_")
    .replace(/_+/g, "_");
};

// =====================================================
// GET EXCEL VALUE
// =====================================================

const getExcelValue = (
  row,
  ...keys
) => {
  for (const key of keys) {
    if (
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {
      return row[key];
    }
  }

  return "";
};

// =====================================================
// CREATE SITE
// =====================================================

const createSite = async (
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
          "Only admin can create sites",
      });
    }

    const {
      campaign_id,
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
      remarks,
      start_date,
      end_date,
    } = req.body;

    // =================================================
    // CAMPAIGN
    // =================================================

    if (!campaign_id) {
      return res.status(400).json({
        success: false,
        message:
          "campaign_id is required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        campaign_id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid campaign_id",
      });
    }

    const campaign =
      await Campaign.findById(
        campaign_id
      );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message:
          "Campaign not found",
      });
    }

    // =================================================
    // REQUIRED
    // site_code OPTIONAL
    // =================================================

    if (
      !state ||
      !zone ||
      !media_type ||
      !location
    ) {
      return res.status(400).json({
        success: false,
        message:
          "state, zone, media_type and location are required",
      });
    }

    // =================================================
    // SITE CODE CHECK
    // =================================================

    const normalizedSiteCode =
      cleanString(site_code).toUpperCase();

    if (normalizedSiteCode) {
      const existingSite =
        await Site.findOne({
          campaign_id,
          site_code:
            normalizedSiteCode,
        });

      if (existingSite) {
        return res.status(409).json({
          success: false,
          message:
            "Site code already exists in this campaign",
        });
      }
    }

    // =================================================
    // CREATE
    // =================================================

    const site =
      await Site.create({
        campaign_id,

        site_code:
          normalizedSiteCode,

        state:
          cleanString(state),

        zone:
          cleanString(zone),

        media_type:
          cleanString(media_type),

        duration:
          cleanString(duration),

        location:
          cleanString(location),

        type:
          cleanString(type),

        unit:
          cleanString(unit),

        width:
          toNumberOrNull(width),

        height:
          toNumberOrNull(height),

        total_sqr_ft:
          toNumberOrNull(
            total_sqr_ft
          ),

        lat:
          toNumberOrNull(lat),

        long:
          toNumberOrNull(long),

        vendor:
          cleanString(vendor) ||
          "DENTSU COMMUNICATIONS",

        availability:
          cleanString(availability),

        remarks:
          cleanString(remarks),

        start_date:
          toDateOrNull(start_date),

        end_date:
          toDateOrNull(end_date),

        status:
          "pending_upload",
      });

    // =================================================
    // HISTORY
    // =================================================

    await createHistory({
      site,

      action:
        "site_created",

      actionBy:
        req.user,

      actionByRole:
        req.user.role,

      remarks:
        "Site created by admin",

      oldStatus:
        null,

      newStatus:
        "pending_upload",
    });

    return res.status(201).json({
      success: true,
      message:
        "Site created successfully",

      site,
    });
  } catch (error) {
    console.error(
      "CREATE SITE ERROR:",
      error
    );

    // Mongo duplicate key
    if (
      error.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Duplicate site code in this campaign",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create site",
    });
  }
};

// =====================================================
// UPLOAD SITES FROM EXCEL
// =====================================================
//
// POST
// /api/sites/upload-excel
//
// multipart/form-data
//
// campaign_id = Campaign ObjectId
// file = Excel file
//
// =====================================================

const uploadSitesFromExcel = async (req, res) => {
  try {
    // =================================================
    // ADMIN ONLY
    // =================================================

    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can upload sites",
      });
    }

    // =================================================
    // CAMPAIGN
    // =================================================

    const campaignId = req.body.campaign_id;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: "campaign_id is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign_id",
      });
    }

    // =================================================
    // CAMPAIGN CHECK
    // =================================================

    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // =================================================
    // FILE CHECK
    // =================================================

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Excel file is required",
      });
    }

    // =================================================
    // READ EXCEL
    // =================================================

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
      cellNF: true,
      raw: true,
    });

    if (!workbook.SheetNames.length) {
      return res.status(400).json({
        success: false,
        message: "Excel file has no sheet",
      });
    }

    const firstSheet =
      workbook.Sheets[workbook.SheetNames[0]];

    let rows = XLSX.utils.sheet_to_json(firstSheet, {
      defval: "",
      raw: true,
    });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty",
      });
    }

    // =================================================
    // NORMALIZE HEADERS
    // =================================================

    rows = rows.map((originalRow) => {
      const normalizedRow = {};

      Object.keys(originalRow).forEach((key) => {
        normalizedRow[normalizeHeader(key)] =
          originalRow[key];
      });

      return normalizedRow;
    });

    // =================================================
    // EXISTING SITE CODES
    // =================================================

    const existingSites = await Site.find({
      campaign_id: campaignId,
      site_code: {
        $exists: true,
        $nin: ["", null],
      },
    })
      .select("site_code")
      .lean();

    const existingCodes = new Set(
      existingSites.map((site) =>
        cleanString(site.site_code).toUpperCase()
      )
    );

    // =================================================
    // PROCESS
    // =================================================

    const sitesToCreate = [];
    const errors = [];
    const uploadedCodes = new Set();

    rows.forEach((row, index) => {
      const excelRowNumber = index + 2;

      // =================================================
      // GET VALUES
      // =================================================

      const siteCode = cleanString(
        getExcelValue(
          row,
          "site_code",
          "sitecode",
          "site_code_",
          "site"
        )
      ).toUpperCase();

      const state = cleanString(
        getExcelValue(row, "state")
      );

      const zone = cleanString(
        getExcelValue(
          row,
          "zone",
          "city"
        )
      );

      const location = cleanString(
        getExcelValue(
          row,
          "location",
          "site_location"
        )
      );

      const mediaType = cleanString(
        getExcelValue(
          row,
          "media_type",
          "mediatype",
          "media"
        )
      );

      // =================================================
      // DATE VALUES
      // =================================================

      const rawStartDate = getExcelValue(
        row,
        "start_date",
        "start_date_",
        "start",
        "startdate",
        "start_date_dd_mm_yyyy",
        "start_date_dd_mm_yyyy_"
      );

      const rawEndDate = getExcelValue(
        row,
        "end_date",
        "end_date_",
        "end",
        "enddate",
        "end_date_dd_mm_yyyy",
        "end_date_dd_mm_yyyy_"
      );

      const startDate = toDateOrNull(
        rawStartDate
      );

      const endDate = toDateOrNull(
        rawEndDate
      );

      // =================================================
      // REQUIRED VALIDATION
      // =================================================

      const rowErrors = [];

      if (!state) {
        rowErrors.push("state is required");
      }

      if (!zone) {
        rowErrors.push("zone is required");
      }

      if (!location) {
        rowErrors.push("location is required");
      }

      if (!mediaType) {
        rowErrors.push("media_type is required");
      }

      // =================================================
      // DATE VALIDATION
      // =================================================

      if (
        rawStartDate !== "" &&
        rawStartDate !== null &&
        rawStartDate !== undefined &&
        !startDate
      ) {
        rowErrors.push(
          `Invalid start_date: ${rawStartDate}`
        );
      }

      if (
        rawEndDate !== "" &&
        rawEndDate !== null &&
        rawEndDate !== undefined &&
        !endDate
      ) {
        rowErrors.push(
          `Invalid end_date: ${rawEndDate}`
        );
      }

      // =================================================
      // DATE RANGE VALIDATION
      // =================================================

      if (
        startDate &&
        endDate &&
        startDate > endDate
      ) {
        rowErrors.push(
          "start_date cannot be greater than end_date"
        );
      }

      // =================================================
      // SITE CODE OPTIONAL
      // =================================================

      if (siteCode) {
        if (existingCodes.has(siteCode)) {
          rowErrors.push(
            `site_code ${siteCode} already exists in this campaign`
          );
        }

        if (uploadedCodes.has(siteCode)) {
          rowErrors.push(
            `duplicate site_code ${siteCode} in Excel`
          );
        }
      }

      // =================================================
      // IF ERRORS
      // =================================================

      if (rowErrors.length) {
        errors.push({
          row: excelRowNumber,
          site_code: siteCode,
          errors: rowErrors,
        });

        return;
      }

      // =================================================
      // ADD CODE TO CURRENT UPLOAD
      // =================================================

      if (siteCode) {
        uploadedCodes.add(siteCode);
      }

      // =================================================
      // CREATE SITE OBJECT
      // =================================================

      sitesToCreate.push({
        campaign_id: campaignId,

        site_code: siteCode,

        state: state,

        zone: zone,

        location: location,

        media_type: mediaType,

       duration:
  cleanString(
    getExcelValue(
      row,
      "duration",
      "durations"
    )
  ),

        type: cleanString(
          getExcelValue(
            row,
            "type"
          )
        ),

        unit: cleanString(
          getExcelValue(
            row,
            "unit"
          )
        ),

        width: toNumberOrNull(
          getExcelValue(
            row,
            "width"
          )
        ),

        height: toNumberOrNull(
          getExcelValue(
            row,
            "height"
          )
        ),

        total_sqr_ft: toNumberOrNull(
          getExcelValue(
            row,
            "total_sqr_ft",
            "total_sq_ft",
            "total_sqr_ft_",
            "total_sqft",
            "total_sq_ft"
          )
        ),

        lat: toNumberOrNull(
          getExcelValue(
            row,
            "lat",
            "latitude"
          )
        ),

        long: toNumberOrNull(
          getExcelValue(
            row,
            "long",
            "longitude",
            "lng"
          )
        ),

        vendor:
          cleanString(
            getExcelValue(
              row,
              "vendor"
            )
          ) || "DENTSU COMMUNICATIONS",

        availability: cleanString(
          getExcelValue(
            row,
            "availability"
          )
        ),

        remarks: cleanString(
          getExcelValue(
            row,
            "remarks"
          )
        ),

        // =================================================
        // IMPORTANT DATE FIELDS
        // =================================================

       start_date:
  toDateOrNull(
    getExcelValue(
      row,
      "start_date",
      "start_date_",
      "start",
      "startdate",
      "date"
    )
  ),

end_date:
  toDateOrNull(
    getExcelValue(
      row,
      "end_date",
      "end_date_",
      "end",
      "enddate"
    )
  ),

        status: "pending_upload",
      });
    });

    // =================================================
    // DEBUG DATE DATA
    // =================================================

    console.log(
      "=============================================="
    );

    console.log(
      "EXCEL DATE DEBUG"
    );

    sitesToCreate.forEach((site, index) => {
      console.log(
        `Row ${index + 2}:`,
        {
          site_code: site.site_code,
          start_date: site.start_date,
          end_date: site.end_date,
        }
      );
    });

    console.log(
      "=============================================="
    );

    // =================================================
    // IF VALID ROWS ARE ZERO
    // =================================================

    if (!sitesToCreate.length) {
      return res.status(400).json({
        success: false,
        message: "No valid sites found in Excel",

        total_rows: rows.length,

        created: 0,

        failed: errors.length,

        errors,
      });
    }

    // =================================================
    // INSERT
    // =================================================

    let createdSites = [];

    try {
      createdSites = await Site.insertMany(
        sitesToCreate,
        {
          ordered: false,
        }
      );
    } catch (insertError) {
      console.error(
        "EXCEL INSERT ERROR:",
        insertError
      );

      if (insertError.insertedDocs) {
        createdSites =
          insertError.insertedDocs;
      }

      // =================================================
      // MONGOOSE BULK WRITE ERRORS
      // =================================================

      if (insertError.writeErrors) {
        insertError.writeErrors.forEach(
          (writeError) => {
            errors.push({
              row:
                writeError.index + 2,

              site_code:
                sitesToCreate[
                  writeError.index
                ]?.site_code || "",

              errors: [
                writeError.errmsg ||
                  writeError.message ||
                  "Failed to insert site",
              ],
            });
          }
        );
      }

      // =================================================
      // DUPLICATE KEY ERROR
      // =================================================

      if (
        insertError.code === 11000 &&
        !insertError.writeErrors
      ) {
        errors.push({
          row: null,
          errors: [
            "Duplicate site code found while inserting sites",
          ],
        });
      }
    }

    // =================================================
    // CREATE HISTORY
    // =================================================

    for (const site of createdSites) {
      try {
        await createHistory({
          site,

          action: "site_created",

          actionBy: req.user,

          actionByRole: req.user.role,

          remarks:
            "Site uploaded through Excel by admin",

          oldStatus: null,

          newStatus: "pending_upload",
        });
      } catch (historyError) {
        console.error(
          "HISTORY ERROR:",
          historyError
        );
      }
    }

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(201).json({
      success: true,

      message:
        "Sites uploaded successfully",

      campaign_id:
        campaignId,

      campaign_name:
        campaign.name,

      total_rows:
        rows.length,

      created:
        createdSites.length,

      failed:
        errors.length,

      errors,
    });
  } catch (error) {
    console.error(
      "=============================================="
    );

    console.error(
      "UPLOAD EXCEL ERROR:"
    );

    console.error(error);

    console.error(
      "=============================================="
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to upload Excel",
    });
  }
};

// =====================================================
// GET SITES
// =====================================================

const getSites = async (req, res) => {
  try {
    // =================================================
    // AUTH
    // =================================================

    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // =================================================
    // CAMPAIGN ID
    // =================================================

    const campaignId = getCampaignId(req);

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: "campaign_id is required",
      });
    }

    // =================================================
    // VALIDATE CAMPAIGN ID
    // =================================================

    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign_id",
      });
    }

    // =================================================
    // CAMPAIGN ACCESS
    // =================================================

    const accessResult = await requireCampaignAccess(
      req,
      res
    );

    if (accessResult.error) {
      return accessResult.response;
    }

    const {
      campaign,
      access,
    } = accessResult;

    // =================================================
    // BASE CAMPAIGN FILTER
    // =================================================

    let siteFilter = {
      campaign_id: campaignId,
    };

    // =================================================
    // ADMIN
    // =================================================

    if (user.role === "admin") {
      /*
       * Admin:
       * Campaign ke andar saari sites dekh sakta hai.
       */

      siteFilter = {
        campaign_id: campaignId,
      };
    }

    // =================================================
    // OTHER ROLES
    // =================================================

    else {
      /*
       * Campaign access ke according
       * zone / state / site_code filter banega.
       */

      const assignedFilter =
        buildAssignedSiteFilter(access);

      siteFilter = {
        campaign_id: campaignId,
        ...assignedFilter,
      };
    }

    // =================================================
    // CLIENT
    // =================================================

    if (user.role === "client") {
      /*
       * Client ko sirf approved sites dikhengi.
       *
       * NOTE:
       * Yaha assigned_client ka filter nahi lagaya gaya
       * kyunki campaign access already access control
       * handle kar raha hai.
       */

      siteFilter.status = "approved";
    }

    // =================================================
    // DEBUG
    // =================================================

    console.log(
      "=============================================="
    );

    console.log(
      "GET SITES"
    );

    console.log(
      "USER ID:",
      user._id
    );

    console.log(
      "USER ROLE:",
      user.role
    );

    console.log(
      "CAMPAIGN ID:",
      campaignId
    );

    console.log(
      "CAMPAIGN NAME:",
      campaign?.name
    );

    console.log(
      "CAMPAIGN ACCESS:",
      JSON.stringify(access, null, 2)
    );

    console.log(
      "SITE FILTER:",
      JSON.stringify(siteFilter, null, 2)
    );

    console.log(
      "=============================================="
    );

    // =================================================
    // FETCH SITES
    // =================================================

    const sites = await Site.find(siteFilter)
      .populate({
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
      })
      .sort({
        createdAt: -1,
      });

    // =================================================
    // DEBUG
    // =================================================

    console.log(
      "SITES FOUND:",
      sites.length
    );

    // =================================================
    // ADMIN
    // =================================================

    if (user.role === "admin") {
      return res.status(200).json({
        success: true,

        campaign_id:
          campaignId,

        campaign_name:
          campaign?.name || "",

        role:
          user.role,

        count:
          sites.length,

        data:
          sites,
      });
    }

    // =================================================
    // VENDOR EXECUTIVE
    // =================================================

    if (
      user.role ===
      "vendor_executive"
    ) {
      return res.status(200).json({
        success: true,

        campaign_id:
          campaignId,

        campaign_name:
          campaign?.name || "",

        role:
          user.role,

        count:
          sites.length,

        data:
          sites,
      });
    }

    // =================================================
    // VENDOR
    // =================================================

    if (
      user.role === "vendor"
    ) {
      /*
       * Vendor ko sirf woh sites chahiye
       * jinke current submission available hain.
       */

      const data = sites
        .filter(
          (site) =>
            !!site.current_submission
        )
        .map((site) => {
          const siteData =
            site.toObject();

          const submission =
            site.current_submission;

          return {
            ...siteData,

            submission_id:
              submission?._id || null,

            submission_status:
              submission?.status || null,

            submission,
          };
        });

      return res.status(200).json({
        success: true,

        campaign_id:
          campaignId,

        campaign_name:
          campaign?.name || "",

        role:
          user.role,

        count:
          data.length,

        data,
      });
    }

    // =================================================
    // STATE HEAD
    // =================================================

    if (
      user.role ===
      "state_head"
    ) {
      /*
       * State Head ko sirf woh submissions dikhengi
       * jo State Head approval stage par pahunch chuki hain
       * ya already approved/rejected hain.
       */

      const validSites =
        sites.filter((site) => {
          const submission =
            site.current_submission;

          if (!submission) {
            return false;
          }

          return [
            "pending_state_head_approval",
            "state_head_rejected",
            "approved",
          ].includes(
            submission.status
          );
        });

      const data =
        validSites.map((site) => {
          const siteData =
            site.toObject();

          const submission =
            site.current_submission;

          let stateHeadStatus =
            "pending";

          // -------------------------------------------
          // REJECTED
          // -------------------------------------------

          if (
            submission.status ===
            "state_head_rejected"
          ) {
            stateHeadStatus =
              "rejected";
          }

          // -------------------------------------------
          // APPROVED
          // -------------------------------------------

          if (
            submission.status ===
            "approved"
          ) {
            stateHeadStatus =
              "approved";
          }

          // -------------------------------------------
          // PENDING
          // -------------------------------------------

          if (
            submission.status ===
            "pending_state_head_approval"
          ) {
            stateHeadStatus =
              "pending";
          }

          return {
            ...siteData,

            submission_id:
              submission?._id || null,

            submission_status:
              submission?.status || null,

            state_head_status:
              stateHeadStatus,

            submission,
          };
        });

      return res.status(200).json({
        success: true,

        campaign_id:
          campaignId,

        campaign_name:
          campaign?.name || "",

        role:
          user.role,

        count:
          data.length,

        data,
      });
    }

    // =================================================
    // CLIENT
    // =================================================

    if (
      user.role === "client"
    ) {
      /*
       * CLIENT FLOW
       *
       * Client ko selected campaign ki
       * approved sites dikhengi.
       *
       * Site filter already:
       *
       * {
       *   campaign_id,
       *   ...campaignAccessFilter,
       *   status: "approved"
       * }
       */

      const data =
        sites.map((site) => {
          const siteData =
            site.toObject();

          const submission =
            site.current_submission;

          let clientStatus =
            "approved";

          if (
            submission?.status ===
            "approved"
          ) {
            clientStatus =
              "approved";
          }

          return {
            ...siteData,

            submission_id:
              submission?._id || null,

            submission_status:
              submission?.status || null,

            client_status:
              clientStatus,

            submission,
          };
        });

      return res.status(200).json({
        success: true,

        campaign_id:
          campaignId,

        campaign_name:
          campaign?.name || "",

        role:
          user.role,

        count:
          data.length,

        data,
      });
    }

    // =================================================
    // INVALID ROLE
    // =================================================

    return res.status(403).json({
      success: false,
      message:
        "Invalid user role",
    });

  } catch (error) {
    console.error(
      "=============================================="
    );

    console.error(
      "GET SITES ERROR:"
    );

    console.error(
      error
    );

    console.error(
      "=============================================="
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to fetch sites",
    });
  }
};




// =====================================================
// GET MY SITES
// =====================================================

const getMySites = getSites;

// =====================================================
// GET SITE BY ID
// =====================================================

const getSiteById = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid site ID",
      });
    }

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

    const site =
      await Site.findOne({
        _id: id,

        campaign_id:
          campaignId,

        ...buildAssignedSiteFilter(
          access
        ),
      })
        .populate({
          path:
            "current_submission",

          populate: [
            {
              path:
                "submitted_by",

              select:
                "name email role",
            },

            {
              path:
                "uploaded_by",

              select:
                "name email role",
            },
          ],
        })
        .lean();

    if (!site) {
      return res.status(404).json({
        success: false,
        message:
          "Site not found or not assigned to you",
      });
    }

    if (
      req.user.role ===
        "client" &&
      site.status !==
        "approved"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This site is not approved",
      });
    }

    return res.json({
      success: true,
      site,
    });
  } catch (error) {
    console.error(
      "GET SITE BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch site",
    });
  }
};

// =====================================================
// UPDATE SITE
// =====================================================

const updateSite = async (
  req,
  res
) => {
  try {
    if (
      !req.user ||
      req.user.role !==
        "admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin can update sites",
      });
    }

    const site =
      await Site.findById(
        req.params.id
      );

    if (!site) {
      return res.status(404).json({
        success: false,
        message:
          "Site not found",
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
      "remarks",
      "start_date",
      "end_date",
    ];

    allowedFields.forEach(
      (field) => {
        if (
          req.body[field] !==
          undefined
        ) {
          site[field] =
            req.body[field];
        }
      }
    );

    // =================================================
    // CAMPAIGN
    // =================================================

    if (
      req.body.campaign_id
    ) {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.body.campaign_id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid campaign_id",
        });
      }

      const campaign =
        await Campaign.findById(
          req.body.campaign_id
        );

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message:
            "Campaign not found",
        });
      }

      site.campaign_id =
        req.body.campaign_id;
    }

    // =================================================
    // NORMALIZE SITE CODE
    // =================================================

    if (
      req.body.site_code !==
      undefined
    ) {
      site.site_code =
        cleanString(
          req.body.site_code
        ).toUpperCase();
    }

    await site.save();

    return res.json({
      success: true,

      message:
        "Site updated successfully",

      site,
    });
  } catch (error) {
    console.error(
      "UPDATE SITE ERROR:",
      error
    );

    if (
      error.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Site code already exists in this campaign",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update site",
    });
  }
};

// =====================================================
// DELETE SITE
// =====================================================

const deleteSite = async (
  req,
  res
) => {
  try {
    if (
      !req.user ||
      req.user.role !==
        "admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin can delete sites",
      });
    }

    const site =
      await Site.findById(
        req.params.id
      );

    if (!site) {
      return res.status(404).json({
        success: false,
        message:
          "Site not found",
      });
    }

    await SiteSubmission.deleteMany({
      site:
        site._id,
    });

    await Site.findByIdAndDelete(
      site._id
    );

    return res.json({
      success: true,

      message:
        "Site deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE SITE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete site",
    });
  }
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  createSite,
  uploadSitesFromExcel,
  getSites,
  getMySites,
  getSiteById,
  updateSite,
  deleteSite,
};