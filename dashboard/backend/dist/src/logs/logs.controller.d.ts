import { LogsService } from './logs.service';
import { IngestLogDto } from './dto/ingest-log.dto';
export declare class LogsController {
    private readonly logsService;
    constructor(logsService: LogsService);
    ingest(ingestLogDto: IngestLogDto): Promise<{
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
