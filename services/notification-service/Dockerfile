FROM node:20-alpine

WORKDIR /app

# Install shared dependencies
COPY shared/package*.json ./shared/
WORKDIR /app/shared
RUN npm install

# Copy shared source
WORKDIR /app
COPY shared/ ./shared/

# Install service dependencies first (layer caching)
COPY services/notification-service/package*.json ./services/notification-service/
WORKDIR /app/services/notification-service
RUN npm install

# Copy service source
COPY services/notification-service/ .

EXPOSE 3004

CMD ["npx", "ts-node", "--transpile-only", "src/main.ts"]
