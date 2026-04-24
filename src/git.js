const { execSync } = require('child_process');

function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
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

function commitLog(file, message) {
  try {
    execSync(`git add "${file}"`);
    execSync(`git commit -m "logloop: ${message.replace(/"/g, '\\"')}"`);
    return true;
  } catch (e) {
    return false;
  }
}

function isDirty() {
  if (!isGitRepo()) return false;
  try {
    const status = execSync('git status --porcelain', { stdio: 'pipe' }).toString().trim();
    return status.length > 0;
  } catch (e) {
    return false;
  }
}

function getGitUser() {
  try {
    return execSync('git config user.name', { stdio: 'pipe' }).toString().trim();
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
