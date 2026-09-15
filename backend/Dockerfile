FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY backend/prisma ./backend/prisma
RUN npm ci -w backend --include-workspace-root
COPY backend/tsconfig.json ./backend/tsconfig.json
COPY backend/src ./backend/src
WORKDIR /app/backend
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY backend/prisma ./backend/prisma
RUN npm ci -w backend --include-workspace-root
COPY --from=build /app/backend/dist ./backend/dist
WORKDIR /app/backend
EXPOSE 4000
CMD ["npm", "run", "start"]
