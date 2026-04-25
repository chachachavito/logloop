const { execSync } = require('child_process');

function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function getGitMetadata() {
  if (!isGitRepo()) return { branch: null, hash: null };
  try {
    const branch = execSync('git branch --show-current', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const hash = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return { branch: branch || 'detached', hash };
  } catch (e) {
    return { branch: null, hash: null };
  }
}

function commitLog(file, message) {
  try {
    execSync(`git add "${file}"`, { stdio: 'ignore' });
    execSync(`git commit -m "logloop: ${message.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function isDirty() {
  if (!isGitRepo()) return false;
  try {
    const status = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return status.length > 0;
  } catch (e) {
    return false;
  }
}

function getGitUser() {
  try {
    return execSync('git config user.name', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch (e) {
    return null;
  }
}

module.exports = {
  isGitRepo,
  getGitMetadata,
  commitLog,
  isDirty,
  getGitUser
};
