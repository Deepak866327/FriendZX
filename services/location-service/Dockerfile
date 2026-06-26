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
COPY services/location-service/package*.json ./services/location-service/
WORKDIR /app/services/location-service
RUN npm install

# Copy service source
COPY services/location-service/ .

EXPOSE 3003

CMD ["npx", "ts-node", "--transpile-only", "src/main.ts"]
