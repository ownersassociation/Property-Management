const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { ensureAuth, canViewFinancials } = require('../middleware/auth');

// Expense dashboard
router.get('/', ensureAuth, canViewFinancials, async (req, res) => {
  try {
    const { category, vendor, from, to, minAmount, maxAmount } = req.query;

    // Build filters
    const where = {};
    if (category) where.category = category;
    if (vendor) where.vendor = { contains: vendor, mode: 'insensitive' };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) where.amount.gte = parseFloat(minAmount);
      if (maxAmount) where.amount.lte = parseFloat(maxAmount);
    }

    // Fetch entries with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const [entries, totalCount] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: { author: { select: { firstName: true, lastName: true } } },
      }),
      prisma.ledgerEntry.count({ where }),
    ]);

    // Summary statistics
    const allEntries = await prisma.ledgerEntry.findMany({ where });

    const totalAmount = allEntries.reduce((sum, e) => sum + Number(e.amount), 0);
    const avgAmount = totalAmount / (allEntries.length || 1);

    // Category breakdown
    const categorySummary = {};
    allEntries.forEach(e => {
      categorySummary[e.category] = (categorySummary[e.category] || 0) + Number(e.amount);
    });

    // Monthly trends
    const monthlyTrends = {};
    allEntries.forEach(e => {
      const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
      monthlyTrends[key] = (monthlyTrends[key] || 0) + Number(e.amount);
    });
    const trends = Object.entries(monthlyTrends)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));

    // Vendor breakdown
    const vendorSummary = {};
    allEntries.forEach(e => {
      vendorSummary[e.vendor] = (vendorSummary[e.vendor] || 0) + Number(e.amount);
    });

    // Payment mode breakdown
    const paymentModeSummary = {};
    allEntries.forEach(e => {
      paymentModeSummary[e.paymentMode] = (paymentModeSummary[e.paymentMode] || 0) + Number(e.amount);
    });

    // Get unique filters
    const [categories, vendors] = await Promise.all([
      prisma.ledgerEntry.findMany({ distinct: ['category'], select: { category: true } }),
      prisma.ledgerEntry.findMany({ distinct: ['vendor'], select: { vendor: true } }),
    ]);

    res.render('expenses/index', {
      title: 'Expense Dashboard',
      entries,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      summary: {
        total: totalAmount,
        count: allEntries.length,
        average: avgAmount,
        categories: categorySummary,
        vendors: vendorSummary,
        paymentModes: paymentModeSummary,
      },
      trends,
      filters: {
        categories: categories.map(c => c.category),
        vendors: vendors.map(v => v.vendor),
        selectedCategory: category,
        selectedVendor: vendor,
        from,
        to,
        minAmount,
        maxAmount,
      },
      isAdmin: req.user.role === 'admin',
      isAccountant: req.user.role === 'accountant',
    });
  } catch (error) {
    console.error('Expense dashboard error:', error);
    req.flash('error_msg', 'Unable to load expense data');
    res.redirect('/dashboard');
  }
});

// Expense detail
router.get('/:id', ensureAuth, canViewFinancials, async (req, res) => {
  try {
    const entry = await prisma.ledgerEntry.findUnique({
      where: { id: req.params.id },
      include: { author: { select: { firstName: true, lastName: true, email: true } } },
    });

    if (!entry) {
      req.flash('error_msg', 'Expense entry not found');
      return res.redirect('/expenses');
    }

    res.render('expenses/show', { title: 'Expense Details', entry });
  } catch (error) {
    console.error('Expense detail error:', error);
    req.flash('error_msg', 'Unable to load expense details');
    res.redirect('/expenses');
  }
});

module.exports = router;
