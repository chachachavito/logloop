import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class IngestLogDto {
  @IsString()
  message: string;

  @IsString()
  project: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  commit_hash?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsUUID()
  session_id?: string;
}
