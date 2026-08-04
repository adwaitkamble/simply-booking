# Tech Stack & Architecture
- Architecture: Monorepo using Yarn Workspaces (or npm workspaces).
- Apps: `apps/api` (Node.js/Express backend) and `apps/mobile` (React Native/Expo frontend).
- Shared Packages: `packages/database` (Prisma schema and client) and `packages/types` (shared TypeScript definitions).
- Database: PostgreSQL (Strict ACID compliance is non-negotiable for financial and booking integrity).
- ORM: Prisma (Used for schema modeling and type-safe migrations).
- Hierarchy: Multi-tenant structure (Chain -> Property -> RoomCategory -> Room).

# Code Style
- Use ES modules and TypeScript across all workspaces.
- Database tables must be PascalCase and pluralized in models (e.g., `Properties`, `Reservations`).
- Keep code modular: separate database logic into the shared package, away from API routing.

# Workflow Rules
- Never use mock data for testing database relations; always write a dedicated seed script to verify foreign key constraints against a live local database.
- Always run scripts from the root directory using workspace commands.
- Stop and ask for permission before executing destructive database drops or migrations.