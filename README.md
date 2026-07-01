# Property-Management Portal
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
