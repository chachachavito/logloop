import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestLogDto } from './dto/ingest-log.dto';

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  async ingest(dto: IngestLogDto) {
    // 1. Ensure project exists (simplification for MVP: find by name)
    let project = await this.prisma.project.findFirst({
      where: { name: dto.project },
    });

    if (!project) {
      // For MVP, create a default user if none exists
      let user = await this.prisma.user.findFirst();
      if (!user) {
        user = await this.prisma.user.create({
          data: { email: 'default@logloop.dev' },
        });
      }

      project = await this.prisma.project.create({
        data: {
          name: dto.project,
          userId: user.id,
        },
      });
    }

    // 2. Create log
    return this.prisma.log.create({
      data: {
        message: dto.message,
        branch: dto.branch,
        commitHash: dto.commit_hash,
        projectId: project.id,
        sessionId: dto.session_id,
        tags: {
          connectOrCreate: (dto.tags || []).map((tag) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        },
      },
      include: {
        tags: true,
      },
    });
  }

  async findAll(projectId?: string) {
    return this.prisma.log.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        project: true,
        session: true,
        tags: true,
      },
    });
  }
}
