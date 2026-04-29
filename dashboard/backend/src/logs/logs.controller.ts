import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { LogsService, GlobalLogEntry } from './logs.service';
import { IngestLogDto } from './dto/ingest-log.dto';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post('ingest')
  async ingest(@Body() ingestLogDto: IngestLogDto) {
    return this.logsService.ingest(ingestLogDto);
  }

  @Get()
  async findAll(@Query('projectId') projectId?: string) {
    return this.logsService.findAll(projectId);
  }

  @Get('global')
  async findGlobal(): Promise<GlobalLogEntry[]> {
    return this.logsService.findGlobal();
  }
}
