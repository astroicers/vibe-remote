// Prompt Template Sheet - BottomSheet for selecting prompt templates

import { useState, useEffect } from 'react';
import { BottomSheet } from '../BottomSheet';
import { templates, type PromptTemplate } from '../../services/api';

interface PromptTemplateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onSelectTemplate: (content: string) => void;
}

export function PromptTemplateSheet({
  isOpen,
  onClose,
  workspaceId,
  onSelectTemplate,
}: PromptTemplateSheetProps) {
  const [templateList, setTemplateList] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates when sheet opens
  useEffect(() => {
    if (!isOpen || !workspaceId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    templates
      .list(workspaceId)
      .then((data) => {
        if (!cancelled) {
          setTemplateList(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load templates');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, workspaceId]);

  const handleSelect = (template: PromptTemplate) => {
    onSelectTemplate(template.content);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Prompt Templates">
      <div className="flex flex-col" style={{ minHeight: '200px' }}>
        {/* Loading state */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {/* Template list */}
        {!isLoading && !error && (
          <div className="px-2 py-2 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 100px)' }}>
            {templateList.length > 0 ? (
              <div className="space-y-1">
                {templateList.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className="p-3 rounded-xl flex flex-col gap-1 w-full text-left hover:bg-bg-tertiary transition-colors"
                  >
                    {/* Template name */}
                    <span className="text-sm font-medium text-text-primary">
                      {template.name}
                    </span>
                    {/* Truncated content preview */}
                    <span className="text-xs text-text-muted line-clamp-2">
                      {template.content}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-text-muted">
                No templates yet
              </div>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
