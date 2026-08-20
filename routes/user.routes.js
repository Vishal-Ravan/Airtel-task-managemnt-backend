const express = require("express");

const authMiddleware =
    require("../middleware/auth.middleware");

const roleMiddleware =
    require("../middleware/role.middleware");

const userController =
    require("../controllers/user.controller");


console.log(
    "USER CONTROLLER:",
    userController
);

console.log(
    "createUser:",
    typeof userController.createUser
);

console.log(
    "getUsers:",
    typeof userController.getUsers
);

console.log(
    "getUserById:",
    typeof userController.getUserById
);

console.log(
    "updateUser:",
    typeof userController.updateUser
);

console.log(
    "updateUserStatus:",
    typeof userController.updateUserStatus
);

console.log(
    "deleteUser:",
    typeof userController.deleteUser
);

console.log(
    "authMiddleware:",
    typeof authMiddleware
);

console.log(
    "roleMiddleware:",
    typeof roleMiddleware
);


const router = express.Router();


// CREATE USER

router.post(
    "/",
    authMiddleware,
    roleMiddleware("admin"),
    userController.createUser
);


// GET USERS

router.get(
    "/",
    authMiddleware,
    roleMiddleware("admin"),
    userController.getUsers
);


// GET USER

router.get(
    "/:id",
    authMiddleware,
    userController.getUserById
);


// UPDATE USER

router.put(
    "/:id",
    authMiddleware,
    roleMiddleware("admin"),
    userController.updateUser
);


// STATUS

router.patch(
    "/:id/status",
    authMiddleware,
    roleMiddleware("admin"),
    userController.updateUserStatus
);


// DELETE

router.delete(
    "/:id",
    authMiddleware,
    roleMiddleware("admin"),
    userController.deleteUser
);


module.exports = router;