const jwt = require("jsonwebtoken");

const generateAccessToken = (user) => {

    return jwt.sign(
        {
            id: user._id.toString(),
            role: user.role
        },

        process.env.JWT_SECRET,

        {
            expiresIn:
                process.env.JWT_EXPIRES_IN || "1m"
        }
    );
};

module.exports = {
    generateAccessToken
};