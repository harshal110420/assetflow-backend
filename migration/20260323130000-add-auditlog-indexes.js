// migrations/XXXXXX-add-auditlog-indexes.js
"use strict";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addIndex("audit_logs", ["createdAt"], {
      name: "audit_logs_created_at_idx",
    });
    await queryInterface.addIndex("audit_logs", ["action"], {
      name: "audit_logs_action_idx",
    });
    await queryInterface.addIndex("audit_logs", ["userId"], {
      name: "audit_logs_user_id_idx",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("audit_logs", "audit_logs_created_at_idx");
    await queryInterface.removeIndex("audit_logs", "audit_logs_action_idx");
    await queryInterface.removeIndex("audit_logs", "audit_logs_user_id_idx");
  },
};
