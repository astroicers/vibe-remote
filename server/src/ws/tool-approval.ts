// Tool Approval Module
// Promise-based tool approval mechanism inspired by Claude-by-Discord

export interface ToolUseInfo {
  id: string;
  name: string;
  input: unknown;
  description?: string;
}

export interface PermissionResult {
  approved: boolean;
  modifiedInput?: unknown;
  reason?: string;
}

export interface PendingApproval {
  toolId: string;
  toolInfo: ToolUseInfo;
  conversationId: string;
  deviceId: string;
  resolve: (result: PermissionResult) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  createdAt: number;
}

export interface ToolApprovalConfig {
  timeoutMs: number;
  autoApproveReadOnly: boolean;
}

export const DEFAULT_TOOL_APPROVAL_CONFIG: ToolApprovalConfig = {
  timeoutMs: 120000, // 2 minutes
  autoApproveReadOnly: true,
};

// Read-only tools that can be auto-approved
const READ_ONLY_TOOLS = new Set([
  'Read',
  'Glob',
  'Grep',
  'LS',
  'View',
  'Search',
  'ListFiles',
  'GetFileTree',
]);

export class ToolApprovalStore {
  private pending = new Map<string, PendingApproval>();
  private config: ToolApprovalConfig;

  constructor(config: ToolApprovalConfig = DEFAULT_TOOL_APPROVAL_CONFIG) {
    this.config = config;
  }

  /**
   * Request approval for a tool use.
   * Returns a Promise that resolves when the user approves/rejects.
   */
  async requestApproval(
    toolInfo: ToolUseInfo,
    conversationId: string,
    deviceId: string
  ): Promise<PermissionResult> {
    // Auto-approve read-only tools if configured
    if (this.config.autoApproveReadOnly && READ_ONLY_TOOLS.has(toolInfo.name)) {
      return { approved: true };
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(toolInfo.id);
        reject(new Error(`Tool approval timeout for ${toolInfo.name}`));
      }, this.config.timeoutMs);

      const pendingApproval: PendingApproval = {
        toolId: toolInfo.id,
        toolInfo,
        conversationId,
        deviceId,
        resolve,
        reject,
        timeoutId,
        createdAt: Date.now(),
      };

      this.pending.set(toolInfo.id, pendingApproval);
    });
  }

  /**
   * Approve a pending tool use.
   */
  approve(toolId: string, modifiedInput?: unknown): boolean {
    const pending = this.pending.get(toolId);
    if (!pending) {
      return false;
    }

    clearTimeout(pending.timeoutId);
    this.pending.delete(toolId);
    pending.resolve({ approved: true, modifiedInput });
    return true;
  }

  /**
   * Reject a pending tool use.
   */
  reject(toolId: string, reason?: string): boolean {
    const pending = this.pending.get(toolId);
    if (!pending) {
      return false;
    }

    clearTimeout(pending.timeoutId);
    this.pending.delete(toolId);
    pending.resolve({ approved: false, reason });
    return true;
  }

  /**
   * Get all pending approvals for a device.
   */
  getPendingForDevice(deviceId: string): PendingApproval[] {
    return Array.from(this.pending.values()).filter(
      (p) => p.deviceId === deviceId
    );
  }

  /**
   * Get all pending approvals for a conversation.
   */
  getPendingForConversation(conversationId: string): PendingApproval[] {
    return Array.from(this.pending.values()).filter(
      (p) => p.conversationId === conversationId
    );
  }

  /**
   * Get a specific pending approval.
   */
  getPending(toolId: string): PendingApproval | undefined {
    return this.pending.get(toolId);
  }

  /**
   * Check if a tool is pending approval.
   */
  isPending(toolId: string): boolean {
    return this.pending.has(toolId);
  }

  /**
   * Cancel all pending approvals for a conversation.
   */
  cancelForConversation(conversationId: string): number {
    let count = 0;
    for (const [id, pending] of this.pending) {
      if (pending.conversationId === conversationId) {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Conversation cancelled'));
        this.pending.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all pending approvals.
   */
  clearAll(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('All approvals cleared'));
    }
    this.pending.clear();
  }

  /**
   * Get count of pending approvals.
   */
  get size(): number {
    return this.pending.size;
  }

  /**
   * Get the current config.
   */
  getConfig(): ToolApprovalConfig {
    return { ...this.config };
  }

  /**
   * Update the config.
   */
  updateConfig(config: Partial<ToolApprovalConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance for app-wide use
export const toolApprovalStore = new ToolApprovalStore();

// Helper to format tool info for display
export function formatToolForDisplay(toolInfo: ToolUseInfo): {
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
} {
  const input = toolInfo.input as Record<string, unknown>;

  switch (toolInfo.name) {
    case 'Write':
    case 'Edit':
      return {
        title: `${toolInfo.name} File`,
        description: `Modify: ${input.file_path || input.path || 'unknown'}`,
        risk: 'medium',
      };

    case 'Bash':
      return {
        title: 'Execute Command',
        description: `Run: ${String(input.command || '').slice(0, 100)}`,
        risk: 'high',
      };

    case 'Delete':
      return {
        title: 'Delete File',
        description: `Delete: ${input.path || 'unknown'}`,
        risk: 'high',
      };

    case 'Read':
    case 'Glob':
    case 'Grep':
      return {
        title: `${toolInfo.name}`,
        description: `${input.path || input.pattern || 'files'}`,
        risk: 'low',
      };

    default:
      return {
        title: toolInfo.name,
        description: JSON.stringify(input).slice(0, 100),
        risk: 'medium',
      };
  }
}
