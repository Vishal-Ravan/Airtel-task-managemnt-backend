const express = require("express");

const authMiddleware =
  require("../middleware/auth.middleware");

const roleMiddleware =
  require("../middleware/role.middleware");

const campaignController =
  require("../controllers/campaign.controller");

const router = express.Router();


// =====================================================
// CREATE CAMPAIGN
// =====================================================

router.post(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  campaignController.createCampaign
);


// =====================================================
// GET ALL CAMPAIGNS
// =====================================================

router.get(
  "/",
  authMiddleware,
  campaignController.getCampaigns
);


// =====================================================
// GET CAMPAIGN BY ID
// =====================================================

router.get(
  "/:id",
  authMiddleware,
  campaignController.getCampaignById
);


// =====================================================
// UPDATE CAMPAIGN
// =====================================================

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  campaignController.updateCampaign
);


// =====================================================
// UPDATE STATUS
// =====================================================

router.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware("admin"),
  campaignController.updateCampaignStatus
);


// =====================================================
// DELETE CAMPAIGN
// =====================================================

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  campaignController.deleteCampaign
);


module.exports = router;