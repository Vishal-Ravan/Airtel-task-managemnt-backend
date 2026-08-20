const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// ========================================
// MIDDLEWARE
// ========================================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// ========================================
// STATIC UPLOADS
// ========================================

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// ========================================
// HEALTH CHECK
// ========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Vendor Site Management API is running",
  });
});

// ========================================
// ROUTES
// ========================================

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const siteRoutes = require("./routes/site.routes");
const submissionRoutes = require("./routes/submission.routes");
const approvalRoutes = require("./routes/approval.routes");
const campaignRoutes =
  require("./routes/campaign.routes");

  
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/approvals", approvalRoutes);
app.use(
  "/api/campaigns",campaignRoutes);
// ========================================
// 404
// ========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API not found: ${req.method} ${req.originalUrl}`,
  });
});

// ========================================
// GLOBAL ERROR
// ========================================

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

module.exports = app;