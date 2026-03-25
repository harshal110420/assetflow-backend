/**
 * APPROVAL ENGINE
 * ───────────────
 * Ye core logic hai jo approval workflow handle karta hai.
 *
 * Kaise kaam karta hai:
 * 1. Admin ek Template banata hai (e.g. "Asset Assignment Approval")
 * 2. Template mein steps hote hain (Step 1: Manager, Step 2: HOD)
 * 3. Jab koi action hota hai (e.g. asset assign) → Request create hoti hai
 * 4. Engine resolve karta hai ki Step 1 ka actual approver kaun hai
 * 5. Approver ko email jaati hai
 * 6. Approver approve/reject karta hai → next step ya finalize
 */

const { Op } = require("sequelize");
const {
  ApprovalTemplate,
  ApprovalTemplateStep,
  ApprovalRequest,
  ApprovalRequestStep,
} = require("../models/Approval");
const User = require("../models/User");
const {
  sendApprovalRequestEmail,
  sendApprovalActionEmail,
} = require("./emailService");

// ─── Generate Request Number ──────────────────────────────────────────────────
// tenantId pass karo — request number per tenant unique hoga
const generateRequestNumber = async (tenantId) => {
  const year = new Date().getFullYear();
  const count = await ApprovalRequest.count({
    where: {
      tenantId, // ← ADD
      createdAt: { [Op.gte]: new Date(`${year}-01-01`) },
    },
  });
  return `APR-${year}-${String(count + 1).padStart(4, "0")}`;
};

// ─── Resolve Approver ─────────────────────────────────────────────────────────
// Given a template step, figure out the actual userId of the approver
// tenantId pass karo — sirf usi tenant ke users mein dhundho
const resolveApprover = async (templateStep, requestedByUserId, tenantId) => {
  const { approverType, approverValue } = templateStep;

  if (approverType === "specific_user") {
    // Fixed person — approverValue = userId
    // tenantId check — doosri company ka user approver na ban jaye
    const user = await User.findOne({
      where: { id: approverValue, tenantId, isActive: true }, // ← ADD tenantId
    });
    if (!user)
      throw new Error(
        `Approver user not found or inactive for step: ${templateStep.stepName}`,
      );
    return user.id;
  }

  if (approverType === "role") {
    // Any active user with this role — sirf usi tenant mein dhundho
    const user = await User.findOne({
      where: { role: approverValue, tenantId, isActive: true }, // ← ADD tenantId
      order: [["createdAt", "ASC"]],
    });
    if (!user)
      throw new Error(
        `No active user found with role '${approverValue}' for step: ${templateStep.stepName}`,
      );
    return user.id;
  }

  if (approverType === "reporting_manager") {
    // Dynamic — find the requester's direct manager
    const requester = await User.findOne({
      where: { id: requestedByUserId, tenantId }, // ← ADD tenantId
    });
    console.log("requester:", requester);

    if (!requester?.reportingManagerId) {
      throw new Error(
        `No reporting manager set for user. Please configure reporting manager in user settings.`,
      );
    }

    // Manager bhi same tenant ka hona chahiye
    const manager = await User.findOne({
      where: { id: requester.reportingManagerId, tenantId, isActive: true }, // ← ADD tenantId
    });
    console.log("manager:", manager);

    if (!manager)
      throw new Error(`Reporting manager is inactive or not found.`);
    return manager.id;
  }

  throw new Error(`Unknown approverType: ${approverType}`);
};

// ─── Check Step Condition ─────────────────────────────────────────────────────
// Returns true if step should be executed, false if it should be skipped
const checkStepCondition = (templateStep, moduleData) => {
  if (!templateStep.isConditional) return true;

  const { conditionField, conditionOperator, conditionValue } = templateStep;
  const fieldValue = moduleData[conditionField];

  if (fieldValue === undefined || fieldValue === null) return false;

  const numericValue = parseFloat(conditionValue);
  const numericField = parseFloat(fieldValue);

  switch (conditionOperator) {
    case ">":
      return numericField > numericValue;
    case "<":
      return numericField < numericValue;
    case ">=":
      return numericField >= numericValue;
    case "<=":
      return numericField <= numericValue;
    case "=":
      return String(fieldValue) === String(conditionValue);
    case "!=":
      return String(fieldValue) !== String(conditionValue);
    default:
      return true;
  }
};

// ─── CREATE APPROVAL REQUEST ──────────────────────────────────────────────────
const createRequest = async ({
  module,
  moduleRecordId,
  requestedById,
  tenantId, // ← ADD — caller se aayega
  moduleData = {},
  priority = "normal",
  appUrl,
}) => {
  // Sirf usi tenant ka active template dhundho
  const template = await ApprovalTemplate.findOne({
    where: { module, isActive: true, tenantId }, // ← ADD tenantId
    include: [
      {
        model: ApprovalTemplateStep,
        order: [["stepOrder", "ASC"]],
      },
    ],
  });

  if (!template) {
    // No approval template configured → auto-approve
    console.log(
      `[APPROVAL] No template for module '${module}' (tenant: ${tenantId}) → auto-approved`,
    );
    return { autoApproved: true };
  }

  const steps = template.ApprovalTemplateSteps || [];
  if (steps.length === 0) return { autoApproved: true };

  const requestNumber = await generateRequestNumber(tenantId); // ← ADD tenantId

  // Create the main request
  const request = await ApprovalRequest.create({
    requestNumber,
    templateId: template.id,
    module,
    moduleRecordId,
    moduleData,
    requestedById,
    tenantId, // ← ADD
    currentStepOrder: 1,
    status: "pending",
    priority,
  });

  // Create step instances — resolve actual approvers
  let firstActiveStepCreated = false;

  for (const templateStep of steps) {
    const shouldExecute = checkStepCondition(templateStep, moduleData);

    if (!shouldExecute) {
      await ApprovalRequestStep.create({
        requestId: request.id,
        templateStepId: templateStep.id,
        tenantId, // ← ADD
        stepOrder: templateStep.stepOrder,
        stepName: templateStep.stepName,
        assignedToUserId: requestedById, // placeholder
        status: "skipped",
        actionAt: new Date(),
      });
      continue;
    }

    // Resolve actual approver — tenantId pass karo
    let assignedToUserId;
    try {
      assignedToUserId = await resolveApprover(
        templateStep,
        requestedById,
        tenantId,
      ); // ← ADD tenantId
    } catch (err) {
      await request.destroy();
      throw err;
    }

    await ApprovalRequestStep.create({
      requestId: request.id,
      templateStepId: templateStep.id,
      tenantId, // ← ADD
      stepOrder: templateStep.stepOrder,
      stepName: templateStep.stepName,
      assignedToUserId,
      status: templateStep.stepOrder === 1 ? "pending" : "pending",
    });

    // Send email to first step approver
    if (!firstActiveStepCreated) {
      firstActiveStepCreated = true;

      const approver = await User.findOne({
        where: { id: assignedToUserId, tenantId },
      }); // ← ADD tenantId
      const requester = await User.findOne({
        where: { id: requestedById, tenantId },
      }); // ← ADD tenantId

      if (approver && requester) {
        sendApprovalRequestEmail({
          approver,
          requester,
          request,
          asset: moduleData,
          appUrl: appUrl || process.env.FRONTEND_URL,
        }).catch((err) => console.error("[EMAIL ERROR]", err.message));

        await ApprovalRequestStep.update(
          { notifiedAt: new Date() },
          { where: { requestId: request.id, tenantId, stepOrder: 1 } }, // ← ADD tenantId
        );
      }
    }
  }

  return { autoApproved: false, request };
};

// ─── PROCESS ACTION (Approve / Reject) ───────────────────────────────────────
const processAction = async ({
  requestId,
  actionByUserId,
  action,
  remarks,
  appUrl,
}) => {
  const request = await ApprovalRequest.findByPk(requestId, {
    include: [{ model: ApprovalRequestStep, order: [["stepOrder", "ASC"]] }],
  });

  if (!request) throw new Error("Approval request not found");
  if (request.status !== "pending")
    throw new Error(`Request is already ${request.status}`);

  // tenantId request se lo — baaki operations mein use karo
  const tenantId = request.tenantId;

  // Find current pending step
  const currentStep = request.ApprovalRequestSteps.find(
    (s) => s.stepOrder === request.currentStepOrder && s.status === "pending",
  );

  if (!currentStep)
    throw new Error("No pending step found for current step order");
  if (currentStep.assignedToUserId !== actionByUserId)
    throw new Error("You are not authorized to action this step");

  await currentStep.update({ status: action, remarks, actionAt: new Date() });

  // Sirf usi tenant ke users fetch karo
  const requester = await User.findOne({
    where: { id: request.requestedById, tenantId },
  }); // ← ADD tenantId
  const approver = await User.findOne({
    where: { id: actionByUserId, tenantId },
  }); // ← ADD tenantId

  if (action === "rejected") {
    await request.update({
      status: "rejected",
      finalizedById: actionByUserId,
      finalizedAt: new Date(),
      finalRemarks: remarks,
    });

    // Skip remaining steps — tenantId filter
    await ApprovalRequestStep.update(
      { status: "skipped", actionAt: new Date() },
      { where: { requestId, tenantId, status: "pending" } }, // ← ADD tenantId
    );

    sendApprovalActionEmail({
      requester,
      approver,
      request,
      asset: request.moduleData,
      action: "rejected",
      remarks,
    }).catch(console.error);

    return { status: "rejected", request };
  }

  if (action === "approved") {
    const nextStep = request.ApprovalRequestSteps.find(
      (s) => s.stepOrder > request.currentStepOrder && s.status === "pending",
    );

    if (nextStep) {
      await request.update({ currentStepOrder: nextStep.stepOrder });

      // Next approver — sirf usi tenant ka
      const nextApprover = await User.findOne({
        where: { id: nextStep.assignedToUserId, tenantId }, // ← ADD tenantId
      });

      if (nextApprover) {
        sendApprovalRequestEmail({
          approver: nextApprover,
          requester,
          request,
          asset: request.moduleData,
          appUrl: appUrl || process.env.FRONTEND_URL,
        }).catch(console.error);

        await nextStep.update({ notifiedAt: new Date() });
      }

      return { status: "next_step", stepOrder: nextStep.stepOrder, request };
    } else {
      // All steps done → fully approved
      await request.update({
        status: "approved",
        finalizedById: actionByUserId,
        finalizedAt: new Date(),
        finalRemarks: remarks,
      });

      sendApprovalActionEmail({
        requester,
        approver,
        request,
        asset: request.moduleData,
        action: "approved",
        remarks,
      }).catch(console.error);

      return { status: "approved", request };
    }
  }

  throw new Error(`Unknown action: ${action}`);
};

// ─── GET PENDING APPROVALS FOR USER ──────────────────────────────────────────
// tenantId parameter add kiya — sirf usi tenant ke pending approvals
const getPendingApprovalsForUser = async (userId, tenantId) => {
  // ← ADD tenantId param
  const steps = await ApprovalRequestStep.findAll({
    where: {
      assignedToUserId: userId,
      tenantId, // ← ADD — sirf usi tenant ke steps
      status: "pending",
    },
    include: [
      {
        model: ApprovalRequest,
        where: { status: "pending", tenantId }, // ← ADD tenantId
        include: [
          {
            model: User,
            as: "requestedBy",
            attributes: [
              "id",
              "firstName",
              "lastName",
              "email",
              "departmentId",
            ],
          },
        ],
      },
    ],
    order: [["createdAt", "ASC"]],
  });

  return steps;
};

module.exports = {
  createRequest,
  processAction,
  getPendingApprovalsForUser,
  resolveApprover,
  checkStepCondition,
};
