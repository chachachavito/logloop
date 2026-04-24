const fs = require('fs');
const path = require('path');
const { getGitMetadata, isGitRepo, commitLog } = require('./git');
const { classifyMessage, classifyMood } = require('./classifier');
const { t } = require('./i18n');
const { loadConfig, GLOBAL_DIR } = require('./config');

function generateId() {
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

  // Padrão: Repo
  const fileName = user === 'shared' ? 'logloop.md' : `logloop.${userSlug}.md`;
  return path.join(process.cwd(), fileName);
}

function saveLog(note, options = {}) {
  if (!note.trim()) return;

  const gitMeta = getGitMetadata();
  const hash = gitMeta ? gitMeta.hash : 'null';
  const branch = gitMeta ? gitMeta.branch : 'null';
  const id = generateId();
  
  const timestamp = new Date().toISOString();
  const classification = classifyMessage(note);
  const type = classification.category;
  const moodResult = options.mood ? (typeof options.mood === 'object' ? options.mood.category : options.mood) : null;
  const moodLine = moodResult ? `mood: ${moodResult}\n` : '';

  const entry = `\n## [${timestamp}]\nid: ${id}\ncommit: ${hash}\nbranch: ${branch}\ntype: ${type}\n${moodLine}\n${note}\n`;

  try {
    const logFile = getLogFile();
    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '# DevLog\n', 'utf8');
    }
    fs.appendFileSync(logFile, entry, 'utf8');

    if (options.shouldCommit) {
      const config = loadConfig();
      if (config.storage === 'local') {
        // No modo local, não faz sentido comitar o arquivo de log no repositório
        return true;
      }
      
      if (!isGitRepo()) {
        console.warn('\x1b[33m%s\x1b[0m', t('cli.gitWarning'));
      } else {
        if (commitLog(logFile, note)) {
          console.log('\x1b[32m%s\x1b[0m', t('cli.commitSuccess'));
        }
      }
    }
    return true;
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Error saving log:', error.message);
    return false;
  }
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
      id,
      type,
      mood,
      note: note.length > 60 ? note.substring(0, 57) + '...' : note
    };
  });
}

function updateLastLog(updates = {}) {
  const logFile = getLogFile();
  if (!fs.existsSync(logFile)) return false;

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
      // Se não tinha mood, insere antes da primeira linha vazia (que separa metadados da nota)
      const emptyLineIndex = lines.findIndex((l, i) => i > 0 && l.trim() === '');
      lines.splice(emptyLineIndex, 0, `mood: ${updates.mood}`);
    }
  }

  sections[sections.length - 1] = lines.join('\n');
  fs.writeFileSync(logFile, sections.join('\n## ['), 'utf8');
  return true;
}

function getStats(days = 7) {
  const logFile = getLogFile();
  if (!fs.existsSync(logFile)) return null;

  const content = fs.readFileSync(logFile, 'utf8');
  const sections = content.split('\n## [').slice(1);
  
  const stats = {
    total: sections.length,
    categories: {},
    moods: {},
    timeline: {}
  };

  sections.forEach(entry => {
    const lines = entry.split('\n');
    const timestamp = lines[0].replace(']', '');
    const date = timestamp.split('T')[0];
    
    // Filtro por dias (opcional)
    const entryDate = new Date(date);
    const now = new Date();
    const diff = (now - entryDate) / (1000 * 60 * 60 * 24);
    if (diff > days) return;

    const typeLine = lines.find(l => l.startsWith('type: '));
    const type = typeLine ? typeLine.replace('type: ', '') : 'unknown';
    
    const moodLine = lines.find(l => l.startsWith('mood: '));
    const mood = moodLine ? moodLine.replace('mood: ', '') : 'neutral';

    stats.categories[type] = (stats.categories[type] || 0) + 1;
    stats.moods[mood] = (stats.moods[mood] || 0) + 1;
    
    if (!stats.timeline[date]) stats.timeline[date] = { count: 0, moods: [] };
    stats.timeline[date].count++;
    if (!stats.timeline[date].moods.includes(mood)) stats.timeline[date].moods.push(mood);
  });

  return stats;
}

function getDailySummary() {
  const stats = getStats(1); // Últimas 24h
  if (!stats) return null;

  const logFile = getLogFile();
  const content = fs.readFileSync(logFile, 'utf8');
  const sections = content.split('\n## [').slice(1);
  const today = new Date().toISOString().split('T')[0];

  const summary = {
    decisions: [],
    questions: [],
    topActions: [],
    mood: 'neutral'
  };

  // Coletar itens de hoje
  sections.forEach(entry => {
    const lines = entry.split('\n');
    const timestamp = lines[0].replace(']', '');
    if (!timestamp.startsWith(today)) return;

    const typeLine = lines.find(l => l.startsWith('type: '));
    const type = typeLine ? typeLine.replace('type: ', '') : 'unknown';
    
    const note = lines.slice(lines.findIndex((l, i) => i > 0 && l.trim() === '') + 1).join('\n').trim();

    if (type === 'decision') summary.decisions.push(note);
    if (type === 'question') summary.questions.push(note);
    if (type === 'action') summary.topActions.push(note);
  });

  // Mood predominante
  if (Object.keys(stats.moods).length > 0) {
    summary.mood = Object.entries(stats.moods).sort((a, b) => b[1] - a[1])[0][0];
  }

  return summary;
}

module.exports = {
  saveLog,
  getRecentLogs,
  getLogFile,
  updateLastLog,
  getStats,
  getDailySummary
};
