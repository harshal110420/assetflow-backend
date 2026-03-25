const multer = require("multer");
const XLSX = require("xlsx");
const { parse } = require("csv-parse/sync");
const { v4: uuidv4 } = require("uuid");
const Asset = require("../models/Asset");
const Employee = require("../models/Employee");
const Department = require("../models/Department");
const { Category, SubCategory } = require("../models/index");
const { AuditLog } = require("../models/index");
const { Op } = require("sequelize");

// Multer — memory storage, file disk par nahi jayega
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.endsWith(".csv") ||
      file.originalname.endsWith(".xlsx")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed"));
    }
  },
});

exports.uploadMiddleware = upload.single("file");

// ── Parse file buffer to rows array ──────────────────────────────────────────
const parseFile = (buffer, mimetype, originalname) => {
  if (originalname.endsWith(".csv") || mimetype === "text/csv") {
    const content = buffer.toString("utf8");
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } else {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }
};

const sanitizeDate = (val) => {
  if (!val || val.toString().trim() === "") return undefined;

  const str = val.toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return undefined;

  // ← YE ADD KAR — actual calendar validity check
  const [year, month, day] = str.split("-").map(Number);
  const date = new Date(str);
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  )
    return undefined;

  return str;
};

// ── ASSET IMPORT ──────────────────────────────────────────────────────────────
exports.importAssets = async (req, res) => {
  try {
    const tId = req.user.tenantId;
    const rows = parseFile(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "File is empty" });
    }
    if (rows.length > 500) {
      return res
        .status(400)
        .json({ success: false, message: "Max 500 rows allowed per import" });
    }

    // ── Prefetch lookup data — DB pe baar baar query mat karo ────────────────
    const [categories, subCategories, departments, locations] =
      await Promise.all([
        Category.findAll({
          where: { tenantId: tId },
          attributes: ["id", "name"],
          raw: true,
        }),
        SubCategory.findAll({
          where: { tenantId: tId },
          attributes: ["id", "name", "categoryId"],
          raw: true,
        }),
        Department.findAll({
          where: { tenantId: tId },
          attributes: ["id", "name"],
          raw: true,
        }),
        require("../models/Permission").Location.findAll({
          where: { tenantId: tId },
          attributes: ["id", "name"],
          raw: true,
        }),
      ]);

    // Lookup maps — name → id (case insensitive)
    const categoryMap = Object.fromEntries(
      categories.map((c) => [c.name.toLowerCase(), c]),
    );
    const subCategoryMap = Object.fromEntries(
      subCategories.map((s) => [s.name.toLowerCase(), s]),
    );
    const departmentMap = Object.fromEntries(
      departments.map((d) => [d.name.toLowerCase(), d]),
    );
    const locationMap = Object.fromEntries(
      locations.map((l) => [l.name.toLowerCase(), l]),
    );
    // Existing asset tags — duplicate check ke liye
    const existingTags = new Set(
      (
        await Asset.findAll({
          where: { tenantId: tId },
          attributes: ["assetTag"],
          raw: true,
        })
      ).map((a) => a.assetTag.toLowerCase()),
    );

    // Existing serial numbers
    const existingSerials = new Set(
      (
        await Asset.findAll({
          where: { tenantId: tId, serialNumber: { [Op.ne]: null } },
          attributes: ["serialNumber"],
          raw: true,
        })
      ).map((a) => a.serialNumber.toLowerCase()),
    );

    const results = [];
    const importedTagsThisBatch = new Set(); // batch ke andar duplicate check

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1 = header, so data starts at 2
      const errors = [];

      // ── Required fields ──
      if (!row.name?.trim()) errors.push("name is required");

      // ── Category lookup ──
      let categoryId = null;
      let subCategoryId = null;
      if (row.category?.trim()) {
        const cat = categoryMap[row.category.trim().toLowerCase()];
        if (!cat) errors.push(`Category "${row.category}" not found`);
        else {
          categoryId = cat.id;
          if (row.subCategory?.trim()) {
            const sub = subCategoryMap[row.subCategory.trim().toLowerCase()];
            if (!sub) errors.push(`SubCategory "${row.subCategory}" not found`);
            else if (sub.categoryId !== cat.id)
              errors.push(
                `SubCategory "${row.subCategory}" does not belong to "${row.category}"`,
              );
            else subCategoryId = sub.id;
          }
        }
      }

      // ── Department lookup ──
      let departmentId = null;
      if (row.department?.trim()) {
        const dept = departmentMap[row.department.trim().toLowerCase()];
        if (!dept) errors.push(`Department "${row.department}" not found`);
        else departmentId = dept.id;
      }

      // ── Location lookup ──
      let locationId = null;
      if (row.location?.trim()) {
        const loc = locationMap[row.location.trim().toLowerCase()];
        if (!loc) errors.push(`Location "${row.location}" not found`);
        else locationId = loc.id;
      }

      // ── Status validation ──
      const validStatuses = [
        "Active",
        "Inactive",
        "In Maintenance",
        "Disposed",
        "Lost",
        "Reserved",
      ];
      const status = row.status?.trim() || "Active";
      if (!validStatuses.includes(status))
        errors.push(
          `Invalid status "${status}". Valid: ${validStatuses.join(", ")}`,
        );

      // ── Condition validation ──
      const validConditions = ["Excellent", "Good", "Fair", "Poor", "Damaged"];
      const condition = row.condition?.trim() || "Good";
      if (!validConditions.includes(condition))
        errors.push(
          `Invalid condition "${condition}". Valid: ${validConditions.join(", ")}`,
        );

      // ── Date validations ──
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (row.purchaseDate?.trim() && !dateRegex.test(row.purchaseDate.trim()))
        errors.push("purchaseDate must be YYYY-MM-DD");
      if (
        row.warrantyExpiry?.trim() &&
        !dateRegex.test(row.warrantyExpiry.trim())
      )
        errors.push("warrantyExpiry must be YYYY-MM-DD");

      // ── Number validations ──
      if (
        row.purchasePrice?.toString().trim() &&
        isNaN(parseFloat(row.purchasePrice))
      )
        errors.push("purchasePrice must be a number");
      if (
        row.currentValue?.toString().trim() &&
        isNaN(parseFloat(row.currentValue))
      )
        errors.push("currentValue must be a number");
      if (
        row.depreciationRate?.toString().trim() &&
        isNaN(parseFloat(row.depreciationRate))
      )
        errors.push("depreciationRate must be a number");

      // ── Asset tag duplicate check ──
      const assetTag = row.assetTag?.trim() || null;
      if (assetTag) {
        if (existingTags.has(assetTag.toLowerCase())) {
          errors.push(`Asset tag "${assetTag}" already exists`);
        } else if (importedTagsThisBatch.has(assetTag.toLowerCase())) {
          errors.push(`Asset tag "${assetTag}" is duplicate in this file`);
        } else {
          importedTagsThisBatch.add(assetTag.toLowerCase());
        }
      }

      // ── Serial number duplicate check ──
      const serialNumber = row.serialNumber?.trim() || null;
      if (serialNumber && existingSerials.has(serialNumber.toLowerCase())) {
        errors.push(`Serial number "${serialNumber}" already exists`);
      }

      results.push({
        rowNum,
        isValid: errors.length === 0,
        errors,
        data: {
          name: row.name?.trim(),
          assetTag,
          categoryId,
          subCategoryId,
          departmentId,
          locationId,
          assignmentType: "pool",
          brand: row.brand?.trim() || null,
          model: row.model?.trim() || null,
          serialNumber,
          status,
          condition,
          purchaseDate: sanitizeDate(row.purchaseDate),
          purchasePrice:
            row.purchasePrice !== "" && row.purchasePrice != null
              ? parseFloat(row.purchasePrice)
              : null,
          currentValue:
            row.currentValue !== "" && row.currentValue != null
              ? parseFloat(row.currentValue)
              : null,
          warrantyExpiry: sanitizeDate(row.warrantyExpiry),
          depreciationRate:
            row.depreciationRate !== "" && row.depreciationRate != null
              ? parseFloat(row.depreciationRate)
              : 20,

          vendor: row.vendor?.trim() || null,
        },
        // Original row for preview
        preview: {
          name: row.name,
          assetTag: row.assetTag,
          category: row.category,
          subCategory: row.subCategory,
          brand: row.brand,
          serialNumber: row.serialNumber,
          status,
          condition,
          department: row.department,
          purchasePrice: row.purchasePrice,
        },
      });
    }

    const validRows = results.filter((r) => r.isValid);
    const invalidRows = results.filter((r) => !r.isValid);

    // ── Agar sirf validate karna hai (dry run) ──
    if (req.query.dryRun === "true") {
      return res.json({
        success: true,
        summary: {
          total: results.length,
          valid: validRows.length,
          invalid: invalidRows.length,
        },
        results,
      });
    }

    // ── Actual import — sirf valid rows ──
    let imported = 0;
    const importErrors = [];

    for (const row of validRows) {
      try {
        await Asset.create({
          ...Object.fromEntries(
            Object.entries(row.data).filter(([_, v]) => v !== undefined),
          ),
          tenantId: tId,
          createdById: req.user.id,
        });
        imported++;
      } catch (err) {
        importErrors.push({ rowNum: row.rowNum, error: err.message });
      }
    }

    // ── Audit log ──
    await AuditLog.create({
      tenantId: tId,
      entityType: "Asset",
      entityId: "bulk-import",
      action: "BULK_IMPORT",
      userId: req.user.id,
      newValues: {
        imported,
        invalid: invalidRows.length,
        total: results.length,
      },
      description: `Bulk imported ${imported} assets (${invalidRows.length} skipped)`,
    });

    return res.json({
      success: true,
      summary: {
        total: results.length,
        imported,
        invalid: invalidRows.length,
        dbErrors: importErrors.length,
      },
      invalidRows: invalidRows.map((r) => ({
        rowNum: r.rowNum,
        errors: r.errors,
        preview: r.preview,
      })),
      dbErrors: importErrors,
    });
  } catch (err) {
    console.error("importAssets error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── EMPLOYEE IMPORT ───────────────────────────────────────────────────────────
exports.importEmployees = async (req, res) => {
  try {
    const tId = req.user.tenantId;
    const rows = parseFile(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "File is empty" });
    }
    if (rows.length > 500) {
      return res
        .status(400)
        .json({ success: false, message: "Max 500 rows allowed per import" });
    }

    // ── Prefetch ──
    const [departments, locations, existingEmployees] = await Promise.all([
      Department.findAll({
        where: { tenantId: tId },
        attributes: ["id", "name"],
        raw: true,
      }),
      require("../models/Permission").Location.findAll({
        where: { tenantId: tId },
        attributes: ["id", "name"],
        raw: true,
      }),
      Employee.findAll({
        where: { tenantId: tId },
        attributes: ["email", "employeeCode"],
        raw: true,
      }),
    ]);

    const departmentMap = Object.fromEntries(
      departments.map((d) => [d.name.toLowerCase(), d]),
    );
    const locationMap = Object.fromEntries(
      locations.map((l) => [l.name.toLowerCase(), l]),
    );
    const existingEmails = new Set(
      existingEmployees.map((e) => e.email.toLowerCase()),
    );
    const existingCodes = new Set(
      existingEmployees
        .filter((e) => e.employeeCode)
        .map((e) => e.employeeCode.toLowerCase()),
    );

    const results = [];
    const batchEmails = new Set();
    const batchCodes = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const errors = [];

      // ── Required fields ──
      if (!row.firstName?.trim()) errors.push("firstName is required");
      if (!row.lastName?.trim()) errors.push("lastName is required");
      if (!row.email?.trim()) errors.push("email is required");

      // ── Email format ──
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (row.email?.trim() && !emailRegex.test(row.email.trim())) {
        errors.push(`Invalid email format: "${row.email}"`);
      }

      // ── Email duplicate check ──
      if (row.email?.trim()) {
        const emailLower = row.email.trim().toLowerCase();
        if (existingEmails.has(emailLower)) {
          errors.push(`Email "${row.email}" already exists`);
        } else if (batchEmails.has(emailLower)) {
          errors.push(`Email "${row.email}" is duplicate in this file`);
        } else {
          batchEmails.add(emailLower);
        }
      }

      // ── Employee code duplicate check ──
      if (row.employeeCode?.trim()) {
        const codeLower = row.employeeCode.trim().toLowerCase();
        if (existingCodes.has(codeLower)) {
          errors.push(`Employee code "${row.employeeCode}" already exists`);
        } else if (batchCodes.has(codeLower)) {
          errors.push(
            `Employee code "${row.employeeCode}" is duplicate in this file`,
          );
        } else {
          batchCodes.add(codeLower);
        }
      }

      // ── Department lookup ──
      let departmentId = null;
      if (row.department?.trim()) {
        const dept = departmentMap[row.department.trim().toLowerCase()];
        if (!dept) errors.push(`Department "${row.department}" not found`);
        else departmentId = dept.id;
      }

      // ── Location lookup ──
      let locationId = null;
      if (row.location?.trim()) {
        const loc = locationMap[row.location.trim().toLowerCase()];
        if (!loc) errors.push(`Location "${row.location}" not found`);
        else locationId = loc.id;
      }

      // ── Employment type validation ──
      const validTypes = ["Full-time", "Part-time", "Contract", "Intern"];
      const employmentType = row.employmentType?.trim() || "Full-time";
      if (!validTypes.includes(employmentType)) {
        errors.push(
          `Invalid employmentType "${employmentType}". Valid: ${validTypes.join(", ")}`,
        );
      }

      // ── Date validation ──
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (row.joiningDate?.trim() && !dateRegex.test(row.joiningDate.trim())) {
        errors.push("joiningDate must be YYYY-MM-DD");
      }

      results.push({
        rowNum,
        isValid: errors.length === 0,
        errors,
        data: {
          firstName: row.firstName?.trim(),
          lastName: row.lastName?.trim(),
          email: row.email?.trim().toLowerCase(),
          phone: row.phone?.trim() || null,
          employeeCode: row.employeeCode?.trim() || null,
          designation: row.designation?.trim() || null,
          employmentType,
          departmentId,
          locationId,
          joiningDate: sanitizeDate(row.joiningDate),
        },
        preview: {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          employeeCode: row.employeeCode,
          designation: row.designation,
          department: row.department,
          location: row.location,
          employmentType,
          joiningDate: row.joiningDate,
        },
      });
    }

    const validRows = results.filter((r) => r.isValid);
    const invalidRows = results.filter((r) => !r.isValid);

    // ── Dry run ──
    if (req.query.dryRun === "true") {
      return res.json({
        success: true,
        summary: {
          total: results.length,
          valid: validRows.length,
          invalid: invalidRows.length,
        },
        results,
      });
    }

    // ── Actual import ──
    let imported = 0;
    const importErrors = [];

    for (const row of validRows) {
      try {
        await Employee.create({
          ...Object.fromEntries(
            Object.entries(row.data).filter(([_, v]) => v !== undefined),
          ),
          tenantId: tId,
          isActive: true,
        });
        imported++;
      } catch (err) {
        importErrors.push({ rowNum: row.rowNum, error: err.message });
      }
    }

    // ── Audit log ──
    await AuditLog.create({
      tenantId: tId,
      entityType: "Employee",
      entityId: "bulk-import",
      action: "BULK_IMPORT",
      userId: req.user.id,
      newValues: {
        imported,
        invalid: invalidRows.length,
        total: results.length,
      },
      description: `Bulk imported ${imported} employees (${invalidRows.length} skipped)`,
    });

    return res.json({
      success: true,
      summary: {
        total: results.length,
        imported,
        invalid: invalidRows.length,
        dbErrors: importErrors.length,
      },
      invalidRows: invalidRows.map((r) => ({
        rowNum: r.rowNum,
        errors: r.errors,
        preview: r.preview,
      })),
      dbErrors: importErrors,
    });
  } catch (err) {
    console.error("importEmployees error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
