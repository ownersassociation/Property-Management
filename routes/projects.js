const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../config/database');
const { ensureAuth, ensureAdmin, ensureNotPending } = require('../middleware/auth');
const { photoStorage, cloudinary } = require('../config/cloudinary');
const { logAction } = require('../middleware/audit');

const upload = multer({ storage: photoStorage });

// List projects
router.get('/', ensureAuth, ensureNotPending, async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { creator: { select: { firstName: true, lastName: true } } },
    });

    res.render('projects/index', {
      title: 'Ongoing Projects',
      projects,
      selectedStatus: status,
      isAdmin: req.user.role === 'admin',
    });
  } catch (error) {
    console.error('Projects error:', error);
    req.flash('error_msg', 'Unable to load projects');
    res.redirect('/dashboard');
  }
});

// View project
router.get('/:id', ensureAuth, ensureNotPending, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { creator: { select: { firstName: true, lastName: true } } },
    });

    if (!project) {
      req.flash('error_msg', 'Project not found');
      return res.redirect('/projects');
    }

    res.render('projects/show', {
      title: project.title,
      project,
      isAdmin: req.user.role === 'admin',
    });
  } catch (error) {
    console.error('Project detail error:', error);
    req.flash('error_msg', 'Unable to load project');
    res.redirect('/projects');
  }
});

// Admin: New project form
router.get('/admin/new', ensureAuth, ensureAdmin, (req, res) => {
  res.render('projects/form', { title: 'New Project', project: null });
});

// Admin: Create project
router.post('/', ensureAuth, ensureAdmin, upload.array('photos', 5), async (req, res) => {
  try {
    const { title, description, status, startDate, targetDate, budget } = req.body;

    const photos = req.files?.map(f => f.path) || [];

    const project = await prisma.project.create({
      data: {
        title,
        description,
        status: status || 'planned',
        startDate: startDate ? new Date(startDate) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
        budget: budget ? parseFloat(budget) : null,
        photos,
        createdBy: req.user.id,
      },
    });

    await logAction('CREATE', 'Project', project.id, { title, status }, req.user.id);

    req.flash('success_msg', 'Project created successfully');
    res.redirect('/projects');
  } catch (error) {
    console.error('Create project error:', error);
    req.flash('error_msg', 'Unable to create project');
    res.redirect('/projects/admin/new');
  }
});

// Admin: Update project
router.post('/:id', ensureAuth, ensureAdmin, upload.array('photos', 5), async (req, res) => {
  try {
    const { title, description, status, startDate, targetDate, budget, actualCost } = req.body;

    const updateData = {
      title,
      description,
      status,
      startDate: startDate ? new Date(startDate) : null,
      targetDate: targetDate ? new Date(targetDate) : null,
      budget: budget ? parseFloat(budget) : null,
      actualCost: actualCost ? parseFloat(actualCost) : null,
    };

    if (req.files?.length > 0) {
      const newPhotos = req.files.map(f => f.path);
      const existing = await prisma.project.findUnique({
        where: { id: req.params.id },
        select: { photos: true },
      });
      updateData.photos = [...(existing?.photos || []), ...newPhotos];
    }

    await prisma.project.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await logAction('UPDATE', 'Project', req.params.id, { title, status }, req.user.id);

    req.flash('success_msg', 'Project updated successfully');
    res.redirect('/projects');
  } catch (error) {
    console.error('Update project error:', error);
    req.flash('error_msg', 'Unable to update project');
    res.redirect('/projects');
  }
});

module.exports = router;
