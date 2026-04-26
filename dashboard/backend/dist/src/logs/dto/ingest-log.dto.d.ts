export declare class IngestLogDto {
    message: string;
    project: string;
    branch?: string;
    commit_hash?: string;
    tags?: string[];
    session_id?: string;
}
