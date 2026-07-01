# Property Management Portal v2.0

A production-ready web application for residential property/society management built with Node.js, Express, Neon PostgreSQL, and Cloudinary.

## Features

- **Local Authentication** - Email/password with bcrypt hashing (no Google OAuth needed)
- **Role-Based Access** - Admin, Accountant, Owner, Resident, Pending
- **Expense Dashboard** - Full Chart.js visualizations with filters
- **Ledger Management** - Accountants can add/edit expenses with receipt uploads
- **Payment Tracking** - Maintenance dues with status indicators
- **Notice Board** - Categorized announcements with read tracking
- **Project Tracking** - Progress tracking with photo uploads
- **Maintenance Calendar** - Event scheduling with month view
- **Document Vault** - Secure file storage per unit
- **Audit Logging** - All admin actions tracked

## Tech Stack

| Component | Technology | Free Tier |
|-----------|-----------|-----------|
| Database | Neon PostgreSQL | 500 MB, 100 compute hours |
| ORM | Prisma | Free |
| Auth | bcryptjs (local) | Free |
| File Storage | Cloudinary | 25 GB storage |
| Hosting | Vercel / Render | 100 GB bandwidth |
| Charts | Chart.js | Free |
| UI | Bootstrap 5 | Free |

## Quick Start

### 1. Clone & Install
```bash
git clone <your-repo>
cd property-management-portal
npm install
```

### 2. Set up Neon PostgreSQL
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy both connection strings:
   - **Pooled** (for app): `ep-xxx-pooler.region.aws.neon.tech`
   - **Direct** (for migrations): `ep-xxx.region.aws.neon.tech`

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your Neon and Cloudinary credentials
```

### 4. Set up Cloudinary
1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Get your Cloud Name, API Key, API Secret from Dashboard
3. Add to `.env`

### 5. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run migrations (uses DIRECT_URL)
npx prisma migrate dev --name init

# Seed with sample data
npm run db:seed
```

### 6. Run Locally
```bash
npm run dev
# Open http://localhost:3000
```

### 7. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
vercel --prod
```

**Important**: Set environment variables in Vercel Dashboard:
- `DATABASE_URL` (pooled Neon connection)
- `DIRECT_URL` (direct Neon connection)
- `SESSION_SECRET`
- `CLOUDINARY_*`
- `ADMIN_EMAILS`
- `ACCOUNTANT_EMAILS`

## Default Credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `Admin@123` |
| Accountant | `accountant@example.com` | `Accountant@123` |

## Project Structure

```
property-management-portal/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.js                # Sample data
├── config/
│   ├── database.js            # Prisma singleton
│   └── cloudinary.js          # File storage config
├── middleware/
│   ├── auth.js                # Role-based access
│   └── audit.js               # Action logging
├── routes/
│   ├── auth.js                # Login/register
│   ├── dashboard.js           # Main dashboard
│   ├── expenses.js            # Expense reports
│   ├── accountant.js          # Ledger management
│   ├── payments.js            # Payment tracking
│   ├── notices.js             # Announcements
│   ├── projects.js            # Project tracking
│   ├── schedule.js            # Calendar
│   ├── documents.js           # File vault
│   └── admin.js              # Admin panel
├── views/                     # EJS templates
├── public/                    # Static assets
├── server.js                  # Express entry
├── package.json
├── vercel.json               # Vercel config
└── .env.example
```

## License
MIT
