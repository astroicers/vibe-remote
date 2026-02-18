import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ToolApprovalStore,
  DEFAULT_TOOL_APPROVAL_CONFIG,
  formatToolForDisplay,
  type ToolUseInfo,
} from './tool-approval.js';

describe('ToolApprovalStore', () => {
  let store: ToolApprovalStore;

  beforeEach(() => {
    store = new ToolApprovalStore();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    // Clear all approvals silently (catch rejections)
    const pendingCount = store.size;
    if (pendingCount > 0) {
      // Just reset the store instead of rejecting
      store['pending'].clear();
    }
    vi.useRealTimers();
  });

  describe('requestApproval', () => {
    it('should auto-approve read-only tools', async () => {
      const toolInfo: ToolUseInfo = {
        id: 'tool-1',
        name: 'Read',
        input: { path: '/test/file.ts' },
      };

      const result = await store.requestApproval(toolInfo, 'conv-1', 'device-1');

      expect(result.approved).toBe(true);
      expect(store.size).toBe(0); // Not stored in pending
    });

    it('should not auto-approve write tools', async () => {
      const toolInfo: ToolUseInfo = {
        id: 'tool-1',
        name: 'Write',
        input: { path: '/test/file.ts', content: 'test' },
      };

      // Start the approval request (don't await)
      const approvalPromise = store.requestApproval(toolInfo, 'conv-1', 'device-1');

      // Should be in pending state
      expect(store.size).toBe(1);
      expect(store.isPending('tool-1')).toBe(true);

      // Approve it
      store.approve('tool-1');

      const result = await approvalPromise;
      expect(result.approved).toBe(true);
    });

    it('should timeout after configured time', async () => {
      const shortTimeoutStore = new ToolApprovalStore({ timeoutMs: 1000, autoApproveReadOnly: false });

      const toolInfo: ToolUseInfo = {
        id: 'tool-1',
        name: 'Bash',
        input: { command: 'rm -rf /' },
      };

      const approvalPromise = shortTimeoutStore.requestApproval(toolInfo, 'conv-1', 'device-1');

      // Advance time past timeout
      vi.advanceTimersByTime(1001);

      await expect(approvalPromise).rejects.toThrow('Tool approval timeout');
    });
  });

  describe('approve', () => {
    it('should resolve pending approval with approved=true', async () => {
      const toolInfo: ToolUseInfo = {
        id: 'tool-1',
        name: 'Write',
        input: { path: '/test.ts' },
      };

      const approvalPromise = store.requestApproval(toolInfo, 'conv-1', 'device-1');

      const approved = store.approve('tool-1');
      expect(approved).toBe(true);

      const result = await approvalPromise;
      expect(result.approved).toBe(true);
    });

    it('should pass modified input if provided', async () => {
      const toolInfo: ToolUseInfo = {
        id: 'tool-1',
        name: 'Write',
        input: { path: '/test.ts', content: 'original' },
      };

      const approvalPromise = store.requestApproval(toolInfo, 'conv-1', 'device-1');

      store.approve('tool-1', { path: '/test.ts', content: 'modified' });

      const result = await approvalPromise;
      expect(result.modifiedInput).toEqual({ path: '/test.ts', content: 'modified' });
    });

    it('should return false for non-existent tool', () => {
      const approved = store.approve('non-existent');
      expect(approved).toBe(false);
    });
  });

  describe('reject', () => {
    it('should resolve pending approval with approved=false', async () => {
      const toolInfo: ToolUseInfo = {
        id: 'tool-1',
        name: 'Bash',
        input: { command: 'dangerous' },
      };

      const approvalPromise = store.requestApproval(toolInfo, 'conv-1', 'device-1');

      store.reject('tool-1', 'Too dangerous');

      const result = await approvalPromise;
      expect(result.approved).toBe(false);
      expect(result.reason).toBe('Too dangerous');
    });

    it('should return false for non-existent tool', () => {
      const rejected = store.reject('non-existent');
      expect(rejected).toBe(false);
    });
  });

  describe('getPendingForDevice', () => {
    it('should return pending approvals for specific device', async () => {
      const tool1: ToolUseInfo = { id: 'tool-1', name: 'Write', input: {} };
      const tool2: ToolUseInfo = { id: 'tool-2', name: 'Bash', input: {} };
      const tool3: ToolUseInfo = { id: 'tool-3', name: 'Edit', input: {} };

      store.requestApproval(tool1, 'conv-1', 'device-1');
      store.requestApproval(tool2, 'conv-2', 'device-1');
      store.requestApproval(tool3, 'conv-3', 'device-2');

      const device1Pending = store.getPendingForDevice('device-1');
      expect(device1Pending).toHaveLength(2);

      const device2Pending = store.getPendingForDevice('device-2');
      expect(device2Pending).toHaveLength(1);
    });
  });

  describe('getPendingForConversation', () => {
    it('should return pending approvals for specific conversation', async () => {
      const tool1: ToolUseInfo = { id: 'tool-1', name: 'Write', input: {} };
      const tool2: ToolUseInfo = { id: 'tool-2', name: 'Bash', input: {} };

      store.requestApproval(tool1, 'conv-1', 'device-1');
      store.requestApproval(tool2, 'conv-1', 'device-1');

      const pending = store.getPendingForConversation('conv-1');
      expect(pending).toHaveLength(2);
    });
  });

  describe('cancelForConversation', () => {
    it('should cancel all pending approvals for conversation', async () => {
      const tool1: ToolUseInfo = { id: 'tool-1', name: 'Write', input: {} };
      const tool2: ToolUseInfo = { id: 'tool-2', name: 'Bash', input: {} };

      const promise1 = store.requestApproval(tool1, 'conv-1', 'device-1');
      const promise2 = store.requestApproval(tool2, 'conv-1', 'device-1');

      const cancelled = store.cancelForConversation('conv-1');
      expect(cancelled).toBe(2);
      expect(store.size).toBe(0);

      await expect(promise1).rejects.toThrow('Conversation cancelled');
      await expect(promise2).rejects.toThrow('Conversation cancelled');
    });
  });

  describe('config', () => {
    it('should respect autoApproveReadOnly=false', async () => {
      const strictStore = new ToolApprovalStore({
        timeoutMs: 60000,
        autoApproveReadOnly: false,
      });

      const toolInfo: ToolUseInfo = {
        id: 'tool-1',
        name: 'Read',
        input: { path: '/test.ts' },
      };

      strictStore.requestApproval(toolInfo, 'conv-1', 'device-1');

      // Read tool should now be pending
      expect(strictStore.size).toBe(1);

      // Clear without triggering rejections
      strictStore['pending'].clear();
    });

    it('should allow config updates', () => {
      store.updateConfig({ timeoutMs: 30000 });

      const config = store.getConfig();
      expect(config.timeoutMs).toBe(30000);
      expect(config.autoApproveReadOnly).toBe(DEFAULT_TOOL_APPROVAL_CONFIG.autoApproveReadOnly);
    });
  });
});

describe('formatToolForDisplay', () => {
  it('should format Write tool correctly', () => {
    const info = formatToolForDisplay({
      id: 'tool-1',
      name: 'Write',
      input: { file_path: '/src/index.ts', content: 'code' },
    });

    expect(info.title).toBe('Write File');
    expect(info.description).toContain('/src/index.ts');
    expect(info.risk).toBe('medium');
  });

  it('should format Bash tool as high risk', () => {
    const info = formatToolForDisplay({
      id: 'tool-1',
      name: 'Bash',
      input: { command: 'npm install' },
    });

    expect(info.title).toBe('Execute Command');
    expect(info.description).toContain('npm install');
    expect(info.risk).toBe('high');
  });

  it('should format Delete tool as high risk', () => {
    const info = formatToolForDisplay({
      id: 'tool-1',
      name: 'Delete',
      input: { path: '/src/old-file.ts' },
    });

    expect(info.title).toBe('Delete File');
    expect(info.risk).toBe('high');
  });

  it('should format Read tool as low risk', () => {
    const info = formatToolForDisplay({
      id: 'tool-1',
      name: 'Read',
      input: { path: '/src/index.ts' },
    });

    expect(info.risk).toBe('low');
  });

  it('should truncate long commands', () => {
    const longCommand = 'a'.repeat(200);
    const info = formatToolForDisplay({
      id: 'tool-1',
      name: 'Bash',
      input: { command: longCommand },
    });

    expect(info.description.length).toBeLessThanOrEqual(105); // "Run: " + 100 chars
  });
});
