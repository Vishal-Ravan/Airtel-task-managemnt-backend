const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    const email = "admin@gmail.com";
    const password = "123456";
    

    const existingAdmin = await User.findOne({
      email,
    });

    if (existingAdmin) {
      console.log("Admin already exists");

      console.log({
        email,
        password,
      });

      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const admin = await User.create({
      name: "System Admin",
      email,
      phone:"7562939752",
      password: hashedPassword,
      role: "admin",
      is_active: true,
    });

    console.log("=================================");
    console.log("ADMIN CREATED SUCCESSFULLY");
    console.log("=================================");
    console.log("ID:", admin._id);
    console.log("Email:", email);
    console.log("Password:", password);
    console.log("Role:", admin.role);

    process.exit(0);

  } catch (error) {
    console.error(
      "CREATE ADMIN ERROR:",
      error
    );

    process.exit(1);
  }
};

createAdmin();