# Production Deployment Checklist

## Pre-Deployment

### 1. Environment Variables (REQUIRED)
Create a `.env` file with ALL of these:

```bash
# Database - Neon PostgreSQL
# Get from Neon Dashboard -> Connection Details
# Use POOLED connection for DATABASE_URL (has "-pooler" in hostname)
DATABASE_URL="postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require"

# Use DIRECT connection for DIRECT_URL (no "-pooler" in hostname)
DIRECT_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"

# Session Secret - Generate with: openssl rand -base64 64
SESSION_SECRET="your-64-character-random-string-here"

# Cloudinary - Get from Cloudinary Dashboard
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# App
NODE_ENV=production
APP_URL=https://your-app.vercel.app

# Admin & Accountant emails (comma-separated)
ADMIN_EMAILS=admin@yourdomain.com
ACCOUNTANT_EMAILS=accountant@yourdomain.com
```

### 2. Neon PostgreSQL Setup
1. Sign up at [neon.tech](https://neon.tech)
2. Create project
3. Get TWO connection strings:
   - **Pooled** (for app): `ep-xxx-pooler.us-east-1.aws.neon.tech`
   - **Direct** (for migrations): `ep-xxx.us-east-1.aws.neon.tech`
4. Add to `.env`

### 3. Cloudinary Setup
1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Go to Dashboard
3. Copy Cloud Name, API Key, API Secret
4. Add to `.env`

### 4. Local Testing
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (uses DIRECT_URL)
npx prisma migrate dev --name init

# Seed database
npm run db:seed

# Start development server
npm run dev

# Test at http://localhost:3000
# Login: admin@example.com / Admin@123
```

### 5. Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

**Set environment variables in Vercel Dashboard:**
- Go to Project Settings -> Environment Variables
- Add ALL variables from `.env`
- Redeploy after adding variables

## Post-Deployment

### 6. Verify Deployment
- [ ] Health check: `https://your-app.vercel.app/health`
- [ ] Login page loads
- [ ] Can login with admin credentials
- [ ] Dashboard loads with data
- [ ] Expense dashboard shows charts
- [ ] Can create ledger entry
- [ ] Receipt upload works

### 7. Security Checklist
- [ ] SESSION_SECRET is strong (64+ chars)
- [ ] NODE_ENV=production
- [ ] No `.env` file in git
- [ ] Cloudinary uploads are secure
- [ ] Database uses SSL

### 8. Performance
- [ ] Images optimized via Cloudinary
- [ ] Compression enabled
- [ ] Rate limiting active

## Troubleshooting

### "Cannot find module '@prisma/client'"
```bash
npx prisma generate
```

### "Database connection failed"
- Check DATABASE_URL has `-pooler` in hostname
- Check DIRECT_URL does NOT have `-pooler`
- Verify SSL mode is `require`

### "Session not persisting"
- Ensure `SESSION_SECRET` is set
- Check `NODE_ENV=production`

### "Cloudinary upload failed"
- Verify Cloudinary credentials
- Check file size limits

## Free Tier Limits

| Service | Free Limit | Your Usage |
|---------|-----------|------------|
| Neon PostgreSQL | 500 MB, 100 hrs | ~50-100 MB for single society |
| Cloudinary | 25 GB storage | ~1-5 GB for receipts |
| Vercel | 100 GB bandwidth | Low for internal tool |

## Support

For issues, check:
1. Vercel logs: `vercel logs --all`
2. Neon status: status.neon.tech
3. Cloudinary status: status.cloudinary.com
