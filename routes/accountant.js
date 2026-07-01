const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../config/database');
const { ensureAuth, canManageLedger } = require('../middleware/auth');
const { receiptStorage, cloudinary } = require('../config/cloudinary');
const { logAction } = require('../middleware/audit');

const upload = multer({ storage: receiptStorage });

// Accountant dashboard
router.get('/dashboard', ensureAuth, canManageLedger, async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const [monthlyTotal, yearlyTotal, totalEntries, recentEntries, categoryBreakdown] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: { date: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { date: { gte: startOfYear } },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.count(),
      prisma.ledgerEntry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { author: { select: { firstName: true, lastName: true } } },
      }),
      prisma.ledgerEntry.groupBy({
        by: ['category'],
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),
    ]);

    res.render('accountant/dashboard', {
      title: 'Accountant Dashboard',
      stats: {
        monthlyTotal: Number(monthlyTotal._sum.amount) || 0,
        yearlyTotal: Number(yearlyTotal._sum.amount) || 0,
        totalEntries,
      },
      recentEntries,
      categoryBreakdown: categoryBreakdown.map(c => ({
        category: c.category,
        amount: Number(c._sum.amount) || 0,
      })),
    });
  } catch (error) {
    console.error('Accountant dashboard error:', error);
    req.flash('error_msg', 'Unable to load accountant dashboard');
    res.redirect('/dashboard');
  }
});

// New ledger entry form
router.get('/ledger/new', ensureAuth, canManageLedger, async (req, res) => {
  try {
    const categories = await prisma.ledgerEntry.findMany({
      distinct: ['category'],
      select: { category: true },
    });

    res.render('accountant/ledger-form', {
      title: 'New Ledger Entry',
      categories: categories.map(c => c.category),
      entry: null,
    });
  } catch (error) {
    console.error('Ledger form error:', error);
    req.flash('error_msg', 'Unable to load form');
    res.redirect('/accountant/dashboard');
  }
});

// Create ledger entry
router.post('/ledger', ensureAuth, canManageLedger, upload.single('receipt'), async (req, res) => {
  try {
    const { date, billRefNo, category, vendor, description, amount, paymentMode, notes } = req.body;

    // Validation
    if (!date || !billRefNo || !category || !vendor || !description || !amount) {
      req.flash('error_msg', 'Please fill in all required fields');
      return res.redirect('/accountant/ledger/new');
    }

    // Check duplicate bill ref
    const existing = await prisma.ledgerEntry.findUnique({
      where: { billRefNo },
    });
    if (existing) {
      req.flash('error_msg', `Bill Ref No ${billRefNo} already exists`);
      return res.redirect('/accountant/ledger/new');
    }

    const entry = await prisma.ledgerEntry.create({
      data: {
        date: new Date(date),
        billRefNo,
        category,
        vendor,
        description,
        amount: parseFloat(amount),
        paymentMode: paymentMode || 'Bank Transfer',
        receiptUrl: req.file?.path || null,
        receiptPublicId: req.file?.filename || null,
        notes: notes || null,
        createdBy: req.user.id,
      },
    });

    await logAction('CREATE', 'LedgerEntry', entry.id, {
      billRefNo, category, amount, vendor
    }, req.user.id);

    req.flash('success_msg', `Ledger entry ${billRefNo} created successfully`);
    res.redirect('/expenses');
  } catch (error) {
    console.error('Create ledger error:', error);
    req.flash('error_msg', 'Unable to create ledger entry');
    res.redirect('/accountant/ledger/new');
  }
});

// Edit ledger entry form
router.get('/ledger/:id/edit', ensureAuth, canManageLedger, async (req, res) => {
  try {
    const entry = await prisma.ledgerEntry.findUnique({
      where: { id: req.params.id },
    });

    if (!entry) {
      req.flash('error_msg', 'Ledger entry not found');
      return res.redirect('/expenses');
    }

    const categories = await prisma.ledgerEntry.findMany({
      distinct: ['category'],
      select: { category: true },
    });

    res.render('accountant/ledger-form', {
      title: 'Edit Ledger Entry',
      categories: categories.map(c => c.category),
      entry,
    });
  } catch (error) {
    console.error('Edit ledger form error:', error);
    req.flash('error_msg', 'Unable to load entry');
    res.redirect('/expenses');
  }
});

// Update ledger entry
router.post('/ledger/:id', ensureAuth, canManageLedger, upload.single('receipt'), async (req, res) => {
  try {
    const { date, billRefNo, category, vendor, description, amount, paymentMode, notes } = req.body;
    const { id } = req.params;

    const existing = await prisma.ledgerEntry.findUnique({ where: { id } });
    if (!existing) {
      req.flash('error_msg', 'Ledger entry not found');
      return res.redirect('/expenses');
    }

    const updateData = {
      date: new Date(date),
      billRefNo,
      category,
      vendor,
      description,
      amount: parseFloat(amount),
      paymentMode: paymentMode || 'Bank Transfer',
      notes: notes || null,
    };

    // Handle receipt upload
    if (req.file) {
      // Delete old receipt from Cloudinary if exists
      if (existing.receiptPublicId) {
        await cloudinary.uploader.destroy(existing.receiptPublicId);
      }
      updateData.receiptUrl = req.file.path;
      updateData.receiptPublicId = req.file.filename;
    }

    const entry = await prisma.ledgerEntry.update({
      where: { id },
      data: updateData,
    });

    await logAction('UPDATE', 'LedgerEntry', id, {
      billRefNo, category, amount, vendor
    }, req.user.id);

    req.flash('success_msg', `Ledger entry ${billRefNo} updated successfully`);
    res.redirect('/expenses');
  } catch (error) {
    console.error('Update ledger error:', error);
    req.flash('error_msg', 'Unable to update ledger entry');
    res.redirect(`/expenses/${req.params.id}`);
  }
});

// Delete ledger entry
router.post('/ledger/:id/delete', ensureAuth, canManageLedger, async (req, res) => {
  try {
    const entry = await prisma.ledgerEntry.findUnique({
      where: { id: req.params.id },
    });

    if (!entry) {
      req.flash('error_msg', 'Ledger entry not found');
      return res.redirect('/expenses');
    }

    // Delete receipt from Cloudinary if exists
    if (entry.receiptPublicId) {
      await cloudinary.uploader.destroy(entry.receiptPublicId);
    }

    await prisma.ledgerEntry.delete({
      where: { id: req.params.id },
    });

    await logAction('DELETE', 'LedgerEntry', req.params.id, {
      billRefNo: entry.billRefNo
    }, req.user.id);

    req.flash('success_msg', 'Ledger entry deleted successfully');
    res.redirect('/expenses');
  } catch (error) {
    console.error('Delete ledger error:', error);
    req.flash('error_msg', 'Unable to delete ledger entry');
    res.redirect('/expenses');
  }
});

// Bulk import ledger entries (CSV/JSON)
router.post('/ledger/import', ensureAuth, canManageLedger, async (req, res) => {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'No entries provided' });
    }

    const created = [];
    const errors = [];

    for (const item of entries) {
      try {
        // Check for duplicate
        const existing = await prisma.ledgerEntry.findUnique({
          where: { billRefNo: item.billRefNo },
        });

        if (existing) {
          errors.push({ billRefNo: item.billRefNo, error: 'Duplicate Bill Ref No' });
          continue;
        }

        const entry = await prisma.ledgerEntry.create({
          data: {
            date: new Date(item.date),
            billRefNo: item.billRefNo,
            category: item.category,
            vendor: item.vendor,
            description: item.description,
            amount: parseFloat(item.amount),
            paymentMode: item.paymentMode || 'Bank Transfer',
            createdBy: req.user.id,
          },
        });
        created.push(entry);
      } catch (err) {
        errors.push({ billRefNo: item.billRefNo, error: err.message });
      }
    }

    await logAction('BULK_IMPORT', 'LedgerEntry', null, {
      created: created.length,
      errors: errors.length
    }, req.user.id);

    res.json({ success: true, created: created.length, errors });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Import failed' });
  }
});

module.exports = router;
