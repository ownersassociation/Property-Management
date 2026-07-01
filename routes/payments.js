const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../config/database');
const { ensureAuth, canViewFinancials, ensureAccountant } = require('../middleware/auth');
const { receiptStorage, cloudinary } = require('../config/cloudinary');
const { logAction } = require('../middleware/audit');

const upload = multer({ storage: receiptStorage });

// Owner: View payments
router.get('/', ensureAuth, canViewFinancials, async (req, res) => {
  try {
    const { status, unitId } = req.query;
    const isAdmin = req.user.role === 'admin';
    const isAccountant = req.user.role === 'accountant';

    let unitIds = [];
    if (!isAdmin && !isAccountant) {
      const units = await prisma.unit.findMany({
        where: { ownerId: req.user.id },
        select: { id: true },
      });
      unitIds = units.map(u => u.id);
    }

    const where = {};
    if (status) where.status = status;
    if (unitId && (isAdmin || isAccountant)) {
      where.unitId = unitId;
    } else if (unitIds.length > 0) {
      where.unitId = { in: unitIds };
    }

    const [payments, units] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { dueDate: 'desc' },
        include: {
          unit: { select: { unitNumber: true, building: true } },
          recorder: { select: { firstName: true, lastName: true } },
        },
      }),
      (isAdmin || isAccountant) ? prisma.unit.findMany({
        orderBy: { unitNumber: 'asc' },
        select: { id: true, unitNumber: true, building: true },
      }) : [],
    ]);

    // Calculate summary
    const summary = {
      totalBilled: payments.reduce((s, p) => s + Number(p.amount), 0),
      totalPaid: payments.reduce((s, p) => s + Number(p.paidAmount), 0),
      totalDue: payments.filter(p => p.status === 'due' || p.status === 'overdue')
        .reduce((s, p) => s + Number(p.balance), 0),
      overdueCount: payments.filter(p => p.status === 'overdue').length,
    };

    res.render('payments/index', {
      title: 'Payments & Dues',
      payments,
      units,
      summary,
      selectedStatus: status,
      selectedUnit: unitId,
      isAdmin,
      isAccountant,
    });
  } catch (error) {
    console.error('Payments error:', error);
    req.flash('error_msg', 'Unable to load payments');
    res.redirect('/dashboard');
  }
});

// Accountant/Admin: Record payment
router.post('/record', ensureAuth, ensureAccountant, upload.single('receipt'), async (req, res) => {
  try {
    const { unitId, description, amount, paidAmount, dueDate, status, notes } = req.body;

    if (!unitId || !description || !amount || !dueDate) {
      req.flash('error_msg', 'Please fill in all required fields');
      return res.redirect('/payments');
    }

    const balance = parseFloat(amount) - parseFloat(paidAmount || 0);
    const paymentStatus = status || (balance <= 0 ? 'paid' : (balance < parseFloat(amount) ? 'partial' : 'due'));

    const payment = await prisma.payment.create({
      data: {
        unitId,
        description,
        amount: parseFloat(amount),
        paidAmount: parseFloat(paidAmount || 0),
        balance,
        dueDate: new Date(dueDate),
        paidDate: paidAmount > 0 ? new Date() : null,
        status: paymentStatus,
        receiptUrl: req.file?.path || null,
        receiptPublicId: req.file?.filename || null,
        notes: notes || null,
        recordedBy: req.user.id,
      },
    });

    await logAction('CREATE', 'Payment', payment.id, { unitId, amount, status: paymentStatus }, req.user.id);

    req.flash('success_msg', 'Payment recorded successfully');
    res.redirect('/payments');
  } catch (error) {
    console.error('Record payment error:', error);
    req.flash('error_msg', 'Unable to record payment');
    res.redirect('/payments');
  }
});

// Accountant/Admin: Update payment
router.post('/:id', ensureAuth, ensureAccountant, upload.single('receipt'), async (req, res) => {
  try {
    const { paidAmount, status, notes } = req.body;
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      req.flash('error_msg', 'Payment not found');
      return res.redirect('/payments');
    }

    const newPaid = parseFloat(paidAmount || payment.paidAmount);
    const balance = Number(payment.amount) - newPaid;
    const newStatus = status || (balance <= 0 ? 'paid' : (balance < Number(payment.amount) ? 'partial' : 'due'));

    const updateData = {
      paidAmount: newPaid,
      balance,
      status: newStatus,
      paidDate: newPaid > 0 ? (payment.paidDate || new Date()) : null,
      notes: notes || payment.notes,
    };

    if (req.file) {
      if (payment.receiptPublicId) {
        await cloudinary.uploader.destroy(payment.receiptPublicId);
      }
      updateData.receiptUrl = req.file.path;
      updateData.receiptPublicId = req.file.filename;
    }

    await prisma.payment.update({
      where: { id },
      data: updateData,
    });

    await logAction('UPDATE', 'Payment', id, { status: newStatus, paidAmount: newPaid }, req.user.id);

    req.flash('success_msg', 'Payment updated successfully');
    res.redirect('/payments');
  } catch (error) {
    console.error('Update payment error:', error);
    req.flash('error_msg', 'Unable to update payment');
    res.redirect('/payments');
  }
});

module.exports = router;
