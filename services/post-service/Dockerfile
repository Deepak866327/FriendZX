FROM node:20-alpine

# FFmpeg is needed for video processing
RUN apk add --no-cache ffmpeg python3 make g++ openssl openssl-dev

WORKDIR /app

COPY shared/package*.json ./shared/
WORKDIR /app/shared
RUN npm install

WORKDIR /app
COPY shared/ ./shared/

COPY services/post-service/package*.json ./services/post-service/
COPY services/post-service/prisma/        ./services/post-service/prisma/
WORKDIR /app/services/post-service
RUN npm install
RUN npx prisma generate --schema=prisma/schema.prisma

COPY services/post-service/ .

RUN mkdir -p uploads legacy-uploads/crations legacy-uploads/community legacy-uploads/stories

EXPOSE 3006

CMD sh -c "npx prisma migrate deploy --schema=prisma/schema.prisma && npx ts-node --transpile-only src/main.ts"
