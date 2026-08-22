# Simply Booking 🏨✨
> **Modern Hotel Property Management System (PMS)** built with React Native (Expo), Node.js/Express, PostgreSQL (AWS RDS), and Prisma.

---

## 📌 Project Overview

**Simply Booking** is a high-performance, multi-tenant Property Management System designed for hotels, resorts, villas, and guesthouses. It streamlines front-desk operations, room inventory allocations, team permissions, guest billing, and real-time reservation management across mobile and web platforms.

---

## 🔥 Key Features

- 📅 **Interactive 2D Matrix Grid Dashboard**: Real-time Gantt timeline for visual room management, check-ins, check-outs, and booking extensions.
- 💬 **WhatsApp Booking Confirmation**: Integrated 1-tap WhatsApp deep-linking for sending instant booking summaries to guests.
- 🔒 **Granular Role-Based Access Control (RBAC)**: Multi-tenant team management allowing Admins to assign module and action-level permissions (`create`, `edit`, `view`, `delete`, `list`).
- 🔑 **Secure Change Password System**: Password updates with bcrypt hashing (12 salt rounds), active session validation, and real-time password strength checks.
- 🎧 **Dedicated Support Hub**: Built-in support screen linking directly to WhatsApp (`+91 8793091663`) and Email (`adwaitakamble007@gmail.com`).
- 💼 **Billing & Invoicing**: Comprehensive invoice folio generation, tax calculations, advance payment tracking, and balance due indicators.
- 🛏️ **Room & Category Management**: Dynamic room management, category pricing, turnover logs, and real-time availability updates via Socket.io.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Mobile & Web App** | React Native (Expo), React Native Web, TypeScript |
| **Backend API** | Node.js, Express.js, Socket.io |
| **Database & ORM** | PostgreSQL (AWS RDS), Prisma ORM |
| **Authentication** | JWT (JSON Web Tokens), Bcrypt (12 Salt Rounds) |
| **Monorepo Management**| npm Workspaces |

---

## 📁 Monorepo Structure

```text
pms-app/
├── apps/
│   ├── api/             # Node.js Express Backend & Real-time WebSockets
│   └── mobile/          # React Native (Expo) Mobile & Web Application
├── packages/
│   ├── database/        # Prisma ORM Schema & AWS RDS PostgreSQL Client
│   └── types/           # Shared TypeScript Interfaces, Enums & DTOs
├── package.json         # Workspace Root Configuration
└── README.md            # Project Documentation
```

---

## 🚀 Step-by-Step Setup & Running Guide

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v9 or higher)
- [Git](https://git-scm.com/)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/adwaitkamble/simply-booking.git
cd pms-app
```

---

### Step 2: Install Dependencies

Install all root and workspace package dependencies:

```bash
npm install
```

---

### Step 3: Configure Environment Variables

Create a `.env` file in the root directory (or ensure `.env` contains your PostgreSQL database URL and JWT secret):

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@pms-app.c7oique6kh9w.ap-south-1.rds.amazonaws.com:5432/postgres?schema=public"
JWT_SECRET="simply-booking-super-secret-jwt-key-2026"
PORT=4000
```

---

### Step 4: Database Setup & Migration

Generate the Prisma Client and sync the schema with PostgreSQL:

```bash
# Push schema changes to PostgreSQL
npx prisma db push --workspace=@hotel-pms/database

# Generate Prisma Client
npx prisma generate --workspace=@hotel-pms/database
```

---

### Step 5: Build Core Packages

Build shared types and database modules:

```bash
npm run build --workspace=@hotel-pms/types
npm run build --workspace=@hotel-pms/api
```

---

### Step 6: Run the Backend API Server

Start the Node.js Express server on port `4000`:

```bash
# Development mode with hot reload
npm run dev --workspace=@hotel-pms/api

# OR production start mode
npm run start --workspace=@hotel-pms/api
```

*The API server will run at `http://localhost:4000` with WebSockets enabled.*

---

### Step 7: Run the Mobile / Web App

In a new terminal window, launch the Expo mobile app:

```bash
# Start Expo development server (Web, Android, iOS)
npm run dev --workspace=@hotel-pms/mobile

# OR launch directly in web browser
npx expo start --web --workspace=@hotel-pms/mobile
```

---

## 📞 Support & Contact

For support, feedback, or custom feature requests, reach out to us:

- 💬 **WhatsApp Support**: [+91 8793091663](https://wa.me/918793091663)
- ✉️ **Email**: [adwaitakamble007@gmail.com](mailto:adwaitakamble007@gmail.com)

---

## 📜 License

This project is proprietary software for **Simply Booking**. All rights reserved.
