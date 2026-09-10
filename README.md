# GIIT Fee Management — Production-Ready Backend

**Global Institute of Information & Technology (GIIT)**  
**Campus Portal Fee Management Backend & Online Payment Engine**

> [!NOTE]
> This repository contains the complete, production-ready backend architecture for the GIIT Fee Management web application. The backend is built to run independently and connect to the existing frontend.

For comprehensive technical documentation, SQL schema design, Razorpay verification workflows, and the Frontend Integration Contract, please refer to:
- [`backend/README.md`](./backend/README.md)
- [`backend/database/schema/schema.sql`](./backend/database/schema/schema.sql)

## Quick Start

```bash
# Install dependencies
npm install

# Run automated test suite (Tests 1-17 + Critical Isolation Tests)
npm test

# Run HTTP REST API integration suite
npm run test:api

# (Optional) Seed demo data
npm run seed

# Start development server on port 3000
npm run dev
```

Admin default credentials:
- **Username**: `admin@giit.ac.in`
- **Password**: `Admin@GIIT2026`
