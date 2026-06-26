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
COPY services/auth-service/package*.json ./services/auth-service/
WORKDIR /app/services/auth-service
RUN npm install

# Copy service source
COPY services/auth-service/ .

EXPOSE 3001

CMD ["npx", "ts-node", "--transpile-only", "src/main.ts"]
