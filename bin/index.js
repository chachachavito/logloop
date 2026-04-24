#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const pkg = require('../package.json');

const logFile = path.join(process.cwd(), 'SELF-LOG.md');
const configFile = path.join(process.cwd(), '.selflogrc');

// --- Helpers ---

function loadConfig() {
  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Erro ao salvar configuração:', error.message);
  }
}

function getGitMetadata() {
  if (!isGitRepo()) return null;
  try {
    const branch = execSync('git branch --show-current', { stdio: 'pipe' }).toString().trim();
    const hash = execSync('git rev-parse HEAD', { stdio: 'pipe' }).toString().trim();
    return { branch: branch || 'detached', hash };
  } catch (e) {
    return null;
  }
}

function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

// --- Commands ---

function handleConfig(args) {
  const [cmd, key, value] = args;
  const config = loadConfig();

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
  -v, --version  Mostra a versão
  -h, --help     Mostra ajuda

Configuração:
  self-log config get <key>
  self-log config set <key> <value>
  `);
}

function saveLog(note, options = {}) {
  if (!note.trim()) {
    console.log('\x1b[31m%s\x1b[0m', 'Erro: Log vazio não foi salvo.');
    process.exit(1);
  }

  const gitMeta = getGitMetadata();
  if (!gitMeta && !isGitRepo()) {
    console.warn('\x1b[33m%s\x1b[0m', 'Aviso: Não é um repositório git. Commit/Branch vinculados como nulo.');
  }

  const hash = gitMeta ? gitMeta.hash : 'null';
  const branch = gitMeta ? gitMeta.branch : 'null';
  
  const now = new Date();
  const timestamp = now.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const entry = `\n## [${timestamp}]\ncommit: ${hash}\nbranch: ${branch}\n\n${note}\n`;

  try {
    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '# DevLog\n', 'utf8');
    }
    fs.appendFileSync(logFile, entry, 'utf8');
    console.log('\x1b[32m%s\x1b[0m', `✓ Log salvo em ${path.basename(logFile)}`);

    if (options.shouldCommit) {
      if (!isGitRepo()) {
        console.warn('\x1b[33m%s\x1b[0m', 'Aviso: Não é um repositório git. Commit ignorado.');
      } else {
        execSync(`git add "${logFile}"`);
        execSync(`git commit -m "self-log: ${note.replace(/"/g, '\\"')}"`);
        console.log('\x1b[32m%s\x1b[0m', '✓ Git commit realizado.');
      }
    }
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Erro:', error.message);
    process.exit(1);
  }
}

// --- Main ---

const args = process.argv.slice(2);
const config = loadConfig();

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
const filteredArgs = args.filter(a => !['--commit', '--no-commit'].includes(a));
const noteArg = filteredArgs.join(' ');

// Resolução de Comportamento (Priority Order)
let shouldCommit = false;
if (noCommitFlag) {
  shouldCommit = false;
} else if (commitFlag) {
  shouldCommit = true;
} else if (config.autoCommit !== undefined) {
  shouldCommit = !!config.autoCommit;
}

if (noteArg) {
  saveLog(noteArg, { shouldCommit });
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\x1b[36mEscreva o log:\x1b[0m ', (answer) => {
    saveLog(answer, { shouldCommit });
    rl.close();
  });
}
