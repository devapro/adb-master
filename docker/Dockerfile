# Stage 1: Build client
FROM node:20-alpine AS client-builder

WORKDIR /app/client

COPY client/package.json client/package-lock.json* ./
RUN npm install

# Client tsconfig extends base
COPY tsconfig.base.json /app/tsconfig.base.json
COPY client/ ./

RUN npm run build


# Stage 2: Build server
FROM node:20-alpine AS server-builder

WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/
COPY tsconfig.base.json ./
COPY server/tsconfig.json ./server/

RUN cd server && npm install

COPY server/src ./server/src

RUN cd server && npx tsc


# Stage 3: Production image
FROM node:20-alpine

RUN apk add --no-cache android-tools

WORKDIR /app

# Install server production dependencies
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

# Copy built server
COPY --from=server-builder /app/server/dist ./server/dist

# Copy built client into server's expected path (server resolves ../../client/dist)
COPY --from=client-builder /app/client/dist ./client/dist

# Non-root user
RUN addgroup -S adbmaster && adduser -S adbmaster -G adbmaster
# ADB needs writable home for .android directory
RUN mkdir -p /home/adbmaster/.android && chown -R adbmaster:adbmaster /home/adbmaster

USER adbmaster

ENV NODE_ENV=production
ENV PORT=3000
ENV CORS_ORIGIN=*

EXPOSE 3000

CMD ["node", "server/dist/index.js"]
