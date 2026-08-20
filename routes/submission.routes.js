const express = require("express");

const authMiddleware =
    require("../middleware/auth.middleware");

const roleMiddleware =
    require("../middleware/role.middleware");

const upload =
    require("../middleware/upload.middleware");

const {
    submitSite,
    getSiteSubmissions,
    getMySubmissions,
    getSubmissionById
} = require("../controllers/submission.controller");

const router = express.Router();


// ======================================================
// GET MY SUBMISSIONS
// GET /api/submissions
// ======================================================

router.get(
    "/",
    authMiddleware,
    getMySubmissions
);


// ======================================================
// CREATE SUBMISSION
// POST /api/submissions
// ======================================================

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
            maxCount: 1
        },
        {
            name: "site_images",
            maxCount: 10
        }
    ]),
    submitSite
);


// ======================================================
// GET SUBMISSION BY ID
// GET /api/submissions/:id
// ======================================================

router.get(
    "/:id",
    authMiddleware,
    getSubmissionById
);


// ======================================================
// GET SITE SUBMISSIONS HISTORY
// GET /api/submissions/site/:siteId/history
// ======================================================

router.get(
    "/site/:siteId/history",
    authMiddleware,
    getSiteSubmissions
);


module.exports = router;