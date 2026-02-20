import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileTree, type FileNode } from './FileTree';

const sampleNodes: FileNode[] = [
  {
    name: 'src',
    path: '/src',
    type: 'directory',
    children: [
      { name: 'index.ts', path: '/src/index.ts', type: 'file' },
      { name: 'utils.ts', path: '/src/utils.ts', type: 'file' },
    ],
  },
  { name: 'README.md', path: '/README.md', type: 'file' },
  { name: 'package.json', path: '/package.json', type: 'file' },
];

describe('FileTree', () => {
  it('renders file nodes', () => {
    render(
      <FileTree
        nodes={sampleNodes}
        selectedPaths={new Set()}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();
  });

  it('renders directory nodes', () => {
    render(
      <FileTree
        nodes={sampleNodes}
        selectedPaths={new Set()}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText('src')).toBeInTheDocument();
  });

  it('calls onToggle when a file is clicked', () => {
    const handleToggle = vi.fn();
    render(
      <FileTree
        nodes={sampleNodes}
        selectedPaths={new Set()}
        onToggle={handleToggle}
      />
    );
    fireEvent.click(screen.getByText('README.md'));
    expect(handleToggle).toHaveBeenCalledWith('/README.md');
  });

  it('expands directory on click and shows children', () => {
    render(
      <FileTree
        nodes={sampleNodes}
        selectedPaths={new Set()}
        onToggle={() => {}}
      />
    );

    // Children should not be visible initially (collapsed)
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();

    // Click directory to expand
    fireEvent.click(screen.getByText('src'));

    // Children should now be visible
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    expect(screen.getByText('utils.ts')).toBeInTheDocument();
  });

  it('collapses directory on second click', () => {
    render(
      <FileTree
        nodes={sampleNodes}
        selectedPaths={new Set()}
        onToggle={() => {}}
      />
    );

    // Expand
    fireEvent.click(screen.getByText('src'));
    expect(screen.getByText('index.ts')).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText('src'));
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
  });

  it('shows checkbox for files', () => {
    render(
      <FileTree
        nodes={[{ name: 'file.ts', path: '/file.ts', type: 'file' }]}
        selectedPaths={new Set()}
        onToggle={() => {}}
      />
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Select file.ts' });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('checks checkbox when file is in selectedPaths', () => {
    render(
      <FileTree
        nodes={[{ name: 'file.ts', path: '/file.ts', type: 'file' }]}
        selectedPaths={new Set(['/file.ts'])}
        onToggle={() => {}}
      />
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Select file.ts' });
    expect(checkbox).toBeChecked();
  });

  it('calls onToggle when checkbox is clicked', () => {
    const handleToggle = vi.fn();
    render(
      <FileTree
        nodes={[{ name: 'file.ts', path: '/file.ts', type: 'file' }]}
        selectedPaths={new Set()}
        onToggle={handleToggle}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select file.ts' }));
    expect(handleToggle).toHaveBeenCalledWith('/file.ts');
  });

  it('indents based on depth', () => {
    const { container } = render(
      <FileTree
        nodes={[{ name: 'deep.ts', path: '/deep.ts', type: 'file' }]}
        selectedPaths={new Set()}
        onToggle={() => {}}
        depth={3}
      />
    );
    // depth=3 means paddingLeft = 3 * 16 + 8 = 56px
    const row = container.querySelector('[style]');
    expect(row).toHaveStyle({ paddingLeft: '56px' });
  });

  it('does not call onToggle when directory is clicked', () => {
    const handleToggle = vi.fn();
    render(
      <FileTree
        nodes={[
          {
            name: 'dir',
            path: '/dir',
            type: 'directory',
            children: [{ name: 'child.ts', path: '/dir/child.ts', type: 'file' }],
          },
        ]}
        selectedPaths={new Set()}
        onToggle={handleToggle}
      />
    );
    fireEvent.click(screen.getByText('dir'));
    expect(handleToggle).not.toHaveBeenCalled();
  });
});
