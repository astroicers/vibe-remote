// AppLayout - Wraps pages with app-shell, WorkspaceTabs, and BottomNav

import type { ReactNode } from 'react';
import { WorkspaceTabs } from './WorkspaceTabs';
import { StatusBar } from './StatusBar';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-shell bg-bg-primary">
      <WorkspaceTabs />
      <StatusBar />
      {children}
      <BottomNav />
    </div>
  );
}
