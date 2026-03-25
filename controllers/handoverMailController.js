// ─── handoverMailController.js ────────────────────────────────────────────────
// POST /api/assets/:id/send-handover-mail
// Sends Asset Handover Form PDF to assigned employee
// Uses existing emailService (tenant-aware nodemailer)
// Priority: DB Settings (company.*) → process.env → hardcoded defaults
// ─────────────────────────────────────────────────────────────────────────────
const { AuditLog } = require("../models/index");
const Asset = require("../models/Asset");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const { Assignment } = require("../models/index");
const { Category, SubCategory } = require("../models/index");
const User = require("../models/User");
const Setting = require("../models/Setting");
const { sendEmail } = require("../services/emailService"); // ✅ existing service
const PDFDocument = require("pdfkit"); // npm install pdfkit

// ─── helpers ──────────────────────────────────────────────────────────────────
const sv = (v) => (v != null && v !== "" ? String(v) : "—");

function hLine(doc, x1, y, x2, color = "#cbd5e1", lw = 0.5) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(lw).stroke();
}

// Parse customFields — supports both object and array formats
function parseCustomFields(cf) {
  if (!cf) return [];
  if (typeof cf === "string") {
    try {
      cf = JSON.parse(cf);
    } catch {
      return [];
    }
  }
  if (Array.isArray(cf)) return cf.filter((f) => f.key);
  if (typeof cf === "object") {
    return Object.entries(cf).map(([key, value]) => ({
      key,
      value: String(value ?? ""),
    }));
  }
  return [];
}

// ─── Color Palette ────────────────────────────────────────────────────────────
const C = {
  headerBg: "#1e40af",
  headerText: "#ffffff",
  headerSub: "#bfdbfe",
  accentBar: "#3b82f6",
  sectionBg: "#eff6ff",
  sectionBdr: "#bfdbfe",
  sectionAcct: "#1e40af",
  tableHdr: "#1e3a8a",
  tableHdrTxt: "#ffffff",
  tableRow1: "#f8fafc",
  tableRow2: "#ffffff",
  tableRel: "#e2e8f0",
  labelTxt: "#1e3a8a",
  valueTxt: "#111827",
  bodyTxt: "#374151",
  mutedTxt: "#6b7280",
  termsBg: "#fefce8",
  termsBdr: "#fde68a",
  termsAcct: "#f59e0b",
  sigBg: "#f8fafc",
  sigBdr: "#e2e8f0",
  sigLine: "#94a3b8",
  footerBg: "#1e3a8a",
  footerTxt: "#bfdbfe",
  footerMuted: "#93c5fd",
  configBg: "#f0fdf4",
  configBdr: "#bbf7d0",
  configAcct: "#22c55e",
};

// ═════════════════════════════════════════════════════════════════════════════
// PDF GENERATOR
// ═════════════════════════════════════════════════════════════════════════════
function generateHandoverPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "portrait",
      margin: 0,
      info: { Title: "Asset Handover Letter", Author: "AssetFlow AMS" },
    });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const {
      asset,
      employee,
      assignment,
      assignedByUser,
      transferNo,
      // ── Priority: DB → .env → hardcoded defaults ──────────────────────────
      companyName,
      companyAddress,
      companyContact,
      itDeptEmail,
    } = data;

    const PW = 595.28;
    const PH = 841.89;
    const L = 44;
    const R = PW - 44;
    const W = R - L; // ~507

    // Parse customFields
    const configFields = parseCustomFields(asset.customFields);

    const handoverDate = new Date(assignment.assignedAt).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      },
    );
    const assignedByName = assignedByUser
      ? `${assignedByUser.firstName} ${assignedByUser.lastName}`
      : "—";

    // ══════════════════════════════════════════════════════════════════════════
    // HEADER
    // ══════════════════════════════════════════════════════════════════════════
    const hdrH = 68;
    doc.rect(0, 0, PW, hdrH).fillColor(C.headerBg).fill();
    doc.rect(0, hdrH, PW, 3).fillColor(C.accentBar).fill();

    doc
      .fillColor(C.headerText)
      .fontSize(17)
      .font("Helvetica-Bold")
      .text(companyName, L, 14, { width: W - 110, lineBreak: false });
    doc
      .fillColor(C.headerSub)
      .fontSize(8)
      .font("Helvetica")
      .text(companyAddress, L, 36, { width: W - 110, lineBreak: false });
    doc.text(`Tel: ${companyContact}   |   ${itDeptEmail}`, L, 47, {
      width: W - 110,
      lineBreak: false,
    });

    doc
      .rect(R - 96, 12, 96, 46)
      .fillColor("#1e3a8a")
      .fill();
    doc
      .fillColor(C.headerSub)
      .fontSize(6.5)
      .font("Helvetica-Bold")
      .text("IT DEPARTMENT", R - 92, 19, {
        width: 88,
        align: "center",
        lineBreak: false,
      });
    doc
      .fillColor(C.headerText)
      .fontSize(6.5)
      .font("Helvetica")
      .text("Asset Management", R - 92, 29, {
        width: 88,
        align: "center",
        lineBreak: false,
      });
    doc
      .fillColor(C.accentBar)
      .fontSize(6.5)
      .font("Helvetica-Bold")
      .text("AssetFlow AMS", R - 92, 39, {
        width: 88,
        align: "center",
        lineBreak: false,
      });

    let y = hdrH + 3 + 18;

    // ══════════════════════════════════════════════════════════════════════════
    // TITLE ROW
    // ══════════════════════════════════════════════════════════════════════════
    doc
      .fillColor(C.tableHdr)
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Asset Handover Letter", L, y);

    const bdgX = R - 142;
    doc
      .rect(bdgX, y - 2, 142, 30)
      .fillColor(C.sectionBg)
      .fill();
    doc
      .rect(bdgX, y - 2, 142, 30)
      .strokeColor(C.sectionBdr)
      .lineWidth(0.6)
      .stroke();
    doc
      .rect(bdgX, y - 2, 3, 30)
      .fillColor(C.accentBar)
      .fill();
    doc
      .fillColor(C.mutedTxt)
      .fontSize(6.5)
      .font("Helvetica-Bold")
      .text("TRANSFER NO.", bdgX + 7, y + 2, { width: 130, lineBreak: false });
    doc
      .fillColor(C.tableHdr)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(sv(transferNo), bdgX + 7, y + 12, { width: 130, lineBreak: false });

    y += 34;

    doc
      .fillColor(C.mutedTxt)
      .fontSize(8)
      .font("Helvetica")
      .text("Date: ", L, y, { continued: true })
      .fillColor(C.valueTxt)
      .font("Helvetica-Bold")
      .text(handoverDate, { continued: false });
    doc
      .fillColor(C.mutedTxt)
      .fontSize(8)
      .font("Helvetica")
      .text("Handover By: ", L + 200, y, { continued: true })
      .fillColor(C.valueTxt)
      .font("Helvetica-Bold")
      .text(assignedByName, { continued: false });

    y += 16;
    hLine(doc, L, y, R, C.sectionBdr, 0.8);
    y += 12;

    // ══════════════════════════════════════════════════════════════════════════
    // SALUTATION
    // ══════════════════════════════════════════════════════════════════════════
    doc
      .fillColor(C.valueTxt)
      .fontSize(9)
      .font("Helvetica")
      .text("Dear Sir / Madam,", L, y);
    y += 12;

    const intro = `We are pleased to inform you that the following IT asset(s) have been officially allocated to you as part of your role at ${companyName}. Please acknowledge receipt by signing this letter and returning a copy to the IT Department.`;
    doc
      .fillColor(C.bodyTxt)
      .fontSize(8.5)
      .font("Helvetica")
      .text(intro, L, y, { width: W, align: "justify" });
    y += doc.heightOfString(intro, { width: W }) + 14;

    // ══════════════════════════════════════════════════════════════════════════
    // EMPLOYEE INFO CARD
    // ══════════════════════════════════════════════════════════════════════════
    doc
      .fillColor(C.tableHdr)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("EMPLOYEE INFORMATION", L, y);
    y += 10;

    const empFields = [
      ["Employee Name", `${employee.firstName} ${employee.lastName}`],
      ["Employee Code", sv(employee.employeeCode)],
      ["Designation", sv(employee.designation)],
      ["Department", sv(employee.department?.name || asset.department?.name)],
      ["Official Email", sv(employee.email)],
      ["Location", sv(employee.branch || asset.location || "")],
    ];

    const empCardH = Math.ceil(empFields.length / 2) * 20 + 16;
    doc.rect(L, y, W, empCardH).fillColor(C.sectionBg).fill();
    doc
      .rect(L, y, W, empCardH)
      .strokeColor(C.sectionBdr)
      .lineWidth(0.6)
      .stroke();
    doc.rect(L, y, 3, empCardH).fillColor(C.sectionAcct).fill();

    const halfW = W / 2;
    const labelW = 92;
    const valueW = halfW - labelW - 10;
    const rowH = 20;
    const empCardY = y + 10;

    empFields.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const fx = col === 0 ? L + 8 : L + halfW + 8;
      const fy = empCardY + row * rowH;

      doc
        .fillColor(C.labelTxt)
        .fontSize(7.5)
        .font("Helvetica-Bold")
        .text(`${label}:`, fx, fy, { width: labelW, lineBreak: false });
      doc
        .fillColor(C.valueTxt)
        .fontSize(7.5)
        .font("Helvetica")
        .text(value, fx + labelW, fy, {
          width: valueW,
          lineBreak: false,
          ellipsis: true,
        });
    });

    y += empCardH + 14;

    // ══════════════════════════════════════════════════════════════════════════
    // ASSET TABLE
    // ══════════════════════════════════════════════════════════════════════════
    doc
      .fillColor(C.tableHdr)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("ALLOCATED ASSET(S)", L, y);
    y += 10;

    const tCols = [
      { label: "#", w: 22 },
      { label: "Asset Name", w: 122 },
      { label: "Asset Tag", w: 90 },
      { label: "Serial No.", w: 98 },
      { label: "Category", w: 100 },
      { label: "Condition", w: 75 },
    ];

    const tHdrH = 20;
    const tRowH = 18;

    let cx = L;
    tCols.forEach((col, i) => {
      doc.rect(cx, y, col.w, tHdrH).fillColor(C.tableHdr).fill();
      doc
        .fillColor(C.tableHdrTxt)
        .fontSize(7.5)
        .font("Helvetica-Bold")
        .text(col.label, cx + 4, y + 6, {
          width: col.w - 8,
          align: i === 0 ? "center" : "left",
          lineBreak: false,
        });
      cx += col.w;
    });
    y += tHdrH;

    const assetName = [
      asset.name,
      asset.brand
        ? `${asset.brand}${asset.model ? " " + asset.model : ""}`
        : null,
    ]
      .filter(Boolean)
      .join(" — ");

    const categoryStr =
      [asset.category?.name || null, asset.subCategory?.name || null]
        .filter(Boolean)
        .join(" › ") || "—";

    const row1 = [
      "1",
      assetName,
      sv(asset.assetTag),
      sv(asset.serialNumber),
      categoryStr,
      sv(assignment.conditionAtAssignment || asset.condition),
    ];

    cx = L;
    row1.forEach((val, i) => {
      doc.rect(cx, y, tCols[i].w, tRowH).fillColor(C.tableRow1).fill();
      doc
        .rect(cx, y, tCols[i].w, tRowH)
        .strokeColor(C.tableRel)
        .lineWidth(0.4)
        .stroke();
      doc
        .fillColor(C.valueTxt)
        .fontSize(7.5)
        .font("Helvetica")
        .text(val, cx + 4, y + 5, {
          width: tCols[i].w - 8,
          align: i === 0 ? "center" : "left",
          lineBreak: false,
          ellipsis: true,
        });
      cx += tCols[i].w;
    });
    y += tRowH;

    hLine(doc, L, y, R, C.tableHdr, 1);
    y += 14;

    // ══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION SECTION — only if customFields exist
    // ══════════════════════════════════════════════════════════════════════════
    if (configFields.length > 0) {
      doc
        .fillColor(C.tableHdr)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("ASSET CONFIGURATION & SOFTWARE", L, y);
      y += 10;

      const cfHdrH = 18;
      const cfRowH = 16;
      const halfColW = W / 2;
      const cfLabelW = 90;
      const cfValueW = halfColW - cfLabelW - 8;

      // Header
      doc.rect(L, y, W, cfHdrH).fillColor(C.configAcct).fill();
      doc
        .fillColor("#ffffff")
        .fontSize(7.5)
        .font("Helvetica-Bold")
        .text("Configuration Item", L + 6, y + 5, {
          width: halfColW - 10,
          lineBreak: false,
        });
      doc.text("Value", L + 6 + cfLabelW, y + 5, {
        width: cfValueW,
        lineBreak: false,
      });
      doc
        .fillColor("#ffffff")
        .fontSize(7.5)
        .font("Helvetica-Bold")
        .text("Configuration Item", L + halfColW + 6, y + 5, {
          width: halfColW - 10,
          lineBreak: false,
        });
      doc.text("Value", L + halfColW + 6 + cfLabelW, y + 5, {
        width: cfValueW,
        lineBreak: false,
      });
      doc
        .moveTo(L + halfColW, y)
        .lineTo(L + halfColW, y + cfHdrH)
        .strokeColor("#ffffff")
        .lineWidth(0.5)
        .stroke();
      y += cfHdrH;

      const pairs = [];
      for (let i = 0; i < configFields.length; i += 2) {
        pairs.push([configFields[i], configFields[i + 1] || null]);
      }

      pairs.forEach((pair, pi) => {
        const rowBg = pi % 2 === 0 ? C.configBg : "#ffffff";
        doc.rect(L, y, W, cfRowH).fillColor(rowBg).fill();
        doc
          .rect(L, y, W, cfRowH)
          .strokeColor(C.configBdr)
          .lineWidth(0.4)
          .stroke();

        const left = pair[0];
        doc
          .fillColor(C.labelTxt)
          .fontSize(7.5)
          .font("Helvetica-Bold")
          .text(`${left.key}:`, L + 6, y + 4, {
            width: cfLabelW - 4,
            lineBreak: false,
          });
        doc
          .fillColor(C.valueTxt)
          .fontSize(7.5)
          .font("Helvetica")
          .text(sv(left.value), L + 6 + cfLabelW, y + 4, {
            width: cfValueW,
            lineBreak: false,
            ellipsis: true,
          });

        if (pair[1]) {
          const right = pair[1];
          doc
            .moveTo(L + halfColW, y)
            .lineTo(L + halfColW, y + cfRowH)
            .strokeColor(C.configBdr)
            .lineWidth(0.4)
            .stroke();
          doc
            .fillColor(C.labelTxt)
            .fontSize(7.5)
            .font("Helvetica-Bold")
            .text(`${right.key}:`, L + halfColW + 6, y + 4, {
              width: cfLabelW - 4,
              lineBreak: false,
            });
          doc
            .fillColor(C.valueTxt)
            .fontSize(7.5)
            .font("Helvetica")
            .text(sv(right.value), L + halfColW + 6 + cfLabelW, y + 4, {
              width: cfValueW,
              lineBreak: false,
              ellipsis: true,
            });
        }

        y += cfRowH;
      });

      hLine(doc, L, y, R, C.configAcct, 0.8);
      y += 14;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TERMS & CONDITIONS
    // ══════════════════════════════════════════════════════════════════════════
    doc
      .fillColor(C.tableHdr)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("TERMS & CONDITIONS", L, y);
    y += 10;

    const terms = [
      "The above asset(s) are company property and must be used strictly for official purposes.",
      "You are responsible for the safekeeping of the asset. Any loss or damage must be reported immediately to the IT Department.",
      "The asset must be returned to the IT Department upon resignation, transfer, or termination of employment.",
      "Installation of any software, hardware, or free tools without prior written consent from IT Department is strictly prohibited.",
      "Laptops must be submitted to IT Dept. (Nagpur Office) between the 4th & 10th of every month for preventive maintenance.",
    ];

    const termsH = terms.length * 13 + 10;
    doc.rect(L, y, W, termsH).fillColor(C.termsBg).fill();
    doc.rect(L, y, W, termsH).strokeColor(C.termsBdr).lineWidth(0.6).stroke();
    doc.rect(L, y, 3, termsH).fillColor(C.termsAcct).fill();

    terms.forEach((term, i) => {
      doc
        .fillColor(C.valueTxt)
        .fontSize(7.5)
        .font("Helvetica")
        .text(`${i + 1}.  ${term}`, L + 10, y + 6 + i * 13, {
          width: W - 16,
          lineBreak: false,
          ellipsis: true,
        });
    });

    y += termsH + 12;

    // ══════════════════════════════════════════════════════════════════════════
    // ACKNOWLEDGEMENT
    // ══════════════════════════════════════════════════════════════════════════
    doc
      .fillColor(C.tableHdr)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("ACKNOWLEDGEMENT", L, y);
    y += 10;

    const ackText = `I, ${employee.firstName} ${employee.lastName} (Employee Code: ${sv(employee.employeeCode)}), hereby acknowledge that I have received the above-mentioned asset(s) in the stated condition. I understand that these assets are the sole property of ${companyName} and I am responsible for their proper use, maintenance, and safe return when required.`;
    doc
      .fillColor(C.bodyTxt)
      .fontSize(8)
      .font("Helvetica")
      .text(ackText, L, y, { width: W, align: "justify" });
    y += doc.heightOfString(ackText, { width: W }) + 16;

    // ══════════════════════════════════════════════════════════════════════════
    // SIGNATURE BLOCK
    // ══════════════════════════════════════════════════════════════════════════
    const sigColW = W / 3;
    const sigH = 56;

    const sigData = [
      {
        role: "Employee",
        name: `${employee.firstName} ${employee.lastName}`,
        dept: sv(employee.designation),
      },
      { role: "Approved By", name: assignedByName, dept: "IT Department" },
      {
        role: "IT Head / Auth. Signatory",
        name: assignedByName,
        dept: "IT Department",
      },
    ];

    sigData.forEach((sig, i) => {
      const sx = L + i * sigColW;
      doc
        .rect(sx, y, sigColW - 6, sigH)
        .fillColor(C.sigBg)
        .fill();
      doc
        .rect(sx, y, sigColW - 6, sigH)
        .strokeColor(C.sigBdr)
        .lineWidth(0.6)
        .stroke();
      doc
        .rect(sx, y, sigColW - 6, 3)
        .fillColor(C.accentBar)
        .fill();

      doc
        .fillColor(C.mutedTxt)
        .fontSize(6.5)
        .font("Helvetica-Bold")
        .text(sig.role.toUpperCase(), sx + 6, y + 8, {
          width: sigColW - 16,
          lineBreak: false,
        });
      hLine(doc, sx + 6, y + 30, sx + sigColW - 14, C.sigLine, 0.6);
      doc
        .fillColor(C.mutedTxt)
        .fontSize(6)
        .font("Helvetica")
        .text("Signature", sx + 6, y + 32, {
          width: sigColW - 16,
          lineBreak: false,
        });
      doc
        .fillColor(C.valueTxt)
        .fontSize(7.5)
        .font("Helvetica-Bold")
        .text(sig.name, sx + 6, y + 40, {
          width: sigColW - 16,
          lineBreak: false,
          ellipsis: true,
        });
      doc
        .fillColor(C.mutedTxt)
        .fontSize(6.5)
        .font("Helvetica")
        .text(sig.dept, sx + 6, y + 49, {
          width: sigColW - 16,
          lineBreak: false,
          ellipsis: true,
        });
    });

    y += sigH + 10;

    sigData.forEach((_, i) => {
      const sx = L + i * sigColW;
      doc
        .fillColor(C.mutedTxt)
        .fontSize(7)
        .font("Helvetica")
        .text("Date: ____________________", sx + 6, y, {
          width: sigColW - 16,
          lineBreak: false,
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // FOOTER
    // ══════════════════════════════════════════════════════════════════════════
    const footerY = PH - 34;
    doc.rect(0, footerY, PW, 34).fillColor(C.footerBg).fill();
    doc.rect(0, footerY, PW, 2).fillColor(C.accentBar).fill();

    doc
      .fillColor(C.footerTxt)
      .fontSize(7.5)
      .font("Helvetica-Bold")
      .text(companyName, L, footerY + 8, { width: 240, lineBreak: false });
    doc
      .fillColor(C.footerMuted)
      .fontSize(7)
      .font("Helvetica")
      .text(
        `Transfer No: ${sv(transferNo)}  |  Generated: ${new Date().toLocaleString("en-IN")}`,
        L,
        footerY + 20,
        { width: 300, lineBreak: false },
      );

    doc
      .fillColor(C.footerMuted)
      .fontSize(7)
      .font("Helvetica")
      .text("CONFIDENTIAL — For Internal Use Only", R - 180, footerY + 8, {
        width: 180,
        align: "right",
        lineBreak: false,
      });
    doc
      .fillColor(C.footerMuted)
      .fontSize(7)
      .text("Powered by AssetFlow AMS", R - 180, footerY + 20, {
        width: 180,
        align: "right",
        lineBreak: false,
      });

    doc.end();
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN CONTROLLER
// ═════════════════════════════════════════════════════════════════════════════
exports.sendHandoverMail = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    // ── Company settings fetch — Priority: DB → .env → hardcoded ─────────────
    const companySettings = await Setting.findAll({
      where: { tenantId, category: "company" },
      attributes: ["key", "value"],
    });
    const s = {};
    companySettings.forEach(({ key, value }) => {
      s[key] = value;
    });

    const companyName =
      s["company.name"] ||
      process.env.COMPANY_NAME ||
      "Dinshaws Dairy Foods Pvt. Ltd.";
    const companyAddress =
      s["company.address"] ||
      process.env.COMPANY_ADDRESS ||
      "Nagpur, Maharashtra";
    const companyContact =
      s["company.phone"] || process.env.COMPANY_CONTACT || "7767015300";
    const itDeptEmail =
      s["company.email"] ||
      process.env.IT_DEPT_EMAIL ||
      "itsupport06@dinshaws.co.in";

    // ── Asset fetch ────────────────────────────────────────────────────────────
    const asset = await Asset.findOne({
      where: { id, tenantId },
      include: [
        { model: Category, as: "category", attributes: ["id", "name"] },
        { model: SubCategory, as: "subCategory", attributes: ["id", "name"] },
        { model: Department, as: "department", attributes: ["id", "name"] },
      ],
    });
    if (!asset)
      return res
        .status(404)
        .json({ success: false, message: "Asset not found" });

    if (asset.assignmentType !== "employee" || !asset.assignedToId)
      return res.status(400).json({
        success: false,
        message: "Asset is not assigned to an employee",
      });

    const employee = await Employee.findOne({
      where: { id: asset.assignedToId, tenantId },
      include: [
        { model: Department, as: "department", attributes: ["id", "name"] },
      ],
    });
    if (!employee)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    if (!employee.email)
      return res
        .status(400)
        .json({ success: false, message: "Employee has no email address" });

    const assignment = await Assignment.findOne({
      where: { assetId: id, tenantId, isActive: true },
      order: [["assignedAt", "DESC"]],
    });
    if (!assignment)
      return res
        .status(404)
        .json({ success: false, message: "No active assignment found" });

    const assignedByUser = assignment.assignedById
      ? await User.findOne({
          where: { id: assignment.assignedById },
          attributes: ["id", "firstName", "lastName", "email"],
        })
      : null;

    const transferNo = `TRF-${assignment.id.split("-")[0].toUpperCase()}`;

    // ── PDF generate — resolved values pass karo ───────────────────────────────
    const pdfBuffer = await generateHandoverPDF({
      asset,
      employee,
      assignment,
      assignedByUser,
      transferNo,
      companyName, // ✅ DB → .env → hardcoded
      companyAddress, // ✅ DB → .env → hardcoded
      companyContact, // ✅ DB → .env → hardcoded
      itDeptEmail, // ✅ DB → .env → hardcoded
    });

    const handoverDate = new Date(assignment.assignedAt).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );

    const configFields = parseCustomFields(asset.customFields);

    // ── HTML Email Body ────────────────────────────────────────────────────────
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f1f5f9;padding:20px;">
        <div style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <div style="background:#1e40af;padding:24px 28px;">
            <h1 style="color:#fff;margin:0 0 4px;font-size:17px;">${companyName}</h1>
            <p style="color:#bfdbfe;margin:0;font-size:11px;">Asset Handover Confirmation  •  Ref: ${transferNo}</p>
          </div>
          <div style="height:3px;background:#3b82f6;"></div>
          <div style="padding:28px;">
            <p style="margin-top:0;color:#374151;">Dear <strong>${employee.firstName} ${employee.lastName}</strong>,</p>
            <p style="color:#374151;">Please find attached your <strong>Asset Handover Letter</strong>.</p>
            <div style="background:#eff6ff;border-left:4px solid #1e40af;border-radius:0 6px 6px 0;padding:14px 18px;margin:18px 0;">
              <table style="width:100%;border-collapse:collapse;">
                ${[
                  ["Asset Tag", asset.assetTag],
                  ["Asset Name", asset.name],
                  ["Serial No.", asset.serialNumber || "—"],
                  [
                    "Category",
                    (asset.category?.name || "—") +
                      (asset.subCategory?.name
                        ? " › " + asset.subCategory.name
                        : ""),
                  ],
                  ["Handover Date", handoverDate],
                  ["Transfer No.", transferNo],
                  [
                    "Condition",
                    assignment.conditionAtAssignment || asset.condition || "—",
                  ],
                ]
                  .map(
                    ([l, v]) => `
                  <tr>
                    <td style="padding:4px 0;color:#6b7280;font-size:12px;width:38%;font-weight:600;">${l}</td>
                    <td style="padding:4px 0;color:#1e3a8a;font-size:12px;font-weight:700;">${v}</td>
                  </tr>`,
                  )
                  .join("")}
                ${
                  configFields.length > 0
                    ? `
                  <tr><td colspan="2" style="padding-top:8px;border-top:1px solid #bfdbfe;font-size:11px;color:#6b7280;font-weight:600;">CONFIGURATION</td></tr>
                  ${configFields
                    .map(
                      ({ key, value }) => `
                    <tr>
                      <td style="padding:3px 0;color:#6b7280;font-size:11px;width:38%;font-weight:600;">${key}</td>
                      <td style="padding:3px 0;color:#1e3a8a;font-size:11px;">${value || "—"}</td>
                    </tr>`,
                    )
                    .join("")}
                `
                    : ""
                }
              </table>
            </div>
            <p style="color:#6b7280;font-size:12px;">
              Please sign the attached letter and return a copy to IT Department.<br/>
              For assistance: <a href="mailto:${itDeptEmail}" style="color:#1e40af;font-weight:600;">${itDeptEmail}</a>
            </p>
            <p style="margin-top:20px;margin-bottom:0;color:#1e293b;font-size:13px;">
              Regards,<br/><strong>IT Department</strong><br/>
              <span style="color:#6b7280;">${companyName}</span>
            </p>
          </div>
          <div style="background:#1e3a8a;padding:10px 28px;">
            <span style="color:#93c5fd;font-size:10px;">Automated notification from AssetFlow AMS. Do not reply. | CONFIDENTIAL</span>
          </div>
        </div>
      </div>
    `;

    const mailResult = await sendEmail({
      to: employee.email,
      cc: itDeptEmail || undefined,
      subject: `Asset Handover Letter — ${asset.assetTag} | ${employee.firstName} ${employee.lastName} | ${transferNo}`,
      html: htmlBody,
      tenantId,
      attachments: [
        {
          filename: `AssetHandoverLetter_${asset.assetTag}_${employee.firstName}${employee.lastName}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    if (!mailResult.success && !mailResult.skipped)
      return res
        .status(500)
        .json({ success: false, message: `Mail failed: ${mailResult.error}` });
    await AuditLog.create({
      entityType: "Asset",
      entityId: id,
      tenantId,
      action: "HANDOVER_MAIL_SENT",
      userId: req.user.id,
      newValues: {
        sentTo: employee.email,
        transferNo,
        assetTag: asset.assetTag,
      },
      description: `Handover mail sent to ${employee.email} for asset ${asset.assetTag}`,
    });
    res.json({
      success: true,
      message: `Handover letter sent to ${employee.email}`,
      data: {
        sentTo: employee.email,
        cc: itDeptEmail || null,
        assetTag: asset.assetTag,
        transferNo,
        skipped: mailResult.skipped || false,
      },
    });
  } catch (err) {
    console.error("[HANDOVER MAIL] Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
