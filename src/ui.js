const { getRecentLogs, saveLog } = require('./core');
const { classifyMood } = require('./classifier');
const { getGitMetadata, isDirty } = require('./git');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const moodMap = {
  focused: '🎯',
  happy: '😊',
  confused: '🌀',
  tired: '😴',
  excited: '🚀',
  anxious: '😰',
  frustrated: '😤',
  neutral: '😐',
  unidentified: '📝'
};

const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
const pad = (str, n) => str + ' '.repeat(Math.max(0, n - stripAnsi(str).length));

function render(logs, state) {
  process.stdout.write('\x1Bc');
  
  // Header only appears if Help is active (Zen Mode by default)
  if (state.showHelp) {
    const git = getGitMetadata() || { branch: 'no-repo' };
    const dirty = isDirty() ? '\x1b[31m(dirty)\x1b[0m' : '\x1b[32m(clean)\x1b[0m';
    const cStatus = state.autoCommit ? '\x1b[32mON\x1b[0m' : '\x1b[31mOFF\x1b[0m';
    const mStatus = state.moodTracking ? '\x1b[32mON\x1b[0m' : '\x1b[31mOFF\x1b[0m';

    console.log(`\x1b[1;35mSELF-LOG INTERACTIVE\x1b[0m \x1b[90m| v1.0.0\x1b[0m`);
    console.log(`\x1b[90mBranch:\x1b[0m ${pad(git.branch, 12)} ${dirty}`);
    console.log(`\x1b[90mConfig:\x1b[0m Commit:${cStatus}  Mood:${mStatus}`);
    console.log(`\x1b[90m${'─'.repeat(50)}\x1b[0m\n`);
  }

  // Logs are always visible
  if (logs.length === 0) {
    console.log('  \x1b[90mNenhum log registrado ainda.\x1b[0m');
  } else {
    logs.forEach(log => {
      const emoji = moodMap[log.mood] || '•';
      const color = log.type === 'decision' ? '\x1b[1;33m' : 
                    log.type === 'question' ? '\x1b[1;34m' : '\x1b[36m';
      const typeLabel = `[${log.type.charAt(0).toUpperCase()}]`;
      
      console.log(` \x1b[90m${log.time}\x1b[0m ${emoji} ${color}${typeLabel}\x1b[0m ${log.note}`);
    });
  }

  // Minimalist Footer
  console.log(`\x1b[90m${'─'.repeat(50)}\x1b[0m`);
  if (state.showHelp) {
    console.log(`\x1b[33mMENU DE AJUDA:\x1b[0m`);
    console.log(` \x1b[1m/c\x1b[0m - Alternar Auto-commit`);
    console.log(` \x1b[1m/m\x1b[0m - Alternar Mood Tracking`);
    console.log(` \x1b[1m/e\x1b[0m - Abrir SELF-LOG.md para editar`);
    console.log(` \x1b[1m/q\x1b[0m - Sair`);
    console.log(` \x1b[1m/h\x1b[0m - Fechar ajuda / Zen Mode`);
    console.log(`\x1b[90m${'─'.repeat(50)}\x1b[0m`);
  }
}

function startLoop(initialConfig, moodFlag, initialShouldCommit) {
  const state = {
    autoCommit: initialShouldCommit,
    moodTracking: initialConfig.moodTracking,
    showHelp: false
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  const refresh = () => {
    // Show more logs in Zen Mode
    const logs = getRecentLogs(state.showHelp ? 10 : 15);
    render(logs, state);
    
    // Subtle info in prompt: branch + * if dirty
    const git = getGitMetadata();
    const branchInfo = git ? `${git.branch}${isDirty() ? '*' : ''} ` : '';
    rl.setPrompt(`\x1b[90m${branchInfo}\x1b[35m› \x1b[0m`);
    rl.prompt();
  };

  refresh();

  const logPath = path.join(process.cwd(), 'SELF-LOG.md');
  let watchTimeout;
  if (fs.existsSync(logPath)) {
    fs.watch(logPath, (eventType) => {
      if (eventType === 'change') {
        clearTimeout(watchTimeout);
        watchTimeout = setTimeout(refresh, 100);
      }
    });
  }

  rl.on('line', (line) => {
    const input = line.trim();
    if (!input) return rl.prompt();

    // Slash Commands
    if (input.startsWith('/')) {
      const cmd = input.toLowerCase();
      if (cmd === '/c' || cmd === '/commit') {
        state.autoCommit = !state.autoCommit;
      } else if (cmd === '/m' || cmd === '/mood') {
        state.moodTracking = !state.moodTracking;
      } else if (cmd === '/h' || cmd === '/help') {
        state.showHelp = !state.showHelp;
      } else if (cmd === '/q' || cmd === '/quit') {
        rl.close();
        return;
      } else if (cmd === '/e' || cmd === '/edit') {
        const editor = process.env.EDITOR || 'open';
        try {
          if (editor === 'open') {
            execSync(`open "${logPath}"`);
          } else {
            // Para editores de terminal (vim, nano), precisamos pausar o readline
            rl.pause();
            const child = spawn(editor, [logPath], { stdio: 'inherit' });
            child.on('exit', () => {
              rl.resume();
              refresh();
            });
            return;
          }
        } catch (e) {
          console.log('\x1b[31mErro ao abrir editor.\x1b[0m');
        }
      } else {
        console.log('\x1b[31mComando desconhecido.\x1b[0m');
        setTimeout(refresh, 1000);
        return;
      }
      refresh();
      return;
    }

    // Normal Log
    const detected = classifyMood(input);
    let finalMood = moodFlag;
    if (!moodFlag && state.moodTracking && detected !== 'unidentified') {
      finalMood = detected;
    }
    
    saveLog(input, { shouldCommit: state.autoCommit, mood: finalMood });
    state.showHelp = false; 
    refresh();
  });

  rl.on('close', () => {
    console.log('\n\x1b[32mAté logo!\x1b[0m');
    process.exit(0);
  });
}

module.exports = { startLoop };
