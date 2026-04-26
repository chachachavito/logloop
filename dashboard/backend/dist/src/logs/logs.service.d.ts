import { PrismaService } from '../prisma/prisma.service';
import { IngestLogDto } from './dto/ingest-log.dto';
export declare class LogsService {
    private prisma;
    constructor(prisma: PrismaService);
    ingest(dto: IngestLogDto): Promise<{
        tags: {
            id: string;
            name: string;
        }[];
    } & {
        message: string;
        branch: string | null;
        id: string;
        createdAt: Date;
        commitHash: string | null;
        projectId: string;
        sessionId: string | null;
    }>;
    findAll(projectId?: string): Promise<({
        project: {
            id: string;
            name: string;
            repoPath: string | null;
            userId: string;
            createdAt: Date;
        };
        session: {
            id: string;
            projectId: string;
            startedAt: Date;
            endedAt: Date | null;
        } | null;
        tags: {
            id: string;
            name: string;
        }[];
    } & {
        message: string;
        branch: string | null;
        id: string;
        createdAt: Date;
        commitHash: string | null;
        projectId: string;
        sessionId: string | null;
    })[]>;
}
