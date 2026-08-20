const bcrypt = require("bcryptjs");

const User = require("../models/User");


// ========================================
// CREATE USER
// ========================================

const createUser = async (req, res) => {

    try {

        const {
            name,
            email,
            phone,
            role,
            password,
            zone,
            state,
            site_code
        } = req.body;


        // -------------------------------
        // REQUIRED FIELDS
        // -------------------------------

        if (
            !name ||
            !email ||
            !phone ||
            !role ||
            !password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "name, email, phone, role and password are required"

            });

        }


        // -------------------------------
        // CHECK EMAIL
        // -------------------------------

        const existingUser =
            await User.findOne({
                email:
                    email.toLowerCase()
            });


        if (existingUser) {

            return res.status(409).json({

                success: false,

                message:
                    "User with this email already exists"

            });

        }


        // -------------------------------
        // VALID ROLES
        // -------------------------------

        const allowedRoles = [

            "vendor_executive",

            "vendor",

            "state_head",

            "client",

            "admin"

        ];


        if (
            !allowedRoles.includes(role)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid user role"

            });

        }


        // -------------------------------
        // PASSWORD
        // -------------------------------

        const hashedPassword =
            await bcrypt.hash(
                password,
                12
            );


        // -------------------------------
        // CREATE USER
        // -------------------------------

        const user =
            await User.create({

                name,

                email:
                    email.toLowerCase(),

                phone,

                role,

                password:
                    hashedPassword,

                zone: zone || null,

                state: state || null,

                site_code:
                    site_code || null,

                is_active: true

            });


        // -------------------------------
        // RESPONSE
        // -------------------------------

        return res.status(201).json({

            success: true,

            message:
                "User created successfully",

            user: {

                id:
                    user._id,

                name:
                    user.name,

                email:
                    user.email,

                phone:
                    user.phone,

                role:
                    user.role,

                zone:
                    user.zone,

                state:
                    user.state,

                site_code:
                    user.site_code,

                is_active:
                    user.is_active

            }

        });


    } catch (error) {

        console.error(
            "CREATE USER ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Failed to create user"

        });

    }

};


// ========================================
// GET ALL USERS
// ========================================

const getUsers = async (req, res) => {

    try {

        const {
            role,
            zone,
            state,
            is_active
        } = req.query;


        const filter = {};


        if (role) {

            filter.role =
                role;

        }


        if (zone) {

            filter.zone =
                zone;

        }


        if (state) {

            filter.state =
                state;

        }


        if (
            is_active !== undefined
        ) {

            filter.is_active =
                is_active === "true";

        }


        const users =
            await User.find(filter)

                .select("-password")

                .sort({
                    createdAt: -1
                });


        return res.json({

            success: true,

            count:
                users.length,

            users

        });


    } catch (error) {

        console.error(
            "GET USERS ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};


// ========================================
// GET USER BY ID
// ========================================

const getUserById =
    async (req, res) => {

        try {

            const user =
                await User.findById(
                    req.params.id
                )
                .select("-password");


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found"

                });

            }


            return res.json({

                success: true,

                user

            });


        } catch (error) {

            console.error(
                "GET USER ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    };


// ========================================
// UPDATE USER
// ========================================

const updateUser =
    async (req, res) => {

        try {

            const {
                name,
                email,
                phone,
                zone,
                state,
                site_code,
                role
            } = req.body;


            const user =
                await User.findById(
                    req.params.id
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found"

                });

            }


            if (name !== undefined) {

                user.name =
                    name;

            }


            if (email !== undefined) {

                user.email =
                    email.toLowerCase();

            }


            if (phone !== undefined) {

                user.phone =
                    phone;

            }


            if (zone !== undefined) {

                user.zone =
                    zone;

            }


            if (state !== undefined) {

                user.state =
                    state;

            }


            if (
                site_code !== undefined
            ) {

                user.site_code =
                    site_code;

            }


            if (role !== undefined) {

                user.role =
                    role;

            }


            await user.save();


            return res.json({

                success: true,

                message:
                    "User updated successfully",

                user: {

                    id:
                        user._id,

                    name:
                        user.name,

                    email:
                        user.email,

                    phone:
                        user.phone,

                    role:
                        user.role,

                    zone:
                        user.zone,

                    state:
                        user.state,

                    site_code:
                        user.site_code,

                    is_active:
                        user.is_active

                }

            });


        } catch (error) {

            console.error(
                "UPDATE USER ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    };


// ========================================
// UPDATE USER STATUS
// ========================================

const updateUserStatus =
    async (req, res) => {

        try {

            const {
                is_active
            } = req.body;


            if (
                typeof is_active !==
                "boolean"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "is_active must be boolean"

                });

            }


            const user =
                await User.findByIdAndUpdate(

                    req.params.id,

                    {
                        is_active
                    },

                    {
                        new: true
                    }

                )
                .select("-password");


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found"

                });

            }


            return res.json({

                success: true,

                message:
                    "User status updated successfully",

                user

            });


        } catch (error) {

            console.error(
                "UPDATE STATUS ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    };


// ========================================
// DELETE USER
// ========================================

const deleteUser =
    async (req, res) => {

        try {

            const user =
                await User.findById(
                    req.params.id
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found"

                });

            }


            await User.findByIdAndDelete(
                req.params.id
            );


            return res.json({

                success: true,

                message:
                    "User deleted successfully"

            });


        } catch (error) {

            console.error(
                "DELETE USER ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    };


// ========================================
// EXPORT
// ========================================

module.exports = {

    createUser,

    getUsers,

    getUserById,

    updateUser,

    updateUserStatus,

    deleteUser

};