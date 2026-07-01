const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { ensureAuth, ensureAdmin, ensureNotPending } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');

// Calendar view
router.get('/', ensureAuth, ensureNotPending, async (req, res) => {
  try {
    const { month, year, category } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const where = {
      startDate: { gte: startOfMonth, lte: endOfMonth },
    };
    if (category) where.category = category;

    const [schedules, categories] = await Promise.all([
      prisma.schedule.findMany({
        where,
        orderBy: { startDate: 'asc' },
        include: { creator: { select: { firstName: true, lastName: true } } },
      }),
      prisma.schedule.findMany({
        distinct: ['category'],
        select: { category: true },
      }),
    ]);

    // Group by date for calendar
    const eventsByDate = {};
    schedules.forEach(s => {
      const dateKey = s.startDate.toISOString().split('T')[0];
      if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
      eventsByDate[dateKey].push(s);
    });

    res.render('schedule/index', {
      title: 'Maintenance Calendar',
      schedules,
      eventsByDate,
      categories: categories.map(c => c.category),
      selectedCategory: category,
      currentMonth: targetMonth,
      currentYear: targetYear,
      monthNames: ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'],
      isAdmin: req.user.role === 'admin',
    });
  } catch (error) {
    console.error('Schedule error:', error);
    req.flash('error_msg', 'Unable to load schedule');
    res.redirect('/dashboard');
  }
});

// Admin: Create schedule
router.post('/', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const { title, description, category, startDate, endDate, location, allDay } = req.body;

    const schedule = await prisma.schedule.create({
      data: {
        title,
        description,
        category: category || 'other',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        location: location || null,
        allDay: allDay === 'on',
        createdBy: req.user.id,
      },
    });

    await logAction('CREATE', 'Schedule', schedule.id, { title, category }, req.user.id);

    req.flash('success_msg', 'Event scheduled successfully');
    res.redirect('/schedule');
  } catch (error) {
    console.error('Create schedule error:', error);
    req.flash('error_msg', 'Unable to schedule event');
    res.redirect('/schedule');
  }
});

// Admin: Delete schedule
router.post('/:id/delete', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    await prisma.schedule.delete({
      where: { id: req.params.id },
    });

    await logAction('DELETE', 'Schedule', req.params.id, {}, req.user.id);

    req.flash('success_msg', 'Event removed successfully');
    res.redirect('/schedule');
  } catch (error) {
    console.error('Delete schedule error:', error);
    req.flash('error_msg', 'Unable to remove event');
    res.redirect('/schedule');
  }
});

module.exports = router;
