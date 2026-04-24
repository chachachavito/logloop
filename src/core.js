const fs = require('fs');
const path = require('path');
const { getGitMetadata, isGitRepo, commitLog } = require('./git');
const { classifyMessage, classifyMood } = require('./classifier');

const logFile = path.join(process.cwd(), 'SELF-LOG.md');

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
    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '# DevLog\n', 'utf8');
    }
    fs.appendFileSync(logFile, entry, 'utf8');

    if (options.shouldCommit) {
      if (!isGitRepo()) {
        console.warn('\x1b[33m%s\x1b[0m', 'Aviso: Não é um repositório git. Commit ignorado.');
      } else {
        if (commitLog(logFile, note)) {
          console.log('\x1b[32m%s\x1b[0m', '✓ Commit realizado.');
        }
      }
    }
    return true;
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Erro ao salvar log:', error.message);
    return false;
  }
}

module.exports = {
  saveLog
};
