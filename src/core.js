const fs = require('fs');
const path = require('path');
const { getGitMetadata, isGitRepo, commitLog } = require('./git');
const { classifyMessage } = require('./classifier');
const { t } = require('./i18n');
const { loadConfig, GLOBAL_DIR } = require('./config');

function generateId() {
  // Maior entropia para evitar colisões em concorrência
  return Math.random().toString(16).substring(2, 6);
}

function getLogFile() {
  const config = loadConfig();
  const user = config.userName || 'shared';
  const userSlug = user.toLowerCase().replace(/\s+/g, '-');

  if (config.storage === 'local') {
    const logsDir = path.join(GLOBAL_DIR, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const projectDirName = path.basename(process.cwd());
    return path.join(logsDir, `${projectDirName}.${userSlug}.md`);
  }

  const fileName = user === 'shared' ? 'logloop.md' : `logloop.${userSlug}.md`;
  return path.join(process.cwd(), fileName);
}

function withLock(logFile, action) {
  const lockFile = `${logFile}.lock`;
  const tmpFile = `${logFile}.tmp`;
  let retries = 5;
  
  while (retries > 0) {
    try {
      fs.openSync(lockFile, 'wx');
      break;
    } catch (e) {
      retries--;
      if (retries === 0) throw new Error(t('cli.lockError') || 'File is locked by another process.');
      // Pequeno delay síncrono para liberar o FS
      const start = Date.now();
      while (Date.now() - start < 100) {} 
    }
  }

  try {
    const result = action(tmpFile);
    // Atomic Swap
    if (fs.existsSync(tmpFile)) {
      fs.renameSync(tmpFile, logFile);
    }
    return result;
  } finally {
    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

function saveLog(note, options = {}) {
  const logFile = getLogFile();
  
  return withLock(logFile, (tmpFile) => {
    const { hash, branch } = getGitMetadata();
    const { category } = classifyMessage(note);
    const id = generateId();
    const mood = options.mood || 'null';

    const entry = `\n## [${new Date().toISOString()}]\nid: ${id}\ncommit: ${hash || 'null'}\nbranch: ${branch || 'null'}\ntype: ${category}\nmood: ${mood}\n\n${note}\n`;

    const currentContent = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '# DevLog\n';
    fs.writeFileSync(tmpFile, currentContent + entry, 'utf8');

    if (options.shouldCommit && isGitRepo() && loadConfig().storage !== 'local') {
      if (commitLog(logFile, note)) {
        console.log('\x1b[32m%s\x1b[0m', t('cli.commitSuccess'));
      }
    }
    return true;
  });
}

function updateLastLog(updates = {}) {
  const logFile = getLogFile();
  if (!fs.existsSync(logFile)) return false;

  return withLock(logFile, (tmpFile) => {
    let content = fs.readFileSync(logFile, 'utf8');
    const sections = content.split('\n## [');
    if (sections.length < 2) return false;

    let lastSection = sections[sections.length - 1];
    const lines = lastSection.split('\n');

    if (updates.type) {
      const typeIndex = lines.findIndex(l => l.startsWith('type: '));
      if (typeIndex > -1) lines[typeIndex] = `type: ${updates.type}`;
    }

    if (updates.mood) {
      const moodIndex = lines.findIndex(l => l.startsWith('mood: '));
      if (moodIndex > -1) lines[moodIndex] = `mood: ${updates.mood}`;
      else {
        const emptyLineIndex = lines.findIndex((l, i) => i > 0 && l.trim() === '');
        lines.splice(emptyLineIndex, 0, `mood: ${updates.mood}`);
      }
    }

    sections[sections.length - 1] = lines.join('\n');
    fs.writeFileSync(tmpFile, sections.join('\n## ['), 'utf8');
    return true;
  });
}

function getRecentLogs(limit = 5) {
  const logFile = getLogFile();
  if (!fs.existsSync(logFile)) return [];
  
  const content = fs.readFileSync(logFile, 'utf8');
  const entries = content.split('\n## [').slice(1);
  
  return entries.slice(-limit).map(entry => {
    const lines = entry.split('\n');
    const timestamp = lines[0].replace(']', '');
    const typeLine = lines.find(l => l.startsWith('type: '));
    const type = typeLine ? typeLine.replace('type: ', '') : 'unknown';
    const moodLine = lines.find(l => l.startsWith('mood: '));
    const mood = moodLine ? moodLine.replace('mood: ', '') : null;
    const emptyLineIndex = lines.findIndex((l, i) => i > 0 && l.trim() === '');
    const note = lines.slice(emptyLineIndex + 1).join('\n').trim();
    const idLine = lines.find(l => l.startsWith('id: '));
    const id = idLine ? idLine.replace('id: ', '') : 'null';

    return {
      time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      id, type, mood,
      note: note.length > 60 ? note.substring(0, 57) + '...' : note
    };
  });
}

function getStats(days = 7) {
  const logFile = getLogFile();
  if (!fs.existsSync(logFile)) return null;

  const content = fs.readFileSync(logFile, 'utf8');
  const sections = content.split('\n## [').slice(1);
  
  const stats = { total: sections.length, categories: {}, moods: {}, timeline: {} };

  sections.forEach(entry => {
    const lines = entry.split('\n');
    const timestamp = lines[0].replace(']', '');
    const date = timestamp.split('T')[0];
    const entryDate = new Date(date);
    if ((new Date() - entryDate) / (1000 * 60 * 60 * 24) > days) return;

    const type = (lines.find(l => l.startsWith('type: ')) || '').replace('type: ', '') || 'unknown';
    const mood = (lines.find(l => l.startsWith('mood: ')) || '').replace('mood: ', '') || 'neutral';

    stats.categories[type] = (stats.categories[type] || 0) + 1;
    stats.moods[mood] = (stats.moods[mood] || 0) + 1;
    if (!stats.timeline[date]) stats.timeline[date] = { count: 0, moods: [] };
    stats.timeline[date].count++;
    if (!stats.timeline[date].moods.includes(mood)) stats.timeline[date].moods.push(mood);
  });

  return stats;
}

function getDailySummary() {
  const stats = getStats(1);
  if (!stats) return null;
  const logFile = getLogFile();
  const content = fs.readFileSync(logFile, 'utf8');
  const sections = content.split('\n## [').slice(1);
  const today = new Date().toISOString().split('T')[0];
  const summary = { decisions: [], questions: [], topActions: [], mood: 'neutral' };

  sections.forEach(entry => {
    const lines = entry.split('\n');
    const timestampLine = lines[0] || '';
    const timestamp = timestampLine.includes(']') ? timestampLine.split(']')[0] : timestampLine;
    if (!timestamp.startsWith(today)) return;
    const type = (lines.find(l => l.startsWith('type: ')) || '').replace('type: ', '') || 'unknown';
    const note = lines.slice(lines.findIndex((l, i) => i > 0 && l.trim() === '') + 1).join('\n').trim();
    if (type === 'decision') summary.decisions.push(note);
    if (type === 'question') summary.questions.push(note);
    if (type === 'action') summary.topActions.push(note);
  });

  if (Object.keys(stats.moods).length > 0) {
    summary.mood = Object.entries(stats.moods).sort((a, b) => b[1] - a[1])[0][0];
  }
  return summary;
}

module.exports = { saveLog, getRecentLogs, getLogFile, updateLastLog, getStats, getDailySummary };
