const multer = require("multer");

const storage =
  multer.memoryStorage();

const fileFilter = (
  req,
  file,
  cb
) => {
  const allowedExtensions = [
    ".xlsx",
    ".xls",
    ".csv",
  ];

  const fileName =
    file.originalname.toLowerCase();

  const isAllowed =
    allowedExtensions.some(
      (extension) =>
        fileName.endsWith(extension)
    );

  if (!isAllowed) {
    return cb(
      new Error(
        "Only Excel or CSV files are allowed"
      )
    );
  }

  cb(null, true);
};

const campaignUpload =
  multer({
    storage,
    limits: {
      fileSize:
        10 * 1024 * 1024,
    },
    fileFilter,
  });

module.exports = campaignUpload;