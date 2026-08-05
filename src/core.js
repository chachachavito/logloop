import fs from 'fs';
import path from 'path';
import { LOGS_DIR } from './paths.js';
import { getGitMetadata, isGitRepo, commitLog } from './git.js';
import { classifyMessage } from './classifier.js';
import { add as dbAdd, list as dbList } from './db.js';

// Cache e estado interno
const _activeLocks = new Set();
const _pathCache = new Map();
let _lastTimestamp = 0;
let _monotonicCounter = 0;
let _debugEnabled = false;
let _lastSyncTime = 0;

export function setDebug(enabled) { _debugEnabled = enabled; }

function logDebug(...args) {
  if (_debugEnabled) {
    console.log(`\x1b[90m[DEBUG]\x1b[0m`, ...args);
  }
}

export function resetLocks() {
  _activeLocks.clear();
  _pathCache.clear();
  _lastTimestamp = 0;
  _monotonicCounter = 0;
}

/**
 * Gera um timestamp único e crescente.
 *
 * toISOString() já devolve a fração de segundos (.819) e o Z, então o contador
 * monotônico é anexado *dentro* da fração — 2026-08-05T12:10:41.819000Z — e não
 * como uma segunda fração. O resultado tem 6 dígitos de fração, é ISO 8601
 * válido, new Date() parseia, e a ordem lexicográfica continua cronológica.
 */
function getMonotonicTimestamp() {
  const now = Date.now();
  if (now <= _lastTimestamp) {
    _monotonicCounter++;
  } else {
    _lastTimestamp = now;
    _monotonicCounter = 0;
  }
  return new Date(_lastTimestamp).toISOString()
    .replace('Z', `${_monotonicCounter.toString().padStart(3, '0')}Z`);
}

// Entradas gravadas antes da correção acima carregam duas frações de segundo:
// 2026-08-05T12:10:41.819.000Z — o segundo grupo é o contador monotônico.
const LEGACY_TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\.(\d+)Z$/;

/**
 * Lê um timestamp de log em qualquer um dos dois formatos.
 *
 * Os timestamps quebrados foram gravados nos .md e no lowdb, e os .md vivem
 * dentro dos repositórios dos usuários — reescrevê-los produziria um diff em
 * todo projeto que usa logloop. Por isso a compatibilidade fica na leitura:
 * todo histórico, antigo ou novo, passa por aqui.
 *
 * @returns {Date|null} null quando o valor está ausente ou é impossível de ler.
 */
export function parseLogTimestamp(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || !value) return null;

  const legacy = value.match(LEGACY_TIMESTAMP_RE);
  const date = new Date(legacy ? `${legacy[1]}Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLogTime(value) {
  const date = parseLogTimestamp(value);
  return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
}

function resolvePath(targetPath) {
  if (_pathCache.has(targetPath)) return _pathCache.get(targetPath);
  let resolved;
  try {
    if (fs.existsSync(targetPath)) {
      resolved = fs.realpathSync(targetPath);
    } else {
      const dirPath = path.dirname(targetPath);
      const dir = fs.existsSync(dirPath) ? fs.realpathSync(dirPath) : path.resolve(dirPath);
      resolved = path.join(dir, path.basename(targetPath));
    }
  } catch (e) {
    resolved = path.resolve(targetPath);
  }
  _pathCache.set(targetPath, resolved);
  return resolved;
}

function generateId() {
  const timestamp = Date.now().toString(16).slice(-4);
  const random = Math.random().toString(16).substring(2, 6);
  return `${timestamp}${random}`;
}

export function detectSource() {
  if (process.env.TERMUX_VERSION || process.env.ANDROID_ROOT) return 'mobile';
  return 'desktop';
}

export function getLogFiles(config) {
  const user = config.userName || 'shared';
  const userSlug = user.toLowerCase().replace(/\s+/g, '-');
  const projectSlug = path.basename(process.cwd());
  
  const repoPath = resolvePath(path.join(process.cwd(), user === 'shared' ? 'logloop.md' : `logloop.${userSlug}.md`));
  const localPath = resolvePath(path.join(LOGS_DIR, `${projectSlug}.${userSlug}.md`));

  const strategy = config.storage || 'repo';
  if (strategy === 'mirror') return [repoPath, localPath];
  if (strategy === 'local') return [localPath];
  return [repoPath];
}

export function getLogFile(config) {
  return getLogFiles(config)[0];
}

export function withLock(logFile, action) {
  const resolvedLogFile = resolvePath(logFile);
  const lockFile = resolvedLogFile + '.lock';
  
  if (_activeLocks.has(lockFile)) return action();

  const startTime = Date.now();
  const timeout = 1000;
  let delay = 50;
  let ownsLock = false;

  while (true) {
    try {
      fs.openSync(lockFile, 'wx');
      _activeLocks.add(lockFile);
      ownsLock = true;
      break;
    } catch (e) {
      if (Date.now() - startTime > timeout) throw new Error('LOCK_TIMEOUT');
      const wait = Date.now();
      while (Date.now() - wait < delay) {}
      delay = Math.min(delay + 50, 150);
    }
  }

  try {
    return action();
  } finally {
    if (ownsLock) {
      try { if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile); } catch (e) {}
      _activeLocks.delete(lockFile);
    }
  }
}

/**
 * Rotaciona o arquivo se exceder o limite.
 */
function rotateIfNeeded(logFile, maxSize = 10 * 1024 * 1024) {
  if (!fs.existsSync(logFile)) return;
  const stats = fs.statSync(logFile);
  if (stats.size > maxSize) {
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const rotatedPath = logFile.replace('.md', `-${dateStr}.md`);
    fs.renameSync(logFile, rotatedPath);
    logDebug(`Log rotated: ${rotatedPath}`);
  }
}

/**
 * Escrita Blindada v4: Rotação, FD Seguro, Integridade Forte e Batch Fsync.
 */
function safeWrite(logFile, content, mode = 'append', config = {}) {
  const tmpFile = `${logFile}.tmp`;
  let retryCount = 0;
  
  const execute = () => {
    let fd = null;
    let sizeBefore = 0;
    try {
      if (fs.existsSync(logFile)) {
        sizeBefore = fs.statSync(logFile).size;
        if (mode === 'append') rotateIfNeeded(logFile);
      }

      // Garantir nova linha no final
      const finalContent = content.endsWith('\n') ? content : content + '\n';
      const contentLength = Buffer.byteLength(finalContent, 'utf8');

      if (mode === 'append') {
        if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '# DevLog\n', 'utf8');
        fd = fs.openSync(logFile, 'a');
        fs.writeSync(fd, finalContent);
      } else {
        fs.writeFileSync(tmpFile, finalContent, 'utf8');
        fd = fs.openSync(tmpFile, 'r+');
        fs.renameSync(tmpFile, logFile);
      }

      // Batch Fsync: Sincronizar apenas se durável e intervalo > 100ms
      if (config.durable) {
        const now = Date.now();
        if (now - _lastSyncTime > 100) {
          fs.fsyncSync(fd);
          _lastSyncTime = now;
          logDebug('Fsync executed (batch)');
        }
      }

      fs.closeSync(fd);
      fd = null;

      // Verificação de Integridade Forte
      const statsAfter = fs.statSync(logFile);
      const verifyContent = fs.readFileSync(logFile, 'utf8');
      
      const sizeIntegrity = mode === 'append' ? (statsAfter.size >= sizeBefore + contentLength) : (statsAfter.size >= contentLength);
      const contentIntegrity = verifyContent.endsWith(finalContent);

      if (!sizeIntegrity || !contentIntegrity) {
        throw new Error('INTEGRITY_FAILURE');
      }

      return { success: true };
    } catch (err) {
      if (fd !== null) try { fs.closeSync(fd); } catch (e) {}
      
      if (err.message === 'INTEGRITY_FAILURE' && retryCount < 1) {
        retryCount++;
        logDebug('Integrity failure, retrying...');
        return execute();
      }
      
      return { success: false, error: err.message };
    } finally {
      if (fs.existsSync(tmpFile)) try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  };

  return execute();
}

/**
 * Função interna para obter logs legados via FS.
 */
function _getLegacyGlobalLogs() {
  const logsDir = LOGS_DIR;
  if (!fs.existsSync(logsDir)) return [];

  const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.md'));
  let allLogs = [];

  files.forEach(file => {
    const project = file.split('.')[0];
    const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
    const entries = content.split('\n## [').slice(1);
    
    entries.forEach(entry => {
      const lines = entry.split('\n');
      const timestamp = lines[0].replace(']', '');
      const id = (lines.find(l => l.startsWith('id: ')) || '').replace('id: ', '') || 'null';
      const commit = (lines.find(l => l.startsWith('commit: ')) || '').replace('commit: ', '') || 'null';
      const branch = (lines.find(l => l.startsWith('branch: ')) || '').replace('branch: ', '') || 'null';
      const type = (lines.find(l => l.startsWith('type: ')) || '').replace('type: ', '').toLowerCase().trim() || 'unknown';
      const mood = (lines.find(l => l.startsWith('mood: ')) || '').replace('mood: ', '').toLowerCase().trim() || null;
      const source = (lines.find(l => l.startsWith('source: ')) || '').replace('source: ', '').trim() || 'unknown';
      const note = lines.slice(lines.findIndex((l, i) => i > 0 && l.trim() === '') + 1).join('\n').trim();

      if (note) {
        allLogs.push({
          timestamp,
          rawTime: timestamp,
          id, commit, branch, type, mood, source, project,
          note,
          message: note,
          time: formatLogTime(timestamp)
        });
      }
    });
  });

  return allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function saveLog(note, config, options = {}) {
  const logFiles = getLogFiles(config);
  
  const { hash, branch } = getGitMetadata() || { hash: 'null', branch: 'null' };
  const { category } = await classifyMessage(note);
  const id = generateId();
  const mood = options.mood && options.mood !== 'null' ? options.mood.toLowerCase() : 'null';
  const type = (options.type || category).toLowerCase();
  const timestamp = getMonotonicTimestamp();
  const source = detectSource();

  const entry = `\n## [${timestamp}]\nid: ${id}\ncommit: ${hash || 'null'}\nbranch: ${branch || 'null'}\ntype: ${type}\nmood: ${mood}\nsource: ${source}\n\n${note}\n`;

  // Auto-migração se o banco estiver vazio
  const logsInDb = await dbList('logs');
  if (logsInDb.length === 0) {
    const legacyLogs = _getLegacyGlobalLogs();
    for (const log of legacyLogs) {
      await dbAdd('logs', log).catch(() => {});
    }
  }

  // Escrita no lowdb. Precisa ser aguardada: quem chama saveLog costuma ler o
  // banco logo em seguida (getRecentLogs) e pode encerrar o processo logo
  // depois (/q -> process.exit), o que descartaria uma escrita ainda pendente.
  const dbWrite = dbAdd('logs', { note, id, commit: hash, branch, type, mood, source, timestamp, project: path.basename(process.cwd()) })
    .catch(e => logDebug('lowdb write failed:', e.message));

  let overallSuccess = true;
  for (const logFile of logFiles) {
    const result = withLock(logFile, () => {
      const res = safeWrite(logFile, entry, 'append', config);
      // Never git-commit the private local mirror — only the in-repo log.
      // Comparing against LOGS_DIR rather than matching the literal
      // '.logloop/logs/' keeps this correct when the store has been relocated.
      if (res.success && options.shouldCommit && isGitRepo() && !logFile.startsWith(LOGS_DIR)) {
        try { commitLog(logFile, note); } catch (e) {}
      }
      return res.success;
    });
    if (!result) overallSuccess = false;
  }

  // Os .md acima foram escritos em paralelo com o lowdb; só agora esperamos.
  await dbWrite;

  return overallSuccess;
}

export function updateLastLog(updates, config) {
  const logFiles = getLogFiles(config);
  let overallSuccess = true;

  for (const logFile of logFiles) {
    if (!fs.existsSync(logFile)) continue;
    const result = withLock(logFile, () => {
      let content = fs.readFileSync(logFile, 'utf8');
      const sections = content.split('\n## [');
      if (sections.length < 2) return false;

      let lastSection = sections[sections.length - 1];
      const lines = lastSection.split('\n');

      if (updates.type) {
        const idx = lines.findIndex(l => l.startsWith('type: '));
        if (idx > -1) lines[idx] = `type: ${updates.type.toLowerCase()}`;
      }

      if (updates.mood) {
        const idx = lines.findIndex(l => l.startsWith('mood: '));
        const moodStr = `mood: ${updates.mood.toLowerCase()}`;
        if (idx > -1) lines[idx] = moodStr;
        else {
          const emptyIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '');
          lines.splice(emptyIdx, 0, moodStr);
        }
      }

      sections[sections.length - 1] = lines.join('\n');
      const res = safeWrite(logFile, sections.join('\n## ['), 'write', config);
      return res.success;
    });
    if (!result) overallSuccess = false;
  }
  return overallSuccess;
}

export async function getRecentLogs(config, limit = 5) {
  const projectSlug = path.basename(process.cwd());
  const allLogs = await dbList('logs', l => l.project === projectSlug);
  
  const logs = allLogs.length > 0 ? allLogs : [];

  return logs.slice(-limit).map(log => ({
    ...log,
    time: formatLogTime(log.timestamp),
    rawTime: log.timestamp,
    note: log.note.length > 60 ? log.note.substring(0, 57) + '...' : log.note
  }));
}

export async function getGlobalLogs() {
  const logs = await dbList('logs');
  
  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(log => ({
    ...log,
    time: formatLogTime(log.timestamp),
    rawTime: log.timestamp
  }));
}

export async function getAnalytics(config, customLogs = null) {
  const logs = customLogs || await getRecentLogs(config, 50);
  if (logs.length === 0) return null;

  const timeline = new Array(24).fill(0);
  const categories = {};
  const moods = {};
  const questions = [];
  const decisions = [];

  logs.forEach(log => {
    try {
      const loggedAt = parseLogTimestamp(log.rawTime ?? log.timestamp);
      if (loggedAt) timeline[loggedAt.getHours()]++;

      const type = log.type || 'unknown';
      categories[type] = (categories[type] || 0) + 1;
      if (log.mood && log.mood !== 'null') {
        moods[log.mood] = (moods[log.mood] || 0) + 1;
      }

      if (type === 'question') questions.push(log.note);
      if (type === 'decision') decisions.push(log.note);
    } catch (e) {}
  });

  return { timeline, categories, moods, questions, decisions };
}
