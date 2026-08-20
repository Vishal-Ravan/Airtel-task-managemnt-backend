const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const uploadDir = path.join(
    __dirname,
    "../uploads/sites"
);

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
        recursive: true
    });
}

const optimizeImage = async (fileBuffer) => {

    const filename =
        crypto.randomUUID() + ".webp";

    const outputPath =
        path.join(uploadDir, filename);

    await sharp(fileBuffer)
        .rotate()
        .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true
        })
        .webp({
            quality: 75
        })
        .toFile(outputPath);

    return `/uploads/sites/${filename}`;
};

module.exports = {
    optimizeImage
};