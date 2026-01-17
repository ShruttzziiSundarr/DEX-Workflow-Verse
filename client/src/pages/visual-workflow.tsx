import React from 'react';

import { WalletConnector } from "@/components/WalletConnector";
import SimpleVisualEditorWrapper from '@/components/SimpleVisualEditor';
import { WorkflowConfigPanel } from '@/components/WorkflowConfigPanel';

export default function VisualWorkflowPage() {
  return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center">
              <div className="text-xl font-semibold text-gray-900">DEX WorkflowVerse</div>
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
      </div>
  );
}