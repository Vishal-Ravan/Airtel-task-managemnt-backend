const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");

const roleMiddleware = require("../middleware/role.middleware");

const userController = require("../controllers/user.controller");

// =====================================================
// CREATE USER
// POST /api/users
// =====================================================

router.post(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  userController.createUser
);

// =====================================================
// GET USERS
// GET /api/users
//
// Optional:
// /api/users?campaign_id=CAMPAIGN_ID
// /api/users?role=vendor_executive
// /api/users?search=rahul
// =====================================================

router.get(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  userController.getUsers
);

// =====================================================
// GET USER BY ID
// GET /api/users/:id
// =====================================================

router.get(
  "/:id",
  authMiddleware,
  userController.getUserById
);

// =====================================================
// UPDATE USER
// PUT /api/users/:id
// =====================================================

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  userController.updateUser
);

// =====================================================
// UPDATE USER STATUS
// PATCH /api/users/:id/status
// =====================================================

router.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware("admin"),
  userController.updateUserStatus
);

// =====================================================
// DELETE USER
// DELETE /api/users/:id
// =====================================================

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  userController.deleteUser
);

module.exports = router;