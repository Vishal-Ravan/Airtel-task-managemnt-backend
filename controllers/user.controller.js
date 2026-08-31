const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const CampaignUser = require("../models/CampaignUser");
const Campaign = require("../models/Campaign");

// =====================================================
// HELPERS
// =====================================================

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((item) => String(item).trim())
          .filter(Boolean)
      ),
    ];
  }

  // Also support:
  // "Delhi, Maharashtra"
  // "North West"
  if (typeof value === "string") {
    return [
      ...new Set(
        value
          .split(/[,\s]+(?=[A-Za-z])/)
          .map((item) => item.trim())
          .filter(Boolean)
      ),
    ];
  }

  return [];
};

// =====================================================
// STRING -> ARRAY
// Supports comma + space
//
// "Delhi, Maharashtra, Gujarat"
// => ["Delhi", "Maharashtra", "Gujarat"]
// =====================================================

const parseStringArray = (value) => {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((item) => String(item).trim())
          .filter(Boolean)
      ),
    ];
  }

  if (typeof value !== "string") {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
};

// =====================================================
// EMAIL
// =====================================================

const normalizeEmail = (email) => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

// =====================================================
// NORMALIZE LOCATIONS
//
// Expected:
//
// [
//   {
//     state: "Maharashtra",
//     zones: ["Pune", "Mumbai"]
//   }
// ]
// =====================================================

const normalizeLocations = (locations) => {
  if (!Array.isArray(locations)) {
    return [];
  }

  const stateMap = new Map();

  for (const location of locations) {
    if (!location) continue;

    const state = String(
      location.state || ""
    ).trim();

    if (!state) continue;

    const zones = Array.isArray(
      location.zones
    )
      ? location.zones
      : parseStringArray(
          location.zones
        );

    const stateKey =
      state.toLowerCase();

    if (!stateMap.has(stateKey)) {
      stateMap.set(stateKey, {
        state,
        zones: [],
      });
    }

    const existing =
      stateMap.get(stateKey);

    existing.zones = [
      ...new Set([
        ...existing.zones,
        ...zones,
      ]),
    ];
  }

  return Array.from(
    stateMap.values()
  );
};

// =====================================================
// BUILD LOCATIONS
//
// Supports BOTH:
//
// 1. New format:
//
// locations: [
//   {
//     state: "Delhi",
//     zones: ["North"]
//   }
// ]
//
// 2. Current frontend format:
//
// states: ["Delhi", "Maharashtra"]
// zones: ["North", "West"]
//
// =====================================================

const buildLocations = (access) => {
  // -----------------------------------------------
  // If locations already provided
  // -----------------------------------------------

  if (
    Array.isArray(access.locations)
  ) {
    return normalizeLocations(
      access.locations
    );
  }

  // -----------------------------------------------
  // Otherwise use states + zones
  // -----------------------------------------------

  const states = parseStringArray(
    access.states
  );

  const zones = parseStringArray(
    access.zones
  );

  if (!states.length) {
    return [];
  }

  /*
    Important:

    Current UI gives:

    states:
    ["Delhi", "Maharashtra"]

    zones:
    ["North", "West"]

    So each selected state gets the
    selected zones.

    Result:

    [
      {
        state: "Delhi",
        zones: ["North", "West"]
      },
      {
        state: "Maharashtra",
        zones: ["North", "West"]
      }
    ]
  */

  return states.map(
    (state) => ({
      state,
      zones: [...zones],
    })
  );
};

// =====================================================
// VALIDATE CAMPAIGN ACCESS
// =====================================================

const validateCampaignAccess =
  async (campaignAccess) => {
    if (
      !Array.isArray(
        campaignAccess
      )
    ) {
      return {
        valid: false,
        message:
          "campaign_access must be an array",
      };
    }

    if (
      !campaignAccess.length
    ) {
      return {
        valid: false,
        message:
          "At least one campaign is required",
      };
    }

    // -----------------------------------------------
    // Campaign IDs
    // -----------------------------------------------

    const campaignIds =
      campaignAccess.map(
        (access) =>
          String(
            access?.campaign_id || ""
          ).trim()
      );

    // -----------------------------------------------
    // Required campaign ID
    // -----------------------------------------------

    if (
      campaignIds.some(
        (id) => !id
      )
    ) {
      return {
        valid: false,
        message:
          "campaign_id is required for every campaign",
      };
    }

    // -----------------------------------------------
    // ObjectId validation
    // -----------------------------------------------

    for (const campaignId of campaignIds) {
      if (
        !mongoose.Types.ObjectId.isValid(
          campaignId
        )
      ) {
        return {
          valid: false,
          message:
            `Invalid campaign ID: ${campaignId}`,
        };
      }
    }

    // -----------------------------------------------
    // Duplicate campaigns
    // -----------------------------------------------

    const uniqueCampaignIds =
      [
        ...new Set(
          campaignIds
        ),
      ];

    if (
      uniqueCampaignIds.length !==
      campaignIds.length
    ) {
      return {
        valid: false,
        message:
          "Same campaign cannot be assigned more than once",
      };
    }

    // -----------------------------------------------
    // IMPORTANT
    //
    // Your Campaign response has:
    //
    // status: "active"
    //
    // NOT:
    //
    // is_active: true
    // -----------------------------------------------

    const campaigns =
      await Campaign.find({
        _id: {
          $in: uniqueCampaignIds,
        },
        status: "active",
      }).select(
        "_id name code status"
      );

    if (
      campaigns.length !==
      uniqueCampaignIds.length
    ) {
      return {
        valid: false,
        message:
          "One or more campaigns are invalid or inactive",
      };
    }

    return {
      valid: true,
      campaignIds:
        uniqueCampaignIds,
      campaigns,
    };
  };

// =====================================================
// CREATE USER
// =====================================================

const createUser = async (
  req,
  res
) => {
  try {
    // =================================================
    // ADMIN ONLY
    // =================================================

    if (
      !req.user ||
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin can create users",
      });
    }

    const {
      name,
      email,
      phone,
      role,
      password,
      campaign_access,
      is_active,
    } = req.body;

    // =================================================
    // REQUIRED
    // =================================================

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
          "name, email, phone, role and password are required",
      });
    }

    // =================================================
    // ROLE
    // =================================================

    const allowedRoles = [
      "vendor_executive",
      "vendor",
      "state_head",
      "client",
      "admin",
    ];

    if (
      !allowedRoles.includes(
        role
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid user role",
      });
    }

    // =================================================
    // EMAIL
    // =================================================

    const normalizedEmail =
      normalizeEmail(email);

    const existingUser =
      await User.findOne({
        email: normalizedEmail,
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "User with this email already exists",
      });
    }

    // =================================================
    // CAMPAIGN ACCESS
    // =================================================

    let normalizedCampaignAccess =
      [];

    if (role !== "admin") {
      const validation =
        await validateCampaignAccess(
          campaign_access
        );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message:
            validation.message,
        });
      }

      normalizedCampaignAccess =
        campaign_access.map(
          (access) => {
            const locations =
              buildLocations(
                access
              );

            const siteCodes =
              parseStringArray(
                access.site_codes
              ).map((code) =>
                code.toUpperCase()
              );

            return {
              campaign_id:
                access.campaign_id,

              locations,

              site_codes:
                siteCodes,
            };
          }
        );

      // ---------------------------------------------
      // LOCATION REQUIRED
      // ---------------------------------------------

      for (const access of normalizedCampaignAccess) {
        if (
          !access.locations.length
        ) {
          return res.status(400).json({
            success: false,
            message:
              "At least one state is required for every campaign",
          });
        }
      }
    }

    // =================================================
    // PASSWORD
    // =================================================

    const hashedPassword =
      await bcrypt.hash(
        password,
        12
      );

    // =================================================
    // FIRST ACCESS
    // =================================================

    const firstAccess =
      normalizedCampaignAccess[0];

    const firstLocation =
      firstAccess?.locations?.[0];

    // =================================================
    // CREATE USER
    // =================================================

    const user =
      await User.create({
        name: String(name).trim(),

        email:
          normalizedEmail,

        phone:
          String(phone).trim(),

        role,

        password:
          hashedPassword,

        zone:
          firstLocation
            ?.zones?.[0] || null,

        state:
          firstLocation
            ?.state || null,

        site_codes:
          firstAccess
            ?.site_codes || [],

        is_active:
          typeof is_active ===
          "boolean"
            ? is_active
            : true,
      });

    // =================================================
    // CREATE CAMPAIGN ASSIGNMENTS
    // =================================================

    if (
      role !== "admin" &&
      normalizedCampaignAccess.length
    ) {
      await CampaignUser.insertMany(
        normalizedCampaignAccess.map(
          (access) => ({
            campaign_id:
              access.campaign_id,

            user_id:
              user._id,

            role,

            locations:
              access.locations,

            site_codes:
              access.site_codes,

            is_active:
              user.is_active,
          })
        )
      );
    }

    // =================================================
    // GET ASSIGNMENTS
    // =================================================

    const assignments =
      await CampaignUser.find({
        user_id:
          user._id,

        is_active: true,
      })
        .populate(
          "campaign_id",
          "name code status"
        )
        .lean();

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(201).json({
      success: true,

      message:
        "User created successfully",

      user: {
        id: user._id,

        name: user.name,

        email: user.email,

        phone: user.phone,

        role: user.role,

        is_active:
          user.is_active,

        campaign_access:
          assignments,
      },
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
        "Failed to create user",
    });
  }
};

// =====================================================
// GET USERS
// =====================================================

const getUsers = async (
  req,
  res
) => {
  try {
    const {
      role,
      campaign_id,
      is_active,
      search,
    } = req.query;

    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (
      is_active !== undefined
    ) {
      filter.is_active =
        is_active === "true";
    }

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    let users =
      await User.find(filter)
        .select("-password")
        .sort({
          createdAt: -1,
        })
        .lean();

    // =================================================
    // CAMPAIGN FILTER
    // =================================================

    if (campaign_id) {
      const assignments =
        await CampaignUser.find({
          campaign_id,
          is_active: true,
        }).select(
          "user_id"
        );

      const userIds =
        assignments.map(
          (item) =>
            item.user_id.toString()
        );

      users = users.filter(
        (user) =>
          userIds.includes(
            user._id.toString()
          )
      );
    }

    // =================================================
    // ASSIGNMENTS
    // =================================================

    const userIds =
      users.map(
        (user) =>
          user._id
      );

    let assignments = [];

    if (userIds.length) {
      assignments =
        await CampaignUser.find({
          user_id: {
            $in: userIds,
          },

          is_active: true,
        })
          .populate(
            "campaign_id",
            "name code status"
          )
          .lean();
    }

    // =================================================
    // MAP
    // =================================================

    const assignmentMap =
      new Map();

    assignments.forEach(
      (assignment) => {
        const userId =
          assignment.user_id.toString();

        if (
          !assignmentMap.has(
            userId
          )
        ) {
          assignmentMap.set(
            userId,
            []
          );
        }

        assignmentMap
          .get(userId)
          .push(assignment);
      }
    );

    // =================================================
    // ATTACH
    // =================================================

    users =
      users.map((user) => ({
        ...user,

        campaign_access:
          assignmentMap.get(
            user._id.toString()
          ) || [],
      }));

    return res.json({
      success: true,

      count:
        users.length,

      users,
    });
  } catch (error) {
    console.error(
      "GET USERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch users",
    });
  }
};

// =====================================================
// GET USER BY ID
// =====================================================

const getUserById = async (
  req,
  res
) => {
  try {
    const user =
      await User.findById(
        req.params.id
      )
        .select("-password")
        .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    const assignments =
      await CampaignUser.find({
        user_id:
          user._id,

        is_active: true,
      })
        .populate(
          "campaign_id",
          "name code status"
        )
        .lean();

    return res.json({
      success: true,

      user: {
        ...user,

        campaign_access:
          assignments,
      },
    });
  } catch (error) {
    console.error(
      "GET USER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch user",
    });
  }
};

// =====================================================
// UPDATE USER
// =====================================================

const updateUser = async (
  req,
  res
) => {
  try {
    if (
      !req.user ||
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin can update users",
      });
    }

    const user =
      await User.findById(
        req.params.id
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    const {
      name,
      email,
      phone,
      role,
      password,
      campaign_access,
      is_active,
    } = req.body;

    // =================================================
    // NAME
    // =================================================

    if (
      name !== undefined
    ) {
      if (
        !String(name).trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Name cannot be empty",
        });
      }

      user.name =
        String(name).trim();
    }

    // =================================================
    // EMAIL
    // =================================================

    if (
      email !== undefined
    ) {
      const normalizedEmail =
        normalizeEmail(email);

      const existingUser =
        await User.findOne({
          email:
            normalizedEmail,

          _id: {
            $ne:
              user._id,
          },
        });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message:
            "User with this email already exists",
        });
      }

      user.email =
        normalizedEmail;
    }

    // =================================================
    // PHONE
    // =================================================

    if (
      phone !== undefined
    ) {
      user.phone =
        String(phone).trim();
    }

    // =================================================
    // ROLE
    // =================================================

    if (
      role !== undefined
    ) {
      const allowedRoles = [
        "vendor_executive",
        "vendor",
        "state_head",
        "client",
        "admin",
      ];

      if (
        !allowedRoles.includes(
          role
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid user role",
        });
      }

      user.role = role;
    }

    // =================================================
    // ACTIVE STATUS
    // =================================================

    if (
      typeof is_active ===
      "boolean"
    ) {
      user.is_active =
        is_active;
    }

    // =================================================
    // PASSWORD
    // =================================================

    if (password) {
      user.password =
        await bcrypt.hash(
          password,
          12
        );

      user.password_changed_at =
        new Date();
    }

    // =================================================
    // CAMPAIGN ACCESS
    // =================================================

    if (
      user.role !== "admin" &&
      campaign_access !==
        undefined
    ) {
      const validation =
        await validateCampaignAccess(
          campaign_access
        );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message:
            validation.message,
        });
      }

      const normalizedCampaignAccess =
        campaign_access.map(
          (access) => ({
            campaign_id:
              access.campaign_id,

            locations:
              buildLocations(
                access
              ),

            site_codes:
              parseStringArray(
                access.site_codes
              ).map((code) =>
                code.toUpperCase()
              ),
          })
        );

      // ---------------------------------------------
      // LOCATION REQUIRED
      // ---------------------------------------------

      for (
        const access of normalizedCampaignAccess
      ) {
        if (
          !access.locations.length
        ) {
          return res.status(400).json({
            success: false,
            message:
              "At least one state is required for every campaign",
          });
        }
      }

      // ---------------------------------------------
      // DEACTIVATE OLD
      // ---------------------------------------------

      await CampaignUser.updateMany(
        {
          user_id:
            user._id,
        },
        {
          $set: {
            is_active: false,
          },
        }
      );

      // ---------------------------------------------
      // UPSERT NEW
      // ---------------------------------------------

      for (
        const access of normalizedCampaignAccess
      ) {
        await CampaignUser.findOneAndUpdate(
          {
            user_id:
              user._id,

            campaign_id:
              access.campaign_id,
          },
          {
            $set: {
              role:
                user.role,

              locations:
                access.locations,

              site_codes:
                access.site_codes,

              is_active:
                user.is_active,
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert:
              true,
          }
        );
      }

      // ---------------------------------------------
      // OLD USER FIELDS
      // ---------------------------------------------

      const firstAccess =
        normalizedCampaignAccess[0];

      const firstLocation =
        firstAccess
          ?.locations?.[0];

      user.state =
        firstLocation
          ?.state || null;

      user.zone =
        firstLocation
          ?.zones?.[0] || null;

      user.site_codes =
        firstAccess
          ?.site_codes || [];
    }

    // =================================================
    // ADMIN
    // =================================================

    if (
      user.role === "admin"
    ) {
      await CampaignUser.updateMany(
        {
          user_id:
            user._id,
        },
        {
          $set: {
            is_active: false,
          },
        }
      );
    }

    // =================================================
    // SAVE
    // =================================================

    await user.save();

    // =================================================
    // UPDATED ACCESS
    // =================================================

    const assignments =
      await CampaignUser.find({
        user_id:
          user._id,

        is_active: true,
      })
        .populate(
          "campaign_id",
          "name code status"
        )
        .lean();

    return res.json({
      success: true,

      message:
        "User updated successfully",

      user: {
        id: user._id,

        name: user.name,

        email: user.email,

        phone: user.phone,

        role: user.role,

        is_active:
          user.is_active,

        campaign_access:
          assignments,
      },
    });
  } catch (error) {
    console.error(
      "UPDATE USER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update user",
    });
  }
};

// =====================================================
// UPDATE USER STATUS
// =====================================================

const updateUserStatus =
  async (req, res) => {
    try {
      const {
        is_active,
      } = req.body;

      if (
        typeof is_active !==
        "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "is_active must be boolean",
        });
      }

      const user =
        await User.findByIdAndUpdate(
          req.params.id,
          {
            $set: {
              is_active,
            },
          },
          {
            new: true,
          }
        ).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found",
        });
      }

      // Disable all campaign access
      if (!is_active) {
        await CampaignUser.updateMany(
          {
            user_id:
              user._id,
          },
          {
            $set: {
              is_active:
                false,
            },
          }
        );
      }

      return res.json({
        success: true,

        message:
          "User status updated successfully",

        user,
      });
    } catch (error) {
      console.error(
        "UPDATE STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update user status",
      });
    }
  };

// =====================================================
// DELETE USER
// =====================================================

const deleteUser = async (
  req,
  res
) => {
  try {
    const user =
      await User.findById(
        req.params.id
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    await CampaignUser.deleteMany({
      user_id:
        user._id,
    });

    await User.findByIdAndDelete(
      user._id
    );

    return res.json({
      success: true,

      message:
        "User deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE USER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete user",
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser,
};