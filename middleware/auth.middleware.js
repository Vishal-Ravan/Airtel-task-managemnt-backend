const jwt = require("jsonwebtoken");

const User = require("../models/User");

const authMiddleware = async (
    req,
    res,
    next
) => {

    try {

        const authHeader =
            req.headers.authorization;


        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required"

            });

        }


        const token =
            authHeader.split(" ")[1];


        if (!token) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid authentication token"

            });

        }


        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        const user =
            await User.findById(
                decoded.id
            ).select("-password");


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "User not found"

            });

        }


        if (!user.is_active) {

            return res.status(403).json({

                success: false,

                message:
                    "Your account is inactive"

            });

        }


        req.user = user;


        next();


    } catch (error) {

        if (
            error.name ===
            "TokenExpiredError"
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Session expired. Please login again."

            });

        }


        return res.status(401).json({

            success: false,

            message:
                "Invalid authentication token"

        });

    }

};


module.exports =
    authMiddleware;