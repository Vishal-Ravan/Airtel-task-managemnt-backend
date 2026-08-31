const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");
const upload = require("../middleware/upload.middleware");

const {
  submitSite,
  getSiteSubmissions,
  getMySubmissions,
  getSubmissionById,
} = require("../controllers/submission.controller");

// =====================================================
// GET MY SUBMISSIONS
//
// GET /api/submissions?campaign_id=CAMPAIGN_ID
//
// Example:
// /api/submissions?campaign_id=6a8b176d422b94fd095c19d9
// =====================================================

router.get(
  "/",
  authMiddleware,
  getMySubmissions
);

// =====================================================
// CREATE SUBMISSION
//
// POST /api/submissions
//
// FormData:
// campaign_id
// site_id
// person_name
// selfie
// site_images[]
// =====================================================

router.post(
  "/",
  authMiddleware,
  roleMiddleware(
    "vendor_executive",
    "admin"
  ),
  upload.fields([
    {
      name: "selfie",
      maxCount: 1,
    },
    {
      name: "site_images",
      maxCount: 10,
    },
  ]),
  submitSite
);

// =====================================================
// GET SITE SUBMISSION HISTORY
//
// IMPORTANT:
// Ye route /:id se PEHLE hona chahiye.
//
// GET /api/submissions/site/:siteId/history
//
// Example:
// /api/submissions/site/68abc123/history?campaign_id=6a8b176d422b94fd095c19d9
// =====================================================

router.get(
  "/site/:siteId/history",
  authMiddleware,
  getSiteSubmissions
);

// =====================================================
// GET SUBMISSION BY ID
//
// GET /api/submissions/:id?campaign_id=CAMPAIGN_ID
//
// Example:
// /api/submissions/68abc123?campaign_id=6a8b176d422b94fd095c19d9
// =====================================================

router.get(
  "/:id",
  authMiddleware,
  getSubmissionById
);

module.exports = router;