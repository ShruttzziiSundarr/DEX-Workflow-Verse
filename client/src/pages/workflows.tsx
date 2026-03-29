import { useState } from "react";
import { WalletProvider, useWallet } from "@/pages/home";
import { WalletConnector } from "@/components/WalletConnector";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import WorkflowCreationForm from "@/components/WorkflowCreationForm";
import WorkflowList from "@/components/WorkflowList";
import { PlusCircle, ListChecks } from "lucide-react";

function WorkflowsContent() {
  const { wallet } = useWallet();
  const [activeTab, setActiveTab] = useState<string>("my-workflows");

  if (!wallet || !wallet.isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Connect your wallet
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            You need to connect your wallet to access workflow features.
          </p>
          <div className="mt-6">
            <WalletConnector />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Workflow Manager</h1>
          <p className="text-muted-foreground">Create, manage, and execute your DeFi workflows</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setActiveTab("create-workflow")}
            variant={activeTab === "create-workflow" ? "default" : "outline"}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            Create Workflow
          </Button>
          <Button
            onClick={() => setActiveTab("my-workflows")}
            variant={activeTab === "my-workflows" ? "default" : "outline"}
            size="lg"
          >
            <ListChecks className="h-5 w-5 mr-2" />
            My Workflows
          </Button>
        </div>
      </div>

      <Tabs defaultValue="my-workflows" value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="create-workflow" className="mt-6">
          <WorkflowCreationForm />
        </TabsContent>
        <TabsContent value="my-workflows" className="mt-6">
          <WorkflowList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Workflows() {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="bg-card border-b border-border">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <a href="/" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                <span className="text-primary text-xl font-bold tracking-tight">DEX</span>
                <span className="text-foreground text-xl font-light tracking-tight">WorkflowVerse</span>
              </a>
              <nav className="hidden md:flex gap-1">
                <a href="/"><Button variant="ghost" size="sm">Builder</Button></a>
                <Button variant="ghost" size="sm" className="text-primary font-semibold" disabled>Workflows</Button>
                <a href="/visual"><Button variant="ghost" size="sm">Visual</Button></a>
                <a href="/dashboard"><Button variant="ghost" size="sm">Dashboard</Button></a>
              </nav>
            </div>
            <WalletConnector />
          </div>
        </header>
        <main>
          <WorkflowsContent />
        </main>
      </div>
    </WalletProvider>
  );
}