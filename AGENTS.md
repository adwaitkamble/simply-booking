# Project: Simply Booking
An industry-level Property Management System (PMS) mobile application for hotel administrators to manage inventory, staff permissions, and real-time operations.

## Structure
- `frontend/` : React Native (Expo) mobile application.
- `backend/` : Node.js / Express API and PostgreSQL integration.
- `tests/` : Jest test suites for both frontend components and backend endpoints.

## Commands
Install: `npm install` (run in both `/frontend` and `/backend`)
Lint: `npm run lint`
Run Frontend: `npx expo start`
Run Backend: `npm run start:dev`
Test: `npm test`
Verify: `npm run lint && npm test`

## Conventions
1. All database dates/timestamps must be stored in UTC and converted to local time only on the frontend.
2. All financial/currency values must be calculated and stored as integers (cents) to avoid floating-point errors.
3. Access control is permission-based (JSONB nested object in Postgres), not just simple role strings.

## Before you open a PR
Run the Verify command. All checks must pass.

## Do not
- Edit generated files.
- Add a dependency without asking.
- Change or delete a test to make it pass.
