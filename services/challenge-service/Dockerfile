FROM node:20-alpine

WORKDIR /app

COPY shared/package*.json ./shared/
WORKDIR /app/shared
RUN npm install

WORKDIR /app
COPY shared/ ./shared/

COPY services/challenge-service/package*.json ./services/challenge-service/
WORKDIR /app/services/challenge-service
RUN npm install

COPY services/challenge-service/ .

EXPOSE 3008

CMD ["npx", "ts-node", "--transpile-only", "src/main.ts"]
