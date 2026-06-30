const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { ensureAuth, ensureAdmin } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');

// Admin dashboard
router.get('/dashboard', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalUnits,
      totalNotices,
      totalPayments,
      totalLedgerEntries,
      totalProjects,
      pendingUsers,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.unit.count(),
      prisma.notice.count({ where: { status: 'active' } }),
      prisma.payment.count(),
      prisma.ledgerEntry.count(),
      prisma.project.count(),
      prisma.user.count({ where: { role: 'pending' } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
    ]);

    // Financial summary
    const paymentSummary = await prisma.payment.aggregate({
      _sum: { amount: true, paidAmount: true },
    });

    const ledgerSummary = await prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
    });

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalUsers,
        totalUnits,
        totalNotices,
        totalPayments,
        totalLedgerEntries,
        totalProjects,
        pendingUsers,
        totalBilled: Number(paymentSummary._sum.amount) || 0,
        totalPaid: Number(paymentSummary._sum.paidAmount) || 0,
        totalExpenses: Number(ledgerSummary._sum.amount) || 0,
      },
      recentAuditLogs,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    req.flash('error_msg', 'Unable to load admin dashboard');
    res.redirect('/dashboard');
  }
});

// Users management
router.get('/users', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const { role, status } = req.query;
    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;

    const [users, units] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          ownedUnits: true,
          residentUnits: true,
        },
      }),
      prisma.unit.findMany({
        orderBy: { unitNumber: 'asc' },
      }),
    ]);

    res.render('admin/users', {
      title: 'User Management',
      users,
      units,
      selectedRole: role,
      selectedStatus: status,
    });
  } catch (error) {
    console.error('Users management error:', error);
    req.flash('error_msg', 'Unable to load users');
    res.redirect('/admin/dashboard');
  }
});

// Update user role/status
router.post('/users/:id', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const { role, status, unitId, unitRole } = req.body;
    const { id } = req.params;

    const updateData = {};
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Assign unit if provided
    if (unitId && unitRole) {
      if (unitRole === 'owner') {
        await prisma.unit.update({
          where: { id: unitId },
          data: { ownerId: id },
        });
      } else if (unitRole === 'resident') {
        await prisma.unit.update({
          where: { id: unitId },
          data: { residentId: id },
        });
      }
    }

    await logAction('UPDATE', 'User', id, { role, status }, req.user.id);

    req.flash('success_msg', 'User updated successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Update user error:', error);
    req.flash('error_msg', 'Unable to update user');
    res.redirect('/admin/users');
  }
});

// Units management
router.get('/units', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const units = await prisma.unit.findMany({
      orderBy: [{ building: 'asc' }, { unitNumber: 'asc' }],
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    const users = await prisma.user.findMany({
      where: { status: 'active', role: { in: ['owner', 'resident'] } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });

    res.render('admin/units', {
      title: 'Unit Management',
      units,
      users,
    });
  } catch (error) {
    console.error('Units management error:', error);
    req.flash('error_msg', 'Unable to load units');
    res.redirect('/admin/dashboard');
  }
});

// Create unit
router.post('/units', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const { unitNumber, building, floor, ownerId, residentId } = req.body;

    await prisma.unit.create({
      data: {
        unitNumber,
        building: building || 'Main',
        floor: floor || null,
        ownerId: ownerId || null,
        residentId: residentId || null,
      },
    });

    await logAction('CREATE', 'Unit', null, { unitNumber, building }, req.user.id);

    req.flash('success_msg', 'Unit created successfully');
    res.redirect('/admin/units');
  } catch (error) {
    console.error('Create unit error:', error);
    req.flash('error_msg', 'Unable to create unit');
    res.redirect('/admin/units');
  }
});

// Audit logs
router.get('/audit-logs', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const { entity, userId, page = 1 } = req.query;
    const limit = 50;
    const skip = (parseInt(page) - 1) * limit;

    const where = {};
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const [logs, totalCount, users] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
      prisma.user.findMany({ select: { id: true, firstName: true, lastName: true } }),
    ]);

    res.render('admin/audit-logs', {
      title: 'Audit Logs',
      logs,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      users,
      selectedEntity: entity,
      selectedUser: userId,
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    req.flash('error_msg', 'Unable to load audit logs');
    res.redirect('/admin/dashboard');
  }
});

module.exports = router;
