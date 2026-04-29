"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
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
    async findGlobal() {
        const logsDir = path.join(os.homedir(), '.logloop', 'logs');
        if (!fs.existsSync(logsDir))
            return [];
        const files = fs.readdirSync(logsDir).filter((f) => f.endsWith('.md'));
        const allLogs = [];
        files.forEach((file) => {
            const project = file.split('.')[0];
            const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
            const entries = content.split('\n## [').slice(1);
            entries.forEach((entry) => {
                const lines = entry.split('\n');
                const timestampStr = lines[0].replace(']', '');
                const id = (lines.find((l) => l.startsWith('id: ')) || '')
                    .replace('id: ', '')
                    .trim() || 'null';
                const commit = (lines.find((l) => l.startsWith('commit: ')) || '')
                    .replace('commit: ', '')
                    .trim() || 'null';
                const branch = (lines.find((l) => l.startsWith('branch: ')) || '')
                    .replace('branch: ', '')
                    .trim() || 'null';
                const type = (lines.find((l) => l.startsWith('type: ')) || '')
                    .replace('type: ', '')
                    .toLowerCase()
                    .trim() || 'unknown';
                const mood = (lines.find((l) => l.startsWith('mood: ')) || '')
                    .replace('mood: ', '')
                    .toLowerCase()
                    .trim() || null;
                const source = (lines.find((l) => l.startsWith('source: ')) || '')
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
                        tags: [],
                    });
                }
            });
        });
        return allLogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
};
exports.LogsService = LogsService;
exports.LogsService = LogsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LogsService);
//# sourceMappingURL=logs.service.js.map