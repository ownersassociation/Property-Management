const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../config/database');
const { ensureAuth, ensureAdmin, ensureNotPending } = require('../middleware/auth');
const { noticeStorage } = require('../config/cloudinary');
const { logAction } = require('../middleware/audit');

const upload = multer({ storage: noticeStorage });

// List notices
router.get('/', ensureAuth, ensureNotPending, async (req, res) => {
  try {
    const { category, page = 1 } = req.query;
    const limit = 20;
    const skip = (parseInt(page) - 1) * limit;

    const where = { status: 'active' };
    if (category) where.category = category;

    const [notices, totalCount, categories] = await Promise.all([
      prisma.notice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { author: { select: { firstName: true, lastName: true } } },
      }),
      prisma.notice.count({ where }),
      prisma.notice.findMany({
        where: { status: 'active' },
        distinct: ['category'],
        select: { category: true },
      }),
    ]);

    // Mark unread for current user
    const noticesWithRead = notices.map(n => ({
      ...n,
      isRead: n.readBy.includes(req.user.id),
    }));

    res.render('notices/index', {
      title: 'Notices & Announcements',
      notices: noticesWithRead,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      categories: categories.map(c => c.category),
      selectedCategory: category,
      isAdmin: req.user.role === 'admin',
    });
  } catch (error) {
    console.error('Notices error:', error);
    req.flash('error_msg', 'Unable to load notices');
    res.redirect('/dashboard');
  }
});

// View single notice
router.get('/:id', ensureAuth, ensureNotPending, async (req, res) => {
  try {
    const notice = await prisma.notice.findUnique({
      where: { id: req.params.id },
      include: { author: { select: { firstName: true, lastName: true } } },
    });

    if (!notice || notice.status !== 'active') {
      req.flash('error_msg', 'Notice not found');
      return res.redirect('/notices');
    }

    // Mark as read
    if (!notice.readBy.includes(req.user.id)) {
      await prisma.notice.update({
        where: { id: req.params.id },
        data: { readBy: { push: req.user.id } },
      });
    }

    res.render('notices/show', {
      title: notice.title,
      notice,
      isAdmin: req.user.role === 'admin',
    });
  } catch (error) {
    console.error('Notice detail error:', error);
    req.flash('error_msg', 'Unable to load notice');
    res.redirect('/notices');
  }
});

// Admin: New notice form
router.get('/admin/new', ensureAuth, ensureAdmin, (req, res) => {
  res.render('notices/form', { title: 'New Notice', notice: null });
});

// Admin: Create notice
router.post('/', ensureAuth, ensureAdmin, upload.single('attachment'), async (req, res) => {
  try {
    const { title, body, category, validUntil, isUrgent } = req.body;

    if (!title || !body || !category) {
      req.flash('error_msg', 'Title, body, and category are required');
      return res.redirect('/notices/admin/new');
    }

    const notice = await prisma.notice.create({
      data: {
        title,
        body,
        category,
        attachmentUrl: req.file?.path || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        isUrgent: isUrgent === 'on',
        createdBy: req.user.id,
      },
    });

    await logAction('CREATE', 'Notice', notice.id, { title, category }, req.user.id);

    req.flash('success_msg', 'Notice published successfully');
    res.redirect('/notices');
  } catch (error) {
    console.error('Create notice error:', error);
    req.flash('error_msg', 'Unable to publish notice');
    res.redirect('/notices/admin/new');
  }
});

// Admin: Edit notice form
router.get('/admin/:id/edit', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const notice = await prisma.notice.findUnique({
      where: { id: req.params.id },
    });

    if (!notice) {
      req.flash('error_msg', 'Notice not found');
      return res.redirect('/notices');
    }

    res.render('notices/form', { title: 'Edit Notice', notice });
  } catch (error) {
    console.error('Edit notice error:', error);
    req.flash('error_msg', 'Unable to load notice');
    res.redirect('/notices');
  }
});

// Admin: Update notice
router.post('/:id', ensureAuth, ensureAdmin, upload.single('attachment'), async (req, res) => {
  try {
    const { title, body, category, validUntil, isUrgent } = req.body;

    const updateData = {
      title,
      body,
      category,
      validUntil: validUntil ? new Date(validUntil) : null,
      isUrgent: isUrgent === 'on',
    };

    if (req.file) {
      updateData.attachmentUrl = req.file.path;
    }

    await prisma.notice.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await logAction('UPDATE', 'Notice', req.params.id, { title, category }, req.user.id);

    req.flash('success_msg', 'Notice updated successfully');
    res.redirect('/notices');
  } catch (error) {
    console.error('Update notice error:', error);
    req.flash('error_msg', 'Unable to update notice');
    res.redirect('/notices');
  }
});

// Admin: Delete notice
router.post('/:id/delete', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    await prisma.notice.update({
      where: { id: req.params.id },
      data: { status: 'deleted' },
    });

    await logAction('DELETE', 'Notice', req.params.id, {}, req.user.id);

    req.flash('success_msg', 'Notice deleted successfully');
    res.redirect('/notices');
  } catch (error) {
    console.error('Delete notice error:', error);
    req.flash('error_msg', 'Unable to delete notice');
    res.redirect('/notices');
  }
});

module.exports = router;
