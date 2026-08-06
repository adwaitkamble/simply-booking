# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root configurations and lockfiles
COPY package.json package-lock.json tsconfig.base.json ./

# Copy monorepo packages and apps
COPY packages/database ./packages/database
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Install dependencies (including devDependencies to compile TypeScript)
RUN npm ci

# Generate Prisma Client and compile the typescript codebase
RUN npm run build

# Remove development dependencies to reduce image size
RUN npm prune --production

# Stage 2: Run the compiled application
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts and node_modules from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/types ./packages/types
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000

ENV PORT=4000

CMD ["npm", "run", "start", "--workspace=@hotel-pms/api"]
