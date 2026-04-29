const fs = require('fs');
const path = require('path');

// Cache e estado interno
const _activeLocks = new Set();
const _pathCache = new Map();
let _lastTimestamp = 0;
let _monotonicCounter = 0;
let _debugEnabled = false;
let _lastSyncTime = 0;

function setDebug(enabled) { _debugEnabled = enabled; }

function logDebug(...args) {
  if (_debugEnabled) {
    console.log(`\x1b[90m[DEBUG]\x1b[0m`, ...args);
  }
}

function resetLocks() {
  _activeLocks.clear();
  _pathCache.clear();
  _lastTimestamp = 0;
  _monotonicCounter = 0;
}

/**
 * Gera um timestamp único e crescente.
 */
function getMonotonicTimestamp() {
  const now = Date.now();
  if (now <= _lastTimestamp) {
    _monotonicCounter++;
  } else {
    _lastTimestamp = now;
    _monotonicCounter = 0;
  }
  return `${new Date(_lastTimestamp).toISOString().replace('Z', '')}.${_monotonicCounter.toString().padStart(3, '0')}Z`;
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

function detectSource() {
  if (process.env.TERMUX_VERSION || process.env.ANDROID_ROOT) return 'mobile';
  return 'desktop';
}

function getLogFiles(config) {
  const os = require('os');
  const user = config.userName || 'shared';
  const userSlug = user.toLowerCase().replace(/\s+/g, '-');
  const projectSlug = path.basename(process.cwd());
  
  const repoPath = resolvePath(path.join(process.cwd(), user === 'shared' ? 'logloop.md' : `logloop.${userSlug}.md`));
  const logsDir = path.join(os.homedir(), '.logloop', 'logs');
  const localPath = resolvePath(path.join(logsDir, `${projectSlug}.${userSlug}.md`));

  const strategy = config.storage || 'repo';
  if (strategy === 'mirror') return [repoPath, localPath];
  if (strategy === 'local') return [localPath];
  return [repoPath];
}

function getLogFile(config) {
  return getLogFiles(config)[0];
}

function withLock(logFile, action) {
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

function saveLog(note, config, options = {}) {
  const logFiles = getLogFiles(config);
  const { getGitMetadata, isGitRepo, commitLog } = require('./git');
  const { classifyMessage } = require('./classifier');
  
  const { hash, branch } = getGitMetadata() || { hash: 'null', branch: 'null' };
  const { category } = classifyMessage(note);
  const id = generateId();
  const mood = options.mood && options.mood !== 'null' ? options.mood.toLowerCase() : 'null';
  const type = (options.type || category).toLowerCase();
  const timestamp = getMonotonicTimestamp();
  const source = detectSource();

  const entry = `\n## [${timestamp}]\nid: ${id}\ncommit: ${hash || 'null'}\nbranch: ${branch || 'null'}\ntype: ${type}\nmood: ${mood}\nsource: ${source}\n\n${note}\n`;

  let overallSuccess = true;
  for (const logFile of logFiles) {
    const result = withLock(logFile, () => {
      const res = safeWrite(logFile, entry, 'append', config);
      if (res.success && options.shouldCommit && isGitRepo() && !logFile.includes('.logloop/logs/')) {
        try { commitLog(logFile, note); } catch (e) {}
      }
      return res.success;
    });
    if (!result) overallSuccess = false;
  }
  
  return overallSuccess;
}

function updateLastLog(updates, config) {
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

function getRecentLogs(config, limit = 5) {
  const logFile = getLogFile(config);
  if (!fs.existsSync(logFile)) return [];
  try {
    const content = fs.readFileSync(logFile, 'utf8');
    const entries = content.split('\n## [').slice(1);
    return entries.slice(-limit).map(entry => {
      const lines = entry.split('\n');
      const timestamp = lines[0].replace(']', '');
      const type = (lines.find(l => l.startsWith('type: ')) || '').replace('type: ', '') || 'unknown';
      const mood = (lines.find(l => l.startsWith('mood: ')) || '').replace('mood: ', '') || null;
      const note = lines.slice(lines.findIndex((l, i) => i > 0 && l.trim() === '') + 1).join('\n').trim();
      const id = (lines.find(l => l.startsWith('id: ')) || '').replace('id: ', '') || 'null';
      
      const displayTime = new Date(timestamp.split('.')[0] + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        time: displayTime,
        rawTime: timestamp,
        id, type, mood,
        note: note.length > 60 ? note.substring(0, 57) + '...' : note
      };
    });
  } catch (e) { return []; }
}

function getGlobalLogs() {
  const os = require('os');
  const logsDir = path.join(os.homedir(), '.logloop', 'logs');
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
          time: new Date(timestamp.split('.')[0] + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
    });
  });

  return allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function getAnalytics(config, customLogs = null) {
  const logs = customLogs || getRecentLogs(config, 50);
  if (logs.length === 0) return null;

  const timeline = new Array(24).fill(0);
  const categories = {};
  const moods = {};
  const questions = [];
  const decisions = [];

  logs.forEach(log => {
    try {
      const hour = new Date(log.rawTime.split('.')[0] + 'Z').getHours();
      timeline[hour]++;
      
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

module.exports = { saveLog, updateLastLog, getRecentLogs, getLogFile, withLock, resetLocks, setDebug, getAnalytics, getGlobalLogs, detectSource };
