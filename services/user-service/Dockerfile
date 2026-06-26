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
COPY services/user-service/package*.json ./services/user-service/
WORKDIR /app/services/user-service
RUN npm install

# Copy service source
COPY services/user-service/ .

EXPOSE 3002

CMD ["npx", "ts-node", "--transpile-only", "src/main.ts"]
