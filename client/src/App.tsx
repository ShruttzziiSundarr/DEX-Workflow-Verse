import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkflowProvider } from "@/hooks/use-workflow";
import { WalletProvider } from "@/hooks/use-wallet";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Workflows from "@/pages/workflows";
import VisualWorkflow from "@/pages/visual-workflow";
import Dashboard from "@/pages/dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/visual" component={VisualWorkflow} />
      <Route path="/dashboard" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <WorkflowProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </WorkflowProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
