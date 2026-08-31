const express = require("express");

const multer = require("multer");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");

const roleMiddleware = require("../middleware/role.middleware");

const {
  createSite,
  uploadSitesFromExcel,
  getMySites,
  getSiteById,
  updateSite,
  deleteSite,
  getSites,
} = require("../controllers/site.controller");

// =====================================================
// MULTER
// =====================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (
    req,
    file,
    cb
  ) => {
    const allowedExtensions = [
      ".xlsx",
      ".xls",
      ".csv",
    ];

    const fileName =
      file.originalname.toLowerCase();

    const isAllowed =
      allowedExtensions.some(
        (extension) =>
          fileName.endsWith(
            extension
          )
      );

    if (!isAllowed) {
      return cb(
        new Error(
          "Only .xlsx, .xls or .csv files are allowed"
        )
      );
    }

    cb(null, true);
  },
});

// =====================================================
// GET SITES
//
// GET /api/sites?campaign_id=xxx
// =====================================================

router.get(
  "/",
  authMiddleware,
  getSites
);

// =====================================================
// UPLOAD EXCEL
//
// POST /api/sites/upload-excel
//
// multipart/form-data
//
// campaign_id = xxx
// file = Excel file
// =====================================================

router.post(
  "/upload-excel",
  authMiddleware,
  roleMiddleware("admin"),
  upload.single("file"),
  uploadSitesFromExcel
);

// =====================================================
// CREATE SINGLE SITE
//
// POST /api/sites
// =====================================================

router.post(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  createSite
);

// =====================================================
// MY SITES
//
// GET /api/sites/my-sites?campaign_id=xxx
// =====================================================

router.get(
  "/my-sites",
  authMiddleware,
  getMySites
);

// =====================================================
// GET SITE BY ID
//
// GET /api/sites/:id
// =====================================================

router.get(
  "/:id",
  authMiddleware,
  getSiteById
);

// =====================================================
// UPDATE SITE
//
// PUT /api/sites/:id
// =====================================================

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  updateSite
);

// =====================================================
// DELETE SITE
//
// DELETE /api/sites/:id
// =====================================================

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  deleteSite
);

module.exports = router;