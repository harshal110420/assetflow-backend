"use strict";

module.exports = {
  // ── UP — column add karo ──────────────────────────────────────────────────
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("assignments", "configSnapshot", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: "Asset customFields snapshot at time of assignment",
    });

    console.log("✅ configSnapshot column added to assignments table");
  },

  // ── DOWN — column remove karo (rollback) ──────────────────────────────────
  async down(queryInterface) {
    await queryInterface.removeColumn("assignments", "configSnapshot");
    console.log("↩️  configSnapshot column removed from assignments table");
  },
};
