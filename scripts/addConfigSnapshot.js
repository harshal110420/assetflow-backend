// scripts/addConfigSnapshot.js
// Run: node scripts/addConfigSnapshot.js

const sequelize = require("../config/database"); // tera existing db config

async function migrate() {
  try {
    const queryInterface = sequelize.getQueryInterface();

    // Check karo column already exist karta hai kya
    const tableDesc = await queryInterface.describeTable("assignments");
    if (tableDesc.configSnapshot) {
      console.log("✅ configSnapshot already exists — skipping");
      process.exit(0);
    }

    await queryInterface.addColumn("assignments", "configSnapshot", {
      type: sequelize.Sequelize
        ? sequelize.Sequelize.JSON
        : require("sequelize").DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    });

    console.log("✅ configSnapshot column added successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

migrate();
