import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestLogDto } from './dto/ingest-log.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface GlobalLogEntry {
  id: string;
  message: string;
  createdAt: Date;
  project: { name: string };
  branch: string | null;
  commitHash: string | null;
  source: string;
  mood: string | null;
  tags: any[];
}

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

  async findGlobal() {
    const logsDir = path.join(os.homedir(), '.logloop', 'logs');

    if (!fs.existsSync(logsDir)) return [];

    const files = fs.readdirSync(logsDir).filter((f) => f.endsWith('.md'));
    const allLogs: GlobalLogEntry[] = [];

    files.forEach((file) => {
      const project = file.split('.')[0];
      const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
      const entries = content.split('\n## [').slice(1);

      entries.forEach((entry) => {
        const lines = entry.split('\n');
        const timestampStr = lines[0].replace(']', '');
        const id =
          (lines.find((l) => l.startsWith('id: ')) || '')
            .replace('id: ', '')
            .trim() || 'null';
        const commit =
          (lines.find((l) => l.startsWith('commit: ')) || '')
            .replace('commit: ', '')
            .trim() || 'null';
        const branch =
          (lines.find((l) => l.startsWith('branch: ')) || '')
            .replace('branch: ', '')
            .trim() || 'null';
        const type =
          (lines.find((l) => l.startsWith('type: ')) || '')
            .replace('type: ', '')
            .toLowerCase()
            .trim() || 'unknown';
        const mood =
          (lines.find((l) => l.startsWith('mood: ')) || '')
            .replace('mood: ', '')
            .toLowerCase()
            .trim() || null;
        const source =
          (lines.find((l) => l.startsWith('source: ')) || '')
            .replace('source: ', '')
            .trim() || 'unknown';
        const note = lines
          .slice(lines.findIndex((l, i) => i > 0 && l.trim() === '') + 1)
          .join('\n')
          .trim();

        if (note) {
          allLogs.push({
            id,
            message: note,
            createdAt: new Date(timestampStr.split('.')[0] + 'Z'),
            project: { name: project },
            branch: branch !== 'null' ? branch : null,
            commitHash: commit !== 'null' ? commit : null,
            source,
            mood: mood !== 'null' ? mood : null,
            tags: [], // Parsing tags from markdown could be added later
          });
        }
      });
    });

    return allLogs.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}
