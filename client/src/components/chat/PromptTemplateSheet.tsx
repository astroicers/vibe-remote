// Prompt Template Sheet - BottomSheet for managing and selecting prompt templates

import { useState, useEffect, useCallback } from 'react';
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

  // CRUD states
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch templates
  const loadTemplates = useCallback(() => {
    if (!workspaceId) return;

    setIsLoading(true);
    setError(null);

    templates
      .list(workspaceId)
      .then((data) => {
        setTemplateList(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
        setIsLoading(false);
      });
  }, [workspaceId]);

  // Fetch templates when sheet opens
  useEffect(() => {
    if (!isOpen || !workspaceId) return;
    loadTemplates();
  }, [isOpen, workspaceId, loadTemplates]);

  // Reset form states when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setEditingTemplate(null);
      setShowCreateForm(false);
      setDeleteConfirmId(null);
      setEditName('');
      setEditContent('');
    }
  }, [isOpen]);

  const handleSelect = (template: PromptTemplate) => {
    // Don't select if we're in edit or delete mode
    if (editingTemplate || deleteConfirmId) return;
    onSelectTemplate(template.content);
    onClose();
  };

  const handleStartCreate = () => {
    setShowCreateForm(true);
    setEditingTemplate(null);
    setDeleteConfirmId(null);
    setEditName('');
    setEditContent('');
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setEditName('');
    setEditContent('');
  };

  const handleSaveCreate = async () => {
    if (!editName.trim() || !editContent.trim()) return;
    setIsSaving(true);
    try {
      await templates.create({ workspaceId, name: editName.trim(), content: editContent.trim() });
      setShowCreateForm(false);
      setEditName('');
      setEditContent('');
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setShowCreateForm(false);
    setDeleteConfirmId(null);
    setEditName(template.name);
    setEditContent(template.content);
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setEditName('');
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate || !editName.trim() || !editContent.trim()) return;
    setIsSaving(true);
    try {
      await templates.update(editingTemplate.id, {
        name: editName.trim(),
        content: editContent.trim(),
      });
      setEditingTemplate(null);
      setEditName('');
      setEditContent('');
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async (id: string) => {
    setIsSaving(true);
    try {
      await templates.delete(id);
      setDeleteConfirmId(null);
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setIsSaving(false);
    }
  };

  const renderForm = (
    onSave: () => void,
    onCancel: () => void,
    saveLabel: string
  ) => (
    <div className="px-4 py-3 space-y-3">
      <input
        type="text"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        placeholder="Template name"
        className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        autoFocus
      />
      <textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        placeholder="Template content..."
        rows={4}
        className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 text-sm text-text-secondary rounded-xl hover:bg-bg-tertiary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isSaving || !editName.trim() || !editContent.trim()}
          className="px-4 py-2 text-sm text-white bg-accent rounded-xl hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Prompt Templates">
      <div className="flex flex-col" style={{ minHeight: '200px' }}>
        {/* Header with New button */}
        {!showCreateForm && !editingTemplate && (
          <div className="px-4 pt-1 pb-2 flex justify-end">
            <button
              onClick={handleStartCreate}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-accent hover:bg-bg-tertiary rounded-xl transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              New
            </button>
          </div>
        )}

        {/* Create form */}
        {showCreateForm && renderForm(handleSaveCreate, handleCancelCreate, 'Create')}

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
        {!isLoading && !error && !showCreateForm && (
          <div className="px-2 py-2 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 100px)' }}>
            {templateList.length > 0 ? (
              <div className="space-y-1">
                {templateList.map((template) => (
                  <div key={template.id}>
                    {/* Edit form for this template */}
                    {editingTemplate?.id === template.id ? (
                      <div className="rounded-xl bg-bg-surface border border-border">
                        {renderForm(handleSaveEdit, handleCancelEdit, 'Save')}
                      </div>
                    ) : deleteConfirmId === template.id ? (
                      /* Delete confirmation */
                      <div className="p-3 rounded-xl bg-bg-surface border border-border">
                        <p className="text-sm text-text-primary mb-3">
                          Delete &quot;{template.name}&quot;?
                        </p>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            disabled={isSaving}
                            className="px-3 py-1.5 text-sm text-text-secondary rounded-xl hover:bg-bg-tertiary transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteConfirm(template.id)}
                            disabled={isSaving}
                            className="px-3 py-1.5 text-sm text-white bg-danger rounded-xl hover:opacity-90 transition-colors disabled:opacity-50"
                          >
                            {isSaving ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal template display */
                      <div className="flex items-start gap-1 rounded-xl hover:bg-bg-tertiary transition-colors">
                        <button
                          onClick={() => handleSelect(template)}
                          className="p-3 flex-1 flex flex-col gap-1 text-left min-w-0"
                        >
                          <span className="text-sm font-medium text-text-primary">
                            {template.name}
                          </span>
                          <span className="text-xs text-text-muted line-clamp-2">
                            {template.content}
                          </span>
                        </button>
                        {/* Action buttons */}
                        <div className="flex items-center gap-0.5 pt-2.5 pr-1.5 shrink-0">
                          {/* Edit button */}
                          <button
                            onClick={() => handleStartEdit(template)}
                            className="p-1.5 text-text-muted hover:text-accent rounded-lg transition-colors"
                            title="Edit template"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                            </svg>
                          </button>
                          {/* Delete button */}
                          <button
                            onClick={() => {
                              setDeleteConfirmId(template.id);
                              setEditingTemplate(null);
                            }}
                            className="p-1.5 text-text-muted hover:text-danger rounded-lg transition-colors"
                            title="Delete template"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.8l-.35 5.25a.75.75 0 0 1-1.5-.1l.35-5.25a.75.75 0 0 1 .8-.7Zm3.64.8a.75.75 0 0 0-1.5-.1l-.35 5.25a.75.75 0 0 0 1.5.1l.35-5.25Z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
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
