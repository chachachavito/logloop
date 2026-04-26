"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let LogsService = class LogsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async ingest(dto) {
        let project = await this.prisma.project.findFirst({
            where: { name: dto.project },
        });
        if (!project) {
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
    async findAll(projectId) {
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
};
exports.LogsService = LogsService;
exports.LogsService = LogsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LogsService);
//# sourceMappingURL=logs.service.js.map