const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");

const campaignController = require("../controllers/campaign.controller");

// =====================================================
// CREATE CAMPAIGN
// POST /api/campaigns
// =====================================================

router.post(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  campaignController.createCampaign
);

// =====================================================
// GET ALL CAMPAIGNS
// GET /api/campaigns
//
// Admin:
//    All campaigns
//
// Other users:
//    Only campaigns assigned to them
// =====================================================

router.get(
  "/",
  authMiddleware,
  campaignController.getCampaigns
);

// =====================================================
// GET CAMPAIGN BY ID
// GET /api/campaigns/:id
// =====================================================

router.get(
  "/:id",
  authMiddleware,
  campaignController.getCampaignById
);

// =====================================================
// UPDATE CAMPAIGN
// PUT /api/campaigns/:id
// =====================================================

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  campaignController.updateCampaign
);

// =====================================================
// UPDATE CAMPAIGN STATUS
// PATCH /api/campaigns/:id/status
// =====================================================

router.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware("admin"),
  campaignController.updateCampaignStatus
);

// =====================================================
// DELETE CAMPAIGN
// DELETE /api/campaigns/:id
// =====================================================

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  campaignController.deleteCampaign
);

module.exports = router;