const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { ensureAuth, ensureNotPending } = require('../middleware/auth');

router.get('/', ensureAuth, ensureNotPending, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = user.role === 'admin';
    const isAccountant = user.role === 'accountant';
    const isOwner = user.role === 'owner';

    // Fetch notices
    const notices = await prisma.notice.findMany({
      where: {
        status: 'active',
        validUntil: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { author: { select: { firstName: true, lastName: true } } },
    });

    // Mark unread notices
    const unreadCount = await prisma.notice.count({
      where: {
        status: 'active',
        NOT: { readBy: { has: user.id } },
      },
    });

    let paymentSummary = null;
    let upcomingSchedules = [];
    let activeProjects = [];
    let expenseSummary = null;

    // Owner-specific data
    if (isOwner || isAdmin) {
      const unitIds = isAdmin ? [] : (await prisma.unit.findMany({
        where: { ownerId: user.id },
        select: { id: true },
      })).map(u => u.id);

      if (unitIds.length > 0 || isAdmin) {
        const paymentWhere = isAdmin ? {} : { unitId: { in: unitIds } };

        const payments = await prisma.payment.findMany({
          where: paymentWhere,
          orderBy: { dueDate: 'desc' },
          take: 10,
          include: { unit: { select: { unitNumber: true, building: true } } },
        });

        const totalBilled = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.paidAmount), 0);
        const totalDue = payments.filter(p => p.status === 'due' || p.status === 'overdue')
          .reduce((sum, p) => sum + Number(p.balance), 0);
        const overdueCount = payments.filter(p => p.status === 'overdue').length;

        paymentSummary = {
          totalBilled,
          totalPaid,
          totalDue,
          balance: totalBilled - totalPaid,
          overdueCount,
          recentPayments: payments,
        };
      }
    }

    // Upcoming schedules
    upcomingSchedules = await prisma.schedule.findMany({
      where: { startDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
      take: 5,
      include: { creator: { select: { firstName: true, lastName: true } } },
    });

    // Active projects
    activeProjects = await prisma.project.findMany({
      where: { status: { in: ['planned', 'in_progress'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Expense summary (for owners/accountants/admins)
    if (isOwner || isAccountant || isAdmin) {
      const totalExpenses = await prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
      });
      const expenseCount = await prisma.ledgerEntry.count();

      expenseSummary = {
        total: Number(totalExpenses._sum.amount) || 0,
        count: expenseCount,
      };
    }

    res.render('dashboard', {
      title: 'Dashboard',
      notices,
      unreadCount,
      paymentSummary,
      upcomingSchedules,
      activeProjects,
      expenseSummary,
      isAdmin,
      isAccountant,
      isOwner,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error_msg', 'Unable to load dashboard');
    res.render('dashboard', { title: 'Dashboard', error: true });
  }
});

module.exports = router;
