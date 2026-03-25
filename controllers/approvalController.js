const {
  ApprovalTemplate,
  ApprovalTemplateStep,
  ApprovalRequest,
  ApprovalRequestStep,
} = require("../models/Approval");
const User = require("../models/User");
const { AuditLog } = require("../models/index");
const approvalEngine = require("../services/approvalEngine");
const { Op } = require("sequelize");
const socketService = require("../socket");

// ─── TEMPLATE MANAGEMENT ──────────────────────────────────────────────────────

exports.getTemplates = async (req, res) => {
  try {
    const templates = await ApprovalTemplate.findAll({
      where: { tenantId: req.user.tenantId },
      include: [{ model: ApprovalTemplateStep, order: [["stepOrder", "ASC"]] }],
      order: [["createdAt", "DESC"]],
    });
    res.json({ success: true, data: templates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const { name, description, module, steps = [] } = req.body;

    if (!name || !module)
      return res
        .status(400)
        .json({ success: false, message: "Name and module are required" });
    if (steps.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "At least one step is required" });

    const template = await ApprovalTemplate.create({
      name,
      description,
      module,
      tenantId: req.user.tenantId,
      createdById: req.user.id,
    });

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await ApprovalTemplateStep.create({
        templateId: template.id,
        tenantId: req.user.tenantId,
        stepOrder: i + 1,
        stepName: step.stepName,
        approverType: step.approverType,
        approverValue: step.approverValue || null,
        isConditional: step.isConditional || false,
        conditionField: step.conditionField || null,
        conditionOperator: step.conditionOperator || null,
        conditionValue: step.conditionValue || null,
        isOptional: step.isOptional || false,
        autoApproveHours: step.autoApproveHours || 0,
        remarks: step.remarks || null,
      });
    }

    const created = await ApprovalTemplate.findByPk(template.id, {
      include: [{ model: ApprovalTemplateStep, order: [["stepOrder", "ASC"]] }],
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "ApprovalTemplate",
      entityId: template.id,
      tenantId: req.user.tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: created.toJSON(),
      description: `Approval template "${name}" created for module "${module}"`,
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { name, description, module, isActive, steps } = req.body;

    const template = await ApprovalTemplate.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!template)
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });

    const oldValues = template.toJSON();
    await template.update({ name, description, module, isActive });

    if (steps) {
      await ApprovalTemplateStep.destroy({
        where: { templateId: template.id, tenantId: req.user.tenantId },
      });
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await ApprovalTemplateStep.create({
          templateId: template.id,
          tenantId: req.user.tenantId,
          stepOrder: i + 1,
          stepName: step.stepName,
          approverType: step.approverType,
          approverValue: step.approverValue || null,
          isConditional: step.isConditional || false,
          conditionField: step.conditionField || null,
          conditionOperator: step.conditionOperator || null,
          conditionValue: step.conditionValue || null,
          isOptional: step.isOptional || false,
          autoApproveHours: step.autoApproveHours || 0,
        });
      }
    }

    const updated = await ApprovalTemplate.findByPk(template.id, {
      include: [{ model: ApprovalTemplateStep, order: [["stepOrder", "ASC"]] }],
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "ApprovalTemplate",
      entityId: template.id,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      oldValues,
      newValues: updated.toJSON(),
      description: `Approval template "${template.name}" updated`,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const template = await ApprovalTemplate.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!template)
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });

    const pendingCount = await ApprovalRequest.count({
      where: {
        templateId: template.id,
        tenantId: req.user.tenantId,
        status: "pending",
      },
    });
    if (pendingCount > 0)
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${pendingCount} pending requests use this template`,
      });

    const oldValues = template.toJSON();
    await ApprovalTemplateStep.destroy({
      where: { templateId: template.id, tenantId: req.user.tenantId },
    });
    await template.destroy();

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "ApprovalTemplate",
      entityId: req.params.id,
      tenantId: req.user.tenantId,
      action: "DELETE",
      userId: req.user.id,
      oldValues,
      description: `Approval template "${oldValues.name}" deleted`,
    });

    res.json({ success: true, message: "Template deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── APPROVAL REQUESTS ────────────────────────────────────────────────────────

exports.getMyPendingApprovals = async (req, res) => {
  try {
    const steps = await approvalEngine.getPendingApprovalsForUser(
      req.user.id,
      req.user.tenantId,
    );
    res.json({ success: true, data: steps, count: steps.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllRequests = async (req, res) => {
  try {
    const { status, module, page = 1, limit = 20 } = req.query;

    const where = { tenantId: req.user.tenantId };
    if (status) where.status = status;
    if (module) where.module = module;
    if (req.user.role !== "admin") where.requestedById = req.user.id;

    const { count, rows } = await ApprovalRequest.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "requestedBy",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: ApprovalRequestStep,
          include: [
            {
              model: User,
              as: "assignedTo",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRequest = async (req, res) => {
  try {
    const request = await ApprovalRequest.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: [
        {
          model: User,
          as: "requestedBy",
          attributes: ["id", "firstName", "lastName", "email", "department"],
        },
        {
          model: ApprovalRequestStep,
          include: [
            {
              model: User,
              as: "assignedTo",
              attributes: ["id", "firstName", "lastName", "email"],
            },
          ],
          order: [["stepOrder", "ASC"]],
        },
        { model: ApprovalTemplate, attributes: ["id", "name", "module"] },
      ],
    });
    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.takeAction = async (req, res) => {
  try {
    const { action, remarks } = req.body;
    if (!["approved", "rejected"].includes(action))
      return res.status(400).json({
        success: false,
        message: "Action must be approved or rejected",
      });

    const request = await ApprovalRequest.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });

    const result = await approvalEngine.processAction({
      requestId: req.params.id,
      actionByUserId: req.user.id,
      action,
      remarks,
      appUrl: process.env.FRONTEND_URL,
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "ApprovalRequest",
      entityId: request.id,
      tenantId: req.user.tenantId,
      action: action.toUpperCase(),
      userId: req.user.id,
      newValues: { action, remarks, requestNumber: request.requestNumber },
      description: `Approval request ${request.requestNumber} ${action} by user`,
    });

    if (result.status === "approved") {
      await executeApprovedAction(result.request);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Execute Action After Full Approval ──────────────────────────────────────

const executeApprovedAction = async (request) => {
  try {
    const Asset = require("../models/Asset");
    const { Assignment, AuditLog } = require("../models/index");
    const { _executeAssignment } = require("./assetController");

    const tenantId = request.tenantId;

    if (request.module === "asset_assignment") {
      const {
        assetId,
        assignmentType,
        employeeId,
        departmentId,
        locationId,
        purpose,
        notes,
        conditionAtAssignment,
      } = request.moduleData;

      const asset = await Asset.findOne({ where: { id: assetId, tenantId } });
      if (!asset) throw new Error("Asset not found");

      await _executeAssignment({
        asset,
        assignmentType,
        employeeId: assignmentType === "employee" ? employeeId : null,
        departmentId: assignmentType === "department" ? departmentId : null,
        locationId: assignmentType === "location" ? locationId : null,
        assignedById: request.requestedById,
        purpose,
        notes,
        conditionAtAssignment,
      });

      // ── Audit Log ───────────────────────────────────────────────────────────
      await AuditLog.create({
        entityType: "Asset",
        entityId: assetId,
        tenantId,
        action: "ASSIGNED",
        userId: request.requestedById,
        newValues: {
          assignmentType,
          purpose,
          requestNumber: request.requestNumber,
        },
        description: `Asset assigned after approval — ${request.requestNumber}`,
      });
    }

    if (request.module === "asset_disposal") {
      const { assetId, reason, disposalMethod } = request.moduleData;

      await Assignment.update(
        { isActive: false, returnedAt: new Date() },
        { where: { assetId, tenantId, isActive: true } },
      );
      await Asset.update(
        {
          status: "Disposed",
          assignmentType: "pool",
          assignedToId: null,
          assignedToDeptId: null,
          assignedToLocId: null,
        },
        { where: { id: assetId, tenantId } },
      );

      // ── Audit Log ───────────────────────────────────────────────────────────
      await AuditLog.create({
        entityType: "Asset",
        entityId: assetId,
        tenantId,
        action: "DISPOSED",
        userId: request.requestedById,
        newValues: {
          status: "Disposed",
          reason,
          disposalMethod,
          requestNumber: request.requestNumber,
        },
        description: `Asset disposed after approval — ${request.requestNumber}`,
      });
    }

    if (request.module === "asset_transfer") {
      const {
        assetId,
        toAssignmentType,
        employeeId,
        departmentId,
        locationId,
        targetName,
        reason,
        notes,
      } = request.moduleData;

      const asset = await Asset.findOne({ where: { id: assetId, tenantId } });
      if (!asset) throw new Error("Asset not found");

      if (toAssignmentType === "pool") {
        await Assignment.update(
          { isActive: false, returnedAt: new Date() },
          { where: { assetId, tenantId, isActive: true } },
        );
        await asset.update({
          assignmentType: "pool",
          assignedToId: null,
          assignedToDeptId: null,
          assignedToLocId: null,
        });
      } else {
        await _executeAssignment({
          asset,
          assignmentType: toAssignmentType,
          employeeId: toAssignmentType === "employee" ? employeeId : null,
          departmentId: toAssignmentType === "department" ? departmentId : null,
          locationId: toAssignmentType === "location" ? locationId : null,
          assignedById: request.requestedById,
          notes: `Transferred after approval — ${reason || notes || ""} — ${request.requestNumber}`,
        });
      }

      // ── Audit Log ───────────────────────────────────────────────────────────
      await AuditLog.create({
        entityType: "Asset",
        entityId: assetId,
        tenantId,
        action: "TRANSFERRED",
        userId: request.requestedById,
        newValues: {
          toAssignmentType,
          targetName,
          reason,
          requestNumber: request.requestNumber,
        },
        description: `Asset transferred after approval — ${request.requestNumber} → ${toAssignmentType}: ${targetName}`,
      });
    }
  } catch (err) {
    console.error("[APPROVAL] Error executing approved action:", err.message);
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    const request = await ApprovalRequest.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });

    if (request.requestedById !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this request",
      });
    }
    if (request.status !== "pending")
      return res.status(400).json({
        success: false,
        message: "Only pending requests can be cancelled",
      });

    await request.update({ status: "cancelled", finalizedAt: new Date() });
    await ApprovalRequestStep.update(
      { status: "skipped" },
      {
        where: {
          requestId: request.id,
          tenantId: req.user.tenantId,
          status: "pending",
        },
      },
    );

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "ApprovalRequest",
      entityId: request.id,
      tenantId: req.user.tenantId,
      action: "CANCELLED",
      userId: req.user.id,
      newValues: { status: "cancelled", requestNumber: request.requestNumber },
      description: `Approval request ${request.requestNumber} cancelled`,
    });

    res.json({ success: true, message: "Request cancelled" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
