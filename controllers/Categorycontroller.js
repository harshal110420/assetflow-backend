const { Category, SubCategory, AuditLog } = require("../models/index");
const Asset = require("../models/Asset");

// ═════════════════════════════════════════════════════════════════════════════
// CATEGORY CRUD
// ═════════════════════════════════════════════════════════════════════════════

exports.getCategories = async (req, res) => {
  try {
    const where = { tenantId: req.user.tenantId };
    if (req.user.role !== "admin") where.isActive = true;

    const categories = await Category.findAll({
      where,
      include: [
        {
          model: SubCategory,
          as: "subCategories",
          where: { isActive: true, tenantId: req.user.tenantId },
          required: false,
          attributes: [
            "id",
            "name",
            "description",
            "icon",
            "color",
            "depreciationRate",
            "usefulLife",
            "isActive",
          ],
        },
      ],
      order: [
        ["name", "ASC"],
        [{ model: SubCategory, as: "subCategories" }, "name", "ASC"],
      ],
    });

    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: [
        {
          model: SubCategory,
          as: "subCategories",
          where: { tenantId: req.user.tenantId },
          required: false,
          order: [["name", "ASC"]],
        },
      ],
    });
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    res.json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, description, icon, color, depreciationRate, usefulLife } =
      req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Category name required" });

    const existing = await Category.findOne({
      where: { name, tenantId: req.user.tenantId },
    });
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "Category already exists" });

    const category = await Category.create({
      name,
      description,
      icon,
      color,
      depreciationRate: depreciationRate || 20.0,
      usefulLife,
      tenantId: req.user.tenantId,
      isActive: true,
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Category",
      entityId: category.id,
      tenantId: req.user.tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: category.toJSON(),
      description: `Category "${name}" created`,
    });

    res
      .status(201)
      .json({ success: true, data: category, message: "Category created" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    const {
      name,
      description,
      icon,
      color,
      depreciationRate,
      usefulLife,
      isActive,
    } = req.body;

    if (name && name !== category.name) {
      const existing = await Category.findOne({
        where: { name, tenantId: req.user.tenantId },
      });
      if (existing)
        return res
          .status(400)
          .json({ success: false, message: "Category name already exists" });
    }

    const oldValues = category.toJSON();
    await category.update({
      name,
      description,
      icon,
      color,
      depreciationRate,
      usefulLife,
      isActive,
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Category",
      entityId: category.id,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      oldValues,
      newValues: category.toJSON(),
      description: `Category "${category.name}" updated`,
    });

    res.json({ success: true, data: category, message: "Category updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    const assetCount = await Asset.count({
      where: { categoryId: req.params.id, tenantId: req.user.tenantId },
    });
    if (assetCount > 0)
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${assetCount} asset(s) are using this category`,
      });

    const oldValues = category.toJSON();
    await category.update({ isActive: false });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "Category",
      entityId: category.id,
      tenantId: req.user.tenantId,
      action: "DEACTIVATE",
      userId: req.user.id,
      oldValues,
      newValues: { isActive: false },
      description: `Category "${oldValues.name}" deactivated`,
    });

    res.json({ success: true, message: "Category deactivated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// SUBCATEGORY CRUD
// ═════════════════════════════════════════════════════════════════════════════

exports.getSubCategories = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const where = { tenantId: req.user.tenantId };
    if (categoryId) where.categoryId = categoryId;
    if (req.user.role !== "admin") where.isActive = true;

    const subCategories = await SubCategory.findAll({
      where,
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name", "icon", "color", "depreciationRate"],
        },
      ],
      order: [["name", "ASC"]],
    });

    res.json({ success: true, data: subCategories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSubCategory = async (req, res) => {
  try {
    const subCategory = await SubCategory.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name", "depreciationRate", "usefulLife"],
        },
      ],
    });
    if (!subCategory)
      return res
        .status(404)
        .json({ success: false, message: "SubCategory not found" });

    res.json({ success: true, data: subCategory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSubCategory = async (req, res) => {
  try {
    const {
      name,
      categoryId,
      description,
      icon,
      color,
      depreciationRate,
      usefulLife,
    } = req.body;

    if (!name || !categoryId)
      return res
        .status(400)
        .json({ success: false, message: "Name and categoryId required" });

    const category = await Category.findOne({
      where: { id: categoryId, tenantId: req.user.tenantId, isActive: true },
    });
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    const existing = await SubCategory.findOne({
      where: { name, categoryId, tenantId: req.user.tenantId },
    });
    if (existing)
      return res.status(400).json({
        success: false,
        message: "SubCategory already exists in this category",
      });

    const subCategory = await SubCategory.create({
      name,
      categoryId,
      description,
      icon,
      color,
      depreciationRate: depreciationRate ?? null,
      usefulLife: usefulLife ?? null,
      tenantId: req.user.tenantId,
      isActive: true,
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "SubCategory",
      entityId: subCategory.id,
      tenantId: req.user.tenantId,
      action: "CREATE",
      userId: req.user.id,
      newValues: subCategory.toJSON(),
      description: `SubCategory "${name}" created under "${category.name}"`,
    });

    res.status(201).json({
      success: true,
      data: subCategory,
      message: "SubCategory created",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSubCategory = async (req, res) => {
  try {
    const subCategory = await SubCategory.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!subCategory)
      return res
        .status(404)
        .json({ success: false, message: "SubCategory not found" });

    const {
      name,
      categoryId,
      description,
      icon,
      color,
      depreciationRate,
      usefulLife,
      isActive,
    } = req.body;

    const newName = name ?? subCategory.name;
    const newCategoryId = categoryId ?? subCategory.categoryId;

    if (
      (name && name !== subCategory.name) ||
      (categoryId && categoryId !== subCategory.categoryId)
    ) {
      const existing = await SubCategory.findOne({
        where: {
          name: newName,
          categoryId: newCategoryId,
          tenantId: req.user.tenantId,
        },
      });
      if (existing && existing.id !== subCategory.id)
        return res.status(400).json({
          success: false,
          message: "SubCategory already exists in this category",
        });
    }

    const oldValues = subCategory.toJSON();
    await subCategory.update({
      name,
      categoryId,
      description,
      icon,
      color,
      depreciationRate,
      usefulLife,
      isActive,
    });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "SubCategory",
      entityId: subCategory.id,
      tenantId: req.user.tenantId,
      action: "UPDATE",
      userId: req.user.id,
      oldValues,
      newValues: subCategory.toJSON(),
      description: `SubCategory "${subCategory.name}" updated`,
    });

    res.json({
      success: true,
      data: subCategory,
      message: "SubCategory updated",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSubCategory = async (req, res) => {
  try {
    const subCategory = await SubCategory.findOne({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!subCategory)
      return res
        .status(404)
        .json({ success: false, message: "SubCategory not found" });

    const assetCount = await Asset.count({
      where: { subCategoryId: req.params.id, tenantId: req.user.tenantId },
    });
    if (assetCount > 0)
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${assetCount} asset(s) are using this subcategory`,
      });

    const oldValues = subCategory.toJSON();
    await subCategory.update({ isActive: false });

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      entityType: "SubCategory",
      entityId: subCategory.id,
      tenantId: req.user.tenantId,
      action: "DEACTIVATE",
      userId: req.user.id,
      oldValues,
      newValues: { isActive: false },
      description: `SubCategory "${oldValues.name}" deactivated`,
    });

    res.json({ success: true, message: "SubCategory deactivated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
