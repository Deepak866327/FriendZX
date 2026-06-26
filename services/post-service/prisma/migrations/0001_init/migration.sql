-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'FRIENDS', 'NEARBY', 'PRIVATE');

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "optimizedUrl" TEXT,
    "thumbnailUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "aspectRatio" DOUBLE PRECISION,
    "duration" DOUBLE PRECISION,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caption" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "likes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_userId_idx" ON "media"("userId");

-- CreateIndex
CREATE INDEX "media_processingStatus_idx" ON "media"("processingStatus");

-- CreateIndex
CREATE INDEX "posts_userId_idx" ON "posts"("userId");

-- CreateIndex
CREATE INDEX "posts_visibility_createdAt_idx" ON "posts"("visibility", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "post_media_postId_idx" ON "post_media"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "post_media_postId_mediaId_key" ON "post_media"("postId", "mediaId");

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
