const { AuditLog } = require("../models");
const { Op } = require("sequelize");
const User = require("../models/User");

// ── Helpers ──────────────────────────────────────────────────────────────────

const parseFilters = (query, tenantId) => {
  const {
    entityType,
    action,
    userId,
    search,
    dateFrom,
    dateTo,
    cursor,
    limit = 50,
  } = query;

  const where = { tenantId };

  if (entityType) where.entityType = entityType;
  if (action) where.action = action;
  if (userId) where.userId = userId;

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt[Op.lte] = end;
    }
  }

  // Cursor — createdAt based
  if (cursor) {
    const cursorDate = new Date(Buffer.from(cursor, "base64").toString());
    where.createdAt = {
      ...where.createdAt,
      [Op.lt]: cursorDate,
    };
  }

  // Description search — debounced on frontend, min 3 chars
  if (search && search.trim().length >= 3) {
    where.description = { [Op.like]: `%${search.trim()}%` };
  }

  return { where, limit: Math.min(parseInt(limit), 100) };
};

const formatCursor = (date) =>
  Buffer.from(new Date(date).toISOString()).toString("base64");

// ── Controllers ──────────────────────────────────────────────────────────────

// GET /api/audit-logs
exports.getAuditLogs = async (req, res) => {
  try {
    const { where, limit } = parseFilters(req.query, req.user.tenantId);

    const logs = await AuditLog.findAll({
      where,
      attributes: [
        "id",
        "entityType",
        "entityId",
        "action",
        "description",
        "userId",
        "ipAddress",
        "createdAt",
        // oldValues & newValues intentionally excluded — heavy JSON
      ],
      order: [["createdAt", "DESC"]],
      limit: limit + 1, // +1 to check if hasMore
    });

    const hasMore = logs.length > limit;
    const data = hasMore ? logs.slice(0, limit) : logs;

    const nextCursor = hasMore
      ? formatCursor(data[data.length - 1].createdAt)
      : null;

    return res.json({
      success: true,
      data,
      pagination: { hasMore, nextCursor, limit },
    });
  } catch (err) {
    console.error("getAuditLogs error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/audit-logs/:id/detail
// Called only when user opens side drawer — fetches heavy JSON
exports.getAuditLogDetail = async (req, res) => {
  try {
    const log = await AuditLog.findOne({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
      },
      attributes: ["id", "oldValues", "newValues", "userAgent", "ipAddress"],
    });

    if (!log) {
      return res.status(404).json({ success: false, message: "Log not found" });
    }

    return res.json({ success: true, data: log });
  } catch (err) {
    console.error("getAuditLogDetail error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/audit-logs/entity/:entityType/:entityId
// Asset ya Employee detail page ke liye — us entity ki history
exports.getEntityHistory = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit = 20, cursor } = req.query;

    const where = {
      tenantId: req.user.tenantId,
      entityType,
      entityId,
    };

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, "base64").toString());
      where.createdAt = { [Op.lt]: cursorDate };
    }

    const parsedLimit = Math.min(parseInt(limit), 50);

    const logs = await AuditLog.findAll({
      where,
      attributes: ["id", "action", "description", "userId", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit: parsedLimit + 1,
    });

    const hasMore = logs.length > parsedLimit;
    const data = hasMore ? logs.slice(0, parsedLimit) : logs;
    const nextCursor = hasMore
      ? formatCursor(data[data.length - 1].createdAt)
      : null;

    return res.json({
      success: true,
      data,
      pagination: { hasMore, nextCursor },
    });
  } catch (err) {
    console.error("getEntityHistory error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
