const fs = require('fs');
const path = require('path');
const { getGitMetadata, isGitRepo, commitLog } = require('./git');
const { classifyMessage, classifyMood } = require('./classifier');
const { t } = require('./i18n');
const { loadConfig, GLOBAL_DIR } = require('./config');

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
  
  const timestamp = new Date().toISOString();
  const type = classifyMessage(note);
  const moodLine = options.mood ? `mood: ${options.mood}\n` : '';

  const entry = `\n## [${timestamp}]\ncommit: ${hash}\nbranch: ${branch}\ntype: ${type}\n${moodLine}\n${note}\n`;

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
    
    return {
      time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type,
      mood,
      note: note.length > 60 ? note.substring(0, 57) + '...' : note
    };
  });
}

module.exports = {
  saveLog,
  getRecentLogs,
  getLogFile
};
