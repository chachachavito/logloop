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

function getLogFile(config) {
  const user = config.userName || 'shared';
  const userSlug = user.toLowerCase().replace(/\s+/g, '-');
  
  let logPath;
  if (config.storage === 'local') {
    const os = require('os');
    const logsDir = path.join(os.homedir(), '.logloop', 'logs');
    logPath = path.join(logsDir, `${path.basename(process.cwd())}.${userSlug}.md`);
  } else {
    logPath = path.join(process.cwd(), user === 'shared' ? 'logloop.md' : `logloop.${userSlug}.md`);
  }

  return resolvePath(logPath);
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
  const logFile = getLogFile(config);
  
  return withLock(logFile, () => {
    const { getGitMetadata, isGitRepo, commitLog } = require('./git');
    const { classifyMessage } = require('./classifier');
    
    const { hash, branch } = getGitMetadata() || { hash: 'null', branch: 'null' };
    const { category } = classifyMessage(note);
    const id = generateId();
    const mood = options.mood || 'null';
    const timestamp = getMonotonicTimestamp();

    const entry = `\n## [${timestamp}]\nid: ${id}\ncommit: ${hash || 'null'}\nbranch: ${branch || 'null'}\ntype: ${category}\nmood: ${mood}\n\n${note}\n`;

    const result = safeWrite(logFile, entry, 'append', config);

    if (result.success && options.shouldCommit && isGitRepo() && config.storage !== 'local') {
      commitLog(logFile, note);
    }
    return result.success;
  });
}

function updateLastLog(updates, config) {
  const logFile = getLogFile(config);
  if (!fs.existsSync(logFile)) return false;

  return withLock(logFile, () => {
    let content = fs.readFileSync(logFile, 'utf8');
    const sections = content.split('\n## [');
    if (sections.length < 2) return false;

    let lastSection = sections[sections.length - 1];
    const lines = lastSection.split('\n');

    if (updates.type) {
      const idx = lines.findIndex(l => l.startsWith('type: '));
      if (idx > -1) lines[idx] = `type: ${updates.type}`;
    }

    if (updates.mood) {
      const idx = lines.findIndex(l => l.startsWith('mood: '));
      const moodStr = `mood: ${updates.mood}`;
      if (idx > -1) lines[idx] = moodStr;
      else {
        const emptyIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '');
        lines.splice(emptyIdx, 0, moodStr);
      }
    }

    sections[sections.length - 1] = lines.join('\n');
    const result = safeWrite(logFile, sections.join('\n## ['), 'write', config);
    return result.success;
  });
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

function getAnalytics(config) {
  const logs = getRecentLogs(config, 50);
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
      
      categories[log.type] = (categories[log.type] || 0) + 1;
      if (log.mood && log.mood !== 'null') {
        moods[log.mood] = (moods[log.mood] || 0) + 1;
      }

      if (log.type === 'question') questions.push(log.note);
      if (log.type === 'decision') decisions.push(log.note);
    } catch (e) {}
  });

  return { timeline, categories, moods, questions, decisions };
}

module.exports = { saveLog, updateLastLog, getRecentLogs, getLogFile, withLock, resetLocks, setDebug, getAnalytics };
