import { LogsService, GlobalLogEntry } from './logs.service';
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
