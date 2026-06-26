import { PrismaClient, Media, ProcessingStatus } from '@prisma/client';

export interface CreateMediaInput {
  id:          string;
  userId:      string;
  mediaType:   'IMAGE' | 'VIDEO';
  originalUrl: string;
  mimeType:    string;
  fileSize:    number;
}

export interface UpdateMediaInput {
  optimizedUrl?:     string;
  thumbnailUrl?:     string;
  width?:            number;
  height?:           number;
  aspectRatio?:      number;
  duration?:         number;
  processingStatus?: ProcessingStatus;
}

export class PrismaMediaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: CreateMediaInput): Promise<Media> {
    return this.prisma.media.create({ data });
  }

  findById(id: string): Promise<Media | null> {
    return this.prisma.media.findUnique({ where: { id } });
  }

  update(id: string, data: UpdateMediaInput): Promise<Media> {
    return this.prisma.media.update({ where: { id }, data });
  }

  delete(id: string): Promise<Media> {
    return this.prisma.media.delete({ where: { id } });
  }

  findByUser(userId: string): Promise<Media[]> {
    return this.prisma.media.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
