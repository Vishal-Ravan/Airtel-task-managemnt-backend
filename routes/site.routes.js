const express = require("express");

const authMiddleware =
    require("../middleware/auth.middleware");

const roleMiddleware =
    require("../middleware/role.middleware");

const {
    createSite,
    getMySites,
    getSiteById,
    updateSite,
    deleteSite,
    getSites
} = require("../controllers/site.controller");

const router = express.Router();

router.get(
    "/",
    authMiddleware,
    getSites
);

// ========================================
// CREATE SITE
// ========================================

router.post(
    "/",
    authMiddleware,
    // roleMiddleware("admin"),
    createSite
);


// ========================================
// MY SITES
// ========================================

// IMPORTANT:
// This must come BEFORE /:id

router.get(
    "/my-sites",
    authMiddleware,
    getMySites
);


// ========================================
// GET SITE
// ========================================

router.get(
    "/:id",
    authMiddleware,
    getSiteById
);


// ========================================
// UPDATE SITE
// ========================================

router.put(
    "/:id",
    authMiddleware,
    roleMiddleware("admin"),
    updateSite
);


// ========================================
// DELETE SITE
// ========================================

router.delete(
    "/:id",
    authMiddleware,
    roleMiddleware("admin"),
    deleteSite
);


module.exports = router;