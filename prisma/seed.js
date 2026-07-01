const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn'] : ['warn'],
});

async function main() {
  console.log('Starting database seed...');

  try {
    // Create admin user
    const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || 'admin@example.com';
    const adminPassword = await bcrypt.hash('Admin@123', 12);

    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        password: adminPassword,
        firstName: 'System',
        lastName: 'Admin',
        role: 'admin',
        status: 'active',
      },
    });
    console.log('Admin user:', admin.email);

    // Create accountant user
    const accountantEmail = process.env.ACCOUNTANT_EMAILS?.split(',')[0]?.trim() || 'accountant@example.com';
    const accountantPassword = await bcrypt.hash('Accountant@123', 12);

    const accountant = await prisma.user.upsert({
      where: { email: accountantEmail },
      update: {},
      create: {
        email: accountantEmail,
        password: accountantPassword,
        firstName: 'Society',
        lastName: 'Accountant',
        role: 'accountant',
        status: 'active',
      },
    });
    console.log('Accountant user:', accountant.email);

    // Create sample units (skip if exist)
    const units = [];
    for (let i = 1; i <= 10; i++) {
      const unit = await prisma.unit.upsert({
        where: { 
          unitNumber_building: { 
            unitNumber: `A-${String(i).padStart(3, '0')}`, 
            building: 'Tower A' 
          } 
        },
        update: {},
        create: {
          unitNumber: `A-${String(i).padStart(3, '0')}`,
          building: 'Tower A',
          floor: String(Math.ceil(i / 2)),
        },
      });
      units.push(unit);
    }
    console.log(`${units.length} sample units ready`);

    // Create sample notices (only if none exist)
    const noticeCount = await prisma.notice.count();
    if (noticeCount === 0) {
      const notices = [
        { title: 'Welcome to the Portal', body: 'The new property management portal is now live. Please log in to view your notices, payments, and documents.', category: 'general' },
        { title: 'Monthly Maintenance Due', body: 'Maintenance charges for July 2026 are due by 15th July. Please check your payment dashboard.', category: 'billing' },
        { title: 'Water Tank Cleaning', body: 'Water tank cleaning scheduled for 10th July 2026. Water supply will be disrupted from 10 AM to 2 PM.', category: 'maintenance' },
        { title: 'Annual General Meeting', body: 'AGM scheduled for 25th July 2026 at 6 PM in the community hall. All owners are requested to attend.', category: 'event' },
      ];

      for (const n of notices) {
        await prisma.notice.create({
          data: { ...n, createdBy: admin.id },
        });
      }
      console.log('Sample notices created');
    } else {
      console.log('Notices already exist, skipping');
    }

    // Create sample ledger entries (only if none exist)
    const ledgerCount = await prisma.ledgerEntry.count();
    if (ledgerCount === 0) {
      const categories = ['Maintenance', 'Security', 'Electricity', 'Water', 'Gardening', 'Repairs', 'Insurance'];
      const vendors = ['ABC Maintenance', 'SecureGuard Services', 'PowerGrid Corp', 'AquaSupply Ltd', 'GreenThumb Landscaping', 'City Repairs', 'SafeCover Insurance'];

      for (let i = 0; i < 20; i++) {
        const date = new Date(2026, 0, 1);
        date.setDate(date.getDate() + i * 15);

        await prisma.ledgerEntry.create({
          data: {
            date,
            billRefNo: `BR-2026-${String(i + 1).padStart(4, '0')}`,
            category: categories[i % categories.length],
            vendor: vendors[i % vendors.length],
            description: `Expense for ${categories[i % categories.length]} services`,
            amount: Math.floor(Math.random() * 50000) + 5000,
            paymentMode: i % 3 === 0 ? 'Cash' : 'Bank Transfer',
            createdBy: accountant.id,
          },
        });
      }
      console.log('20 sample ledger entries created');
    } else {
      console.log('Ledger entries already exist, skipping');
    }

    // Create sample payments (only if none exist)
    const paymentCount = await prisma.payment.count();
    if (paymentCount === 0) {
      for (let i = 0; i < 6; i++) {
        const dueDate = new Date(2026, i, 5);
        const amount = 15000;
        const isPaid = i < 4;

        await prisma.payment.create({
          data: {
            unitId: units[0].id,
            description: `Maintenance charges - ${dueDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
            amount,
            paidAmount: isPaid ? amount : 0,
            balance: isPaid ? 0 : amount,
            dueDate,
            paidDate: isPaid ? dueDate : null,
            status: isPaid ? 'paid' : (i === 4 ? 'overdue' : 'due'),
            recordedBy: accountant.id,
          },
        });
      }
      console.log('Sample payments created');
    } else {
      console.log('Payments already exist, skipping');
    }

    // Create sample project (only if none exist)
    const projectCount = await prisma.project.count();
    if (projectCount === 0) {
      await prisma.project.create({
        data: {
          title: 'Lobby Renovation',
          description: 'Complete renovation of the main lobby including new flooring, lighting, and furniture.',
          status: 'in_progress',
          startDate: new Date('2026-06-01'),
          targetDate: new Date('2026-08-15'),
          budget: 250000,
          actualCost: 125000,
          createdBy: admin.id,
        },
      });
      console.log('Sample project created');
    } else {
      console.log('Projects already exist, skipping');
    }

    // Create sample schedule (only if none exist)
    const scheduleCount = await prisma.schedule.count();
    if (scheduleCount === 0) {
      await prisma.schedule.create({
        data: {
          title: 'Elevator AMC Visit',
          description: 'Quarterly maintenance visit by elevator service provider.',
          category: 'amc',
          startDate: new Date('2026-07-10T10:00:00Z'),
          endDate: new Date('2026-07-10T12:00:00Z'),
          location: 'All Towers',
          createdBy: admin.id,
        },
      });
      console.log('Sample schedule created');
    } else {
      console.log('Schedules already exist, skipping');
    }

    console.log('\nSeed completed successfully!');
    console.log('\nDefault credentials:');
    console.log(`  Admin:      ${adminEmail} / Admin@123`);
    console.log(`  Accountant: ${accountantEmail} / Accountant@123`);

  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
