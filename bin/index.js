#!/usr/bin/env node

const readline = require('readline');
const pkg = require('../package.json');
const { loadConfig, saveConfig } = require('../src/config');
const { classifyMood, allowedMoods } = require('../src/classifier');
const { saveLog } = require('../src/core');

const config = loadConfig();
const args = process.argv.slice(2);

// --- Command Handlers ---

function handleConfig(args) {
  const [cmd, key, value] = args;

  if (!cmd || (cmd !== 'get' && cmd !== 'set')) {
    console.log('Uso: self-log config get <key> | set <key> <value>');
    process.exit(0);
  }

  if (cmd === 'get') {
    if (!key) {
      console.log('Configuração atual:', config);
    } else {
      console.log(config[key] !== undefined ? config[key] : `Chave "${key}" não definida.`);
    }
  } else if (cmd === 'set') {
    if (!key || value === undefined) {
      console.error('\x1b[31m%s\x1b[0m', 'Erro: Chave e valor são necessários para "set".');
      process.exit(1);
    }
    config[key] = value === 'true' ? true : value === 'false' ? false : value;
    saveConfig(config);
    console.log('\x1b[32m%s\x1b[0m', `✓ Configuração "${key}" atualizada para: ${config[key]}`);
  }
  process.exit(0);
}

function showHelp() {
  console.log(`
Uso: self-log [mensagem] [opções]

Opções:
  --commit       Força o git commit
  --no-commit    Desabilita o git commit (sobrescreve config)
  --mood <mood>  Define o humor manualmente (${allowedMoods.join(', ')})
  -v, --version  Mostra a versão
  -h, --help     Mostra ajuda

Configuração:
  self-log config get <key>
  self-log config set <key> <value>
  `);
}

function run(note, moodFlag, shouldCommit) {
  const detected = classifyMood(note);
  let finalMood = moodFlag;

  if (!moodFlag && config.moodTracking && detected !== 'unidentified') {
    finalMood = detected;
  }

  saveLog(note, { shouldCommit, mood: finalMood });

  if (finalMood && config.moodTracking && !moodFlag) {
    console.log(`\x1b[35m[self-log] Humor detectado: ${finalMood}\x1b[0m`);
  }
}

// --- Main execution ---

if (args[0] === 'config') {
  handleConfig(args.slice(1));
}

if (args.includes('-v') || args.includes('--version')) {
  console.log(`self-log v${pkg.version}`);
  process.exit(0);
}

if (args.includes('-h') || args.includes('--help')) {
  showHelp();
  process.exit(0);
}

const noCommitFlag = args.includes('--no-commit');
const commitFlag = args.includes('--commit');
const moodIndex = args.indexOf('--mood');
const moodFlag = moodIndex !== -1 ? args[moodIndex + 1] : null;

const filteredArgs = args.filter((a, i) => {
  if (['--commit', '--no-commit'].includes(a)) return false;
  if (a === '--mood') return false;
  if (i > 0 && args[i - 1] === '--mood') return false;
  return true;
});
const noteArg = filteredArgs.join(' ');

// Behavioral Resolution
let shouldCommit = false;
if (noCommitFlag) {
  shouldCommit = false;
} else if (commitFlag) {
  shouldCommit = true;
} else if (config.autoCommit !== undefined) {
  shouldCommit = !!config.autoCommit;
}

if (noteArg) {
  run(noteArg, moodFlag, shouldCommit);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\x1b[36m›\x1b[0m ', (answer) => {
    rl.close();
    run(answer, moodFlag, shouldCommit);
  });
}
