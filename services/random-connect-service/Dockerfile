FROM node:20-alpine

WORKDIR /app

# Install shared dependencies
COPY shared/package*.json ./shared/
WORKDIR /app/shared
RUN npm install

# Copy shared source
WORKDIR /app
COPY shared/ ./shared/

# Install service dependencies
COPY services/random-connect-service/package*.json ./services/random-connect-service/
WORKDIR /app/services/random-connect-service
RUN npm install

# Copy service source
COPY services/random-connect-service/ .

EXPOSE 3007

CMD ["npx", "ts-node", "--transpile-only", "src/main.ts"]
