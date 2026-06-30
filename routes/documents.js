const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../config/database');
const { ensureAuth, ensureNotPending } = require('../middleware/auth');
const { documentStorage, cloudinary } = require('../config/cloudinary');
const { logAction } = require('../middleware/audit');

const upload = multer({ storage: documentStorage });

// List documents
router.get('/', ensureAuth, ensureNotPending, async (req, res) => {
  try {
    const { category, unitId } = req.query;
    const isAdmin = req.user.role === 'admin';
    const isAccountant = req.user.role === 'accountant';

    let unitIds = [];
    if (!isAdmin && !isAccountant) {
      const units = await prisma.unit.findMany({
        where: { OR: [{ ownerId: req.user.id }, { residentId: req.user.id }] },
        select: { id: true },
      });
      unitIds = units.map(u => u.id);
    }

    const where = {};
    if (category) where.category = category;
    if (unitId && (isAdmin || isAccountant)) {
      where.unitId = unitId;
    } else if (unitIds.length > 0) {
      where.unitId = { in: unitIds };
    }

    const [documents, units] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          unit: { select: { unitNumber: true, building: true } },
          uploader: { select: { firstName: true, lastName: true } },
        },
      }),
      (isAdmin || isAccountant) ? prisma.unit.findMany({
        orderBy: { unitNumber: 'asc' },
        select: { id: true, unitNumber: true, building: true },
      }) : prisma.unit.findMany({
        where: { OR: [{ ownerId: req.user.id }, { residentId: req.user.id }] },
        select: { id: true, unitNumber: true, building: true },
      }),
    ]);

    res.render('documents/index', {
      title: 'Document Vault',
      documents,
      units,
      selectedCategory: category,
      selectedUnit: unitId,
      isAdmin,
      isAccountant,
    });
  } catch (error) {
    console.error('Documents error:', error);
    req.flash('error_msg', 'Unable to load documents');
    res.redirect('/dashboard');
  }
});

// Upload document
router.post('/', ensureAuth, upload.single('file'), async (req, res) => {
  try {
    const { unitId, title, category } = req.body;

    if (!unitId || !title || !req.file) {
      req.flash('error_msg', 'Unit, title, and file are required');
      return res.redirect('/documents');
    }

    // Check permission
    const isAdmin = req.user.role === 'admin';
    const isAccountant = req.user.role === 'accountant';

    if (!isAdmin && !isAccountant) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        select: { ownerId: true, residentId: true },
      });
      if (unit?.ownerId !== req.user.id && unit?.residentId !== req.user.id) {
        req.flash('error_msg', 'You do not have access to this unit');
        return res.redirect('/documents');
      }
    }

    const doc = await prisma.document.create({
      data: {
        unitId,
        title,
        fileUrl: req.file.path,
        filePublicId: req.file.filename,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        category: category || 'other',
        uploadedBy: req.user.id,
      },
    });

    await logAction('CREATE', 'Document', doc.id, { title, unitId }, req.user.id);

    req.flash('success_msg', 'Document uploaded successfully');
    res.redirect('/documents');
  } catch (error) {
    console.error('Upload document error:', error);
    req.flash('error_msg', 'Unable to upload document');
    res.redirect('/documents');
  }
});

// Delete document
router.post('/:id/delete', ensureAuth, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { unit: { select: { ownerId: true } } },
    });

    if (!doc) {
      req.flash('error_msg', 'Document not found');
      return res.redirect('/documents');
    }

    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && doc.unit.ownerId !== req.user.id && doc.uploadedBy !== req.user.id) {
      req.flash('error_msg', 'You do not have permission to delete this document');
      return res.redirect('/documents');
    }

    // Delete from Cloudinary
    if (doc.filePublicId) {
      await cloudinary.uploader.destroy(doc.filePublicId);
    }

    await prisma.document.delete({
      where: { id: req.params.id },
    });

    await logAction('DELETE', 'Document', req.params.id, { title: doc.title }, req.user.id);

    req.flash('success_msg', 'Document deleted successfully');
    res.redirect('/documents');
  } catch (error) {
    console.error('Delete document error:', error);
    req.flash('error_msg', 'Unable to delete document');
    res.redirect('/documents');
  }
});

module.exports = router;
