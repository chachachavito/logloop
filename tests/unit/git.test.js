/**
 * src/git.js is native ESM, so the mock has to be registered with
 * jest.unstable_mockModule before the module under test is imported — a
 * jest.mock() factory would never run in time. Hence the dynamic imports.
 */
import { jest } from '@jest/globals';

const execSync = jest.fn();

jest.unstable_mockModule('child_process', () => ({
  execSync,
  default: { execSync }
}));

const { isGitRepo, getGitMetadata, commitLog, isDirty, getGitUser } =
  await import('../../src/git.js');

describe('git.js unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    execSync.mockReset();
  });

  describe('isGitRepo', () => {
    it('should return true if inside a git work tree', () => {
      execSync.mockReturnValue(Buffer.from('true'));
      expect(isGitRepo()).toBe(true);
    });

    it('should return false if not in a git repo', () => {
      execSync.mockImplementation(() => { throw new Error('not a git repo'); });
      expect(isGitRepo()).toBe(false);
    });
  });

  describe('getGitMetadata', () => {
    it('should return branch and hash if in git repo', () => {
      // Mock isGitRepo (first call)
      execSync.mockReturnValueOnce(Buffer.from('true'))
              .mockReturnValueOnce(Buffer.from('main\n'))
              .mockReturnValueOnce(Buffer.from('abc12345\n'));

      const meta = getGitMetadata();
      expect(meta.branch).toBe('main');
      expect(meta.hash).toBe('abc12345');
    });

    it('should return nulls if not in git repo', () => {
      execSync.mockImplementation(() => { throw new Error(); });
      expect(getGitMetadata()).toEqual({ branch: null, hash: null });
    });

    it('should handle detached HEAD', () => {
      execSync.mockReturnValueOnce(Buffer.from('true')) // isGitRepo
              .mockReturnValueOnce(Buffer.from(''))     // branch --show-current
              .mockReturnValueOnce(Buffer.from('abc12345\n')); // rev-parse HEAD

      const meta = getGitMetadata();
      expect(meta.branch).toBe('detached');
    });
  });

  describe('commitLog', () => {
    it('should return true on successful commit', () => {
      execSync.mockReturnValue(Buffer.from(''));
      expect(commitLog('file.md', 'test message')).toBe(true);
      expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git commit'), expect.anything());
    });

    it('should escape quotes in commit message', () => {
      execSync.mockReturnValue(Buffer.from(''));
      commitLog('file.md', 'message with "quotes"');
      expect(execSync).toHaveBeenCalledWith(expect.stringContaining('message with \\"quotes\\"'), expect.anything());
    });

    it('should return false on failure', () => {
      execSync.mockImplementation(() => { throw new Error(); });
      expect(commitLog('file.md', 'fail')).toBe(false);
    });
  });

  describe('isDirty', () => {
    it('should return true if repo has changes', () => {
      execSync.mockReturnValueOnce(Buffer.from('true')) // isGitRepo
              .mockReturnValueOnce(Buffer.from('M file.js\n'));
      expect(isDirty()).toBe(true);
    });

    it('should return false if repo is clean', () => {
      execSync.mockReturnValueOnce(Buffer.from('true')) // isGitRepo
              .mockReturnValueOnce(Buffer.from(''));
      expect(isDirty()).toBe(false);
    });
  });

  describe('getGitUser', () => {
    it('should return user name', () => {
      execSync.mockReturnValue(Buffer.from('John Doe\n'));
      expect(getGitUser()).toBe('John Doe');
    });

    it('should return null on failure', () => {
      execSync.mockImplementation(() => { throw new Error(); });
      expect(getGitUser()).toBe(null);
    });
  });
});
