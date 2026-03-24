# Honda Service Project

## Overview
This is a Next.js + Prisma + PostgreSQL project for managing Honda service operations, including sales, job cards, staff, inventory, and reporting.

---

## Prerequisites
- Node.js (v18+ recommended)
- npm (v9+ recommended)
- PostgreSQL (local or remote instance)
- Git

---

## Getting Started

### 1. Clone the Repository
```
git clone https://github.com/mwaqas3562/Honda-Service.git
cd Honda-Service
```

### 2. Install Dependencies
```
npm install
```

### 3. Environment Variables
Copy the example environment file and update values as needed:
```
cp .env.example .env
```
Edit `.env` and set your PostgreSQL connection string and any other required secrets.

### 4. Database Setup
#### a. Run Migrations
```
npx prisma migrate deploy
```
#### b. (Optional) Seed the Database
```
npx ts-node prisma/seed.ts
```
Or for admin seed:
```
npx ts-node prisma/seed-admin.ts
```

### 5. Generate Prisma Client
```
npx prisma generate
```

### 6. Start the Development Server
```
npx next dev
```
The app will be available at http://localhost:3000

---

## Production Build
```
npx next build
npx next start
```

---

## Project Structure
- `src/` — Main application code
- `prisma/` — Prisma schema, migrations, and seed scripts
- `scripts/` — Utility scripts
- `.next/` — Next.js build output (auto-generated)
- `node_modules/` — Dependencies (auto-generated)

---

## Common Commands
- **Run migrations:** `npx prisma migrate deploy`
- **Seed database:** `npx ts-node prisma/seed.ts`
- **Start dev server:** `npx next dev`
- **Build for production:** `npx next build`
- **Start production server:** `npx next start`

---

## Troubleshooting
- If you see database errors, check your `.env` connection string.
- If you change the Prisma schema, always run `npx prisma generate` after migrations.
- Delete `.next/` and rerun `npx next build` if you see stale build issues.

---

## Contributing
1. Create a new branch for your fix/feature:
	```
	git checkout -b your-feature-branch
	```
2. Make your changes and commit:
	```
	git add .
	git commit -m "Describe your change"
	```
3. Push to remote:
	```
	git push origin your-feature-branch
	```
4. Open a pull request to `develop` branch.

---

## Production Deployment Plan
- Ensure all code is merged into `develop` and tested.
- Merge `develop` into `main` (or `master`) for production.
- Run migrations and seed as needed on the production database.
- Use `npx next build` and `npx next start` for production server.
- Set environment variables securely on the production server.

---

## Support
For questions or issues, please contact the project maintainer or open an issue on GitHub.



Dont use below iformation :   
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
