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
COPY api-gateway/package*.json ./api-gateway/
WORKDIR /app/api-gateway
RUN npm install

# Copy service source
COPY api-gateway/ .

EXPOSE 3000

CMD ["npx", "ts-node", "--transpile-only", "src/main.ts"]
