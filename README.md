# Property-Management

## Environment setup

1. Copy [.env.example](.env.example) to .env.
2. Update the values for your local database, session secret, and Cloudinary credentials.
3. Restart the app after changing environment variables.

Example:

```bash
cp .env.example .env
```

The zip file is ready for download:

**[property-management-portal.zip](sandbox:///mnt/agents/output/property-management-portal.zip)**

📦 **File Details:**
- **Size:** 61.6 KB (63,073 bytes)
- **Files:** 46 files
- **Format:** Standard ZIP archive

**To download to your local computer:**
1. Click the link above, or
2. Right-click → "Save Link As..." to save the `.zip` file to your Downloads folder
3. Extract with any ZIP utility (Windows Explorer, macOS Archive Utility, 7-Zip, etc.)

**Project Structure:**
```
property-management-portal/
├── server.js                    # Express app entry point
├── package.json                 # Dependencies
├── .env.example                 # Environment template
├── prisma/
│   ├── schema.prisma            # Database schema (PostgreSQL)
│   └── seed.js                  # Sample data seed
├── config/
│   ├── database.js              # Prisma client
│   └── cloudinary.js            # Cloudinary file storage
├── middleware/
│   ├── auth.js                  # Role-based access control
│   └── audit.js                 # Action logging
├── routes/                      # 10 route files
│   ├── auth.js, dashboard.js, expenses.js
│   ├── accountant.js, payments.js, notices.js
│   ├── projects.js, schedule.js, documents.js
│   └── admin.js
├── views/                       # 26 EJS templates
│   ├── layouts/, partials/
│   ├── auth/, dashboard.ejs
│   ├── expenses/ (with Chart.js)
│   ├── accountant/, admin/
│   ├── notices/, payments/
│   ├── projects/, schedule/
│   └── documents/, 404.ejs, error.ejs
└── public/
    ├── css/style.css
    └── js/main.js
```
