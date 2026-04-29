import { PrismaService } from '../prisma/prisma.service';
import { IngestLogDto } from './dto/ingest-log.dto';
export interface GlobalLogEntry {
    id: string;
    message: string;
    createdAt: Date;
    project: {
        name: string;
    };
    branch: string | null;
    commitHash: string | null;
    source: string;
    mood: string | null;
    tags: any[];
}
export declare class LogsService {
    private prisma;
    constructor(prisma: PrismaService);
    ingest(dto: IngestLogDto): Promise<{
        tags: {
            id: string;
            name: string;
        }[];
    } & {
        id: string;
        message: string;
        branch: string | null;
        commitHash: string | null;
        createdAt: Date;
        projectId: string;
        sessionId: string | null;
    }>;
    findAll(projectId?: string): Promise<({
        project: {
            id: string;
            createdAt: Date;
            name: string;
            repoPath: string | null;
            userId: string;
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
        id: string;
        message: string;
        branch: string | null;
        commitHash: string | null;
        createdAt: Date;
        projectId: string;
        sessionId: string | null;
    })[]>;
    findGlobal(): Promise<GlobalLogEntry[]>;
}
