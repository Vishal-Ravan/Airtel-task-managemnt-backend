const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");

const {
    getVendorPendingApprovals,
    getVendorSites,
    getVendorApprovalStatus, // ✅ ADD THIS
    vendorApprove,
    vendorReject,
    stateHeadApprove,
    stateHeadReject,
    getStateHeadSiteStatus,
    getClientDashboard,
    getDashboardStats
} = require("../controllers/approval.controller");


// =====================================================
// VENDOR - ALL SITES / STATUS
// GET /api/approvals/vendor/sites
// =====================================================

router.get(
    "/vendor/sites",
    authMiddleware,
    roleMiddleware("vendor"),
    getVendorSites
);


// =====================================================
// VENDOR - APPROVAL STATUS
// GET /api/approvals/vendor/status
// =====================================================

router.get(
    "/vendor/status",
    authMiddleware,
    roleMiddleware("vendor"),
    getVendorApprovalStatus
);


router.get(
  "/state-head/status",
  authMiddleware,
  roleMiddleware("state_head"),
  getStateHeadSiteStatus
);

// =====================================================
// VENDOR - GET PENDING APPROVALS
// =====================================================

router.get(
    "/vendor/pending",
    authMiddleware,
    roleMiddleware("vendor"),
    getVendorPendingApprovals
);


// =====================================================
// VENDOR - APPROVE
// =====================================================

router.post(
    "/vendor/:submissionId/approve",
    authMiddleware,
    roleMiddleware("vendor"),
    vendorApprove
);


// =====================================================
// VENDOR - REJECT
// =====================================================

router.post(
    "/vendor/:submissionId/reject",
    authMiddleware,
    roleMiddleware("vendor"),
    vendorReject
);


// =====================================================
// STATE HEAD - GET PENDING APPROVALS
// =====================================================

router.get(
    "/state-head/pending",
    authMiddleware,
    roleMiddleware("state_head"),
    async (req, res, next) => {
        try {
            const {
                getPendingApprovals
            } = require("../controllers/approval.controller");

            return getPendingApprovals(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// =====================================================
// STATE HEAD - APPROVE
// =====================================================

router.post(
    "/state-head/:submissionId/approve",
    authMiddleware,
    roleMiddleware("state_head"),
    stateHeadApprove
);


// =====================================================
// STATE HEAD - REJECT
// =====================================================

router.post(
    "/state-head/:submissionId/reject",
    authMiddleware,
    roleMiddleware("state_head"),
    stateHeadReject
);


// client

router.get(
  "/client/dashboard",
  authMiddleware,
  getClientDashboard
);

router.get(
  "/dashboard",
  authMiddleware,
  getDashboardStats
);

module.exports = router;