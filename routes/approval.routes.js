const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");

const {
  getVendorPendingApprovals,
  getVendorSites,
  getVendorApprovalStatus,
  vendorApprove,
  vendorReject,
  stateHeadApprove,
  stateHeadReject,
  getStateHeadSiteStatus,
  getClientDashboard,
  getDashboardStats,
  getPendingApprovals,
} = require("../controllers/approval.controller");

// =====================================================
// VENDOR - ALL SITES / STATUS
// GET /api/approvals/vendor/sites?campaign_id=xxx
// =====================================================

router.get(
  "/vendor/sites",
  authMiddleware,
  roleMiddleware("vendor"),
  getVendorSites
);

// =====================================================
// VENDOR - APPROVAL STATUS
// GET /api/approvals/vendor/status?campaign_id=xxx
// =====================================================

router.get(
  "/vendor/status",
  authMiddleware,
  roleMiddleware("vendor"),
  getVendorApprovalStatus
);

// =====================================================
// VENDOR - GET PENDING APPROVALS
// GET /api/approvals/vendor/pending?campaign_id=xxx
// =====================================================

router.get(
  "/vendor/pending",
  authMiddleware,
  roleMiddleware("vendor"),
  getVendorPendingApprovals
);

// =====================================================
// VENDOR - APPROVE
// POST /api/approvals/vendor/:submissionId/approve
// =====================================================

router.post(
  "/vendor/:submissionId/approve",
  authMiddleware,
  roleMiddleware("vendor"),
  vendorApprove
);

// =====================================================
// VENDOR - REJECT
// POST /api/approvals/vendor/:submissionId/reject
// =====================================================

router.post(
  "/vendor/:submissionId/reject",
  authMiddleware,
  roleMiddleware("vendor"),
  vendorReject
);

// =====================================================
// STATE HEAD - PENDING
// GET /api/approvals/state-head/pending?campaign_id=xxx
// =====================================================

router.get(
  "/state-head/pending",
  authMiddleware,
  roleMiddleware("state_head"),
  getPendingApprovals
);

// =====================================================
// STATE HEAD - STATUS
// GET /api/approvals/state-head/status?campaign_id=xxx
// =====================================================

router.get(
  "/state-head/status",
  authMiddleware,
  roleMiddleware("state_head"),
  getStateHeadSiteStatus
);

// =====================================================
// STATE HEAD - APPROVE
// POST /api/approvals/state-head/:submissionId/approve
// =====================================================

router.post(
  "/state-head/:submissionId/approve",
  authMiddleware,
  roleMiddleware("state_head"),
  stateHeadApprove
);

// =====================================================
// STATE HEAD - REJECT
// POST /api/approvals/state-head/:submissionId/reject
// =====================================================

router.post(
  "/state-head/:submissionId/reject",
  authMiddleware,
  roleMiddleware("state_head"),
  stateHeadReject
);

// =====================================================
// CLIENT DASHBOARD
// GET /api/approvals/client/dashboard?campaign_id=xxx
// =====================================================

router.get(
  "/client/dashboard",
  authMiddleware,
  roleMiddleware("client"),
  getClientDashboard
);

// =====================================================
// ROLE BASED DASHBOARD
// GET /api/approvals/dashboard?campaign_id=xxx
// =====================================================

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware(
    "vendor",
    "state_head",
    "client"
  ),
  getDashboardStats
);

module.exports = router;