const fs = require('fs');
const path = require('path');

// Cache de locks adquiridos pelo processo atual (prevenir reentrância)
const _activeLocks = new Set();

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

  // Usar realpathSync para evitar problemas com symlinks (/var vs /private/var no Mac)
  try {
    if (fs.existsSync(logPath)) return fs.realpathSync(logPath);
    // Se o arquivo não existir, resolvemos o diretório pai e juntamos o nome
    const dir = fs.realpathSync(path.dirname(logPath));
    return path.join(dir, path.basename(logPath));
  } catch (e) {
    return path.resolve(logPath);
  }
}

/**
 * Sistema de trava resiliente com proteção contra reentrância e timeout absoluto.
 */
function withLock(logFile, action) {
  // Garantir que o logFile seja resolvido para seu caminho real antes de adicionar o .lock
  const resolvedLogFile = (() => {
    try {
      if (fs.existsSync(logFile)) return fs.realpathSync(logFile);
      const dir = fs.realpathSync(path.dirname(logFile));
      return path.join(dir, path.basename(logFile));
    } catch (e) {
      return path.resolve(logFile);
    }
  })();
  
  const lockFile = resolvedLogFile + '.lock';
  
  if (_activeLocks.has(lockFile)) {
    return action();
  }

  const startTime = Date.now();
  const timeout = 1000; // Timeout absoluto de 1s
  let delay = 50;

  let ownsLock = false;
  while (true) {
    try {
      fs.openSync(lockFile, 'wx');
      _activeLocks.add(lockFile);
      ownsLock = true;
      break;
    } catch (e) {
      if (Date.now() - startTime > timeout) {
        throw new Error('LOCK_TIMEOUT');
      }
      const wait = Date.now();
      while (Date.now() - wait < delay) {}
      delay = Math.min(delay + 50, 200);
    }
  }

  try {
    return action();
  } finally {
    if (ownsLock) {
      try {
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      } catch (e) {}
      _activeLocks.delete(lockFile);
    }
  }
}

/**
 * Centralização da lógica de escrita segura.
 */
function safeWrite(logFile, content, mode = 'append') {
  const tmpFile = `${logFile}.tmp`;
  try {
    if (mode === 'append') {
      if (!fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, '# DevLog\n', 'utf8');
      }
      fs.appendFileSync(logFile, content, 'utf8');
    } else {
      // Escrita atômica via swap para updates
      fs.writeFileSync(tmpFile, content, 'utf8');
      fs.renameSync(tmpFile, logFile);
    }
    return true;
  } finally {
    // Garantir remoção de .tmp após falha
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
}

function saveLog(note, config, options = {}) {
  const logFile = getLogFile(config);
  
  return withLock(logFile, () => {
    // Lazy load de git para custo de startup zero se não for usado
    const { getGitMetadata, isGitRepo, commitLog } = require('./git');
    const { classifyMessage } = require('./classifier');
    
    const { hash, branch } = getGitMetadata() || { hash: 'null', branch: 'null' };
    const { category } = classifyMessage(note);
    const id = generateId();
    const mood = options.mood || 'null';

    const entry = `\n## [${new Date().toISOString()}]\nid: ${id}\ncommit: ${hash || 'null'}\nbranch: ${branch || 'null'}\ntype: ${category}\nmood: ${mood}\n\n${note}\n`;

    const success = safeWrite(logFile, entry, 'append');

    if (success && options.shouldCommit && isGitRepo() && config.storage !== 'local') {
      commitLog(logFile, note);
    }
    return success;
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
      if (idx > -1) lines[idx] = `mood: ${updates.mood}`;
      else {
        const emptyIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '');
        lines.splice(emptyIdx, 0, `mood: ${updates.mood}`);
      }
    }

    sections[sections.length - 1] = lines.join('\n');
    return safeWrite(logFile, sections.join('\n## ['), 'write');
  });
}

function getRecentLogs(config, limit = 5) {
  const logFile = getLogFile(config);
  if (!fs.existsSync(logFile)) return [];
  const content = fs.readFileSync(logFile, 'utf8');
  const entries = content.split('\n## [').slice(1);
  return entries.slice(-limit).map(entry => {
    const lines = entry.split('\n');
    const timestamp = lines[0].replace(']', '');
    const type = (lines.find(l => l.startsWith('type: ')) || '').replace('type: ', '') || 'unknown';
    const mood = (lines.find(l => l.startsWith('mood: ')) || '').replace('mood: ', '') || null;
    const note = lines.slice(lines.findIndex((l, i) => i > 0 && l.trim() === '') + 1).join('\n').trim();
    const id = (lines.find(l => l.startsWith('id: ')) || '').replace('id: ', '') || 'null';
    return {
      time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      id, type, mood,
      note: note.length > 60 ? note.substring(0, 57) + '...' : note
    };
  });
}

module.exports = { saveLog, updateLastLog, getRecentLogs, getLogFile, withLock };
