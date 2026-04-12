import React, { useState, useEffect } from 'react';

import { WalletConnector } from "@/components/WalletConnector";
import SimpleVisualEditorWrapper from '@/components/SimpleVisualEditor';
import { WorkflowConfigPanel } from '@/components/WorkflowConfigPanel';
import { OperationManual } from '@/components/OperationManual';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, BookOpen } from 'lucide-react';

export default function VisualWorkflowPage() {
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSelectedType, setManualSelectedType] = useState<string | undefined>();

  // Listen for open-operation-manual events from TimeComparisonPanel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setManualSelectedType(typeof detail === 'string' ? detail : undefined);
      setManualOpen(true);
    };
    window.addEventListener('open-operation-manual', handler);
    return () => window.removeEventListener('open-operation-manual', handler);
  }, []);

  return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="text-xl font-semibold text-gray-900">DEX WorkflowVerse</div>
              <nav className="hidden md:flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => window.location.href = '/'}>Builder</Button>
                <Button variant="ghost" size="sm" onClick={() => window.location.href = '/workflows'}>Workflows</Button>
                <Button variant="ghost" size="sm" className="text-blue-600 font-semibold" disabled>Visual</Button>
                <Button variant="ghost" size="sm" onClick={() => window.location.href = '/dashboard'}>
                  <LayoutDashboard className="h-4 w-4 mr-1" />
                  Dashboard
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  id="open-help"
                  onClick={() => setManualOpen(true)}
                >
                  <BookOpen className="h-4 w-4 mr-1" />
                  Help
                </Button>
              </nav>
            </div>
            <WalletConnector />
          </div>
        </header>
        <main className="container mx-auto py-8 px-4">
          <h1 className="text-3xl font-bold mb-6">Visual Workflow Builder</h1>
          <p className="text-gray-600 mb-8">
            Create your DeFi workflow by dragging and connecting nodes. Each node represents an action that will be executed in order.
          </p>
          
          <div className="flex h-[700px] gap-4">
            <div className="flex-grow">
              <SimpleVisualEditorWrapper />
            </div>
            <div className="w-[400px]">
              <WorkflowConfigPanel />
            </div>
          </div>
        </main>

        {/* Operation Manual Dialog */}
        <OperationManual
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          selectedType={manualSelectedType}
        />
      </div>
  );
}