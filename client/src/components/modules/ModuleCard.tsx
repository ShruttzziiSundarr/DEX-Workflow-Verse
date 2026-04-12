import { useState } from "react";
import { ModuleType } from "@shared/schema";

interface ModuleCardProps {
  type: ModuleType;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  status?: "full" | "partial" | "demo";
  example?: string;
  useCase?: string;
}

const STATUS_CONFIG = {
  full:    { label: "Live",    className: "bg-green-500/20 text-green-400 border border-green-500/30" },
  partial: { label: "Partial", className: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" },
  demo:    { label: "Demo",    className: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
};

export function ModuleCard({ type, title, description, icon, color, bgColor, status, example, useCase }: ModuleCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true);
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragEnd = () => {
    setIsDragging(false);
  };

  const statusCfg = status ? STATUS_CONFIG[status] : null;

  return (
    <div
      className={`module-card bg-dark-100 rounded-lg border-l-4 transition-all duration-200 cursor-grab ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
      style={{ borderLeftColor: color }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main row */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center mr-3 shrink-0"
            style={{ backgroundColor: bgColor }}
          >
            <span className="material-icons text-sm" style={{ color }}>{icon}</span>
          </div>
          <div>
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {statusCfg && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ml-2 ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
        )}
      </div>

      {/* Hover detail panel */}
      {hovered && (example || useCase) && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
          {example && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Example</p>
              <p className="text-xs text-foreground leading-snug">{example}</p>
            </div>
          )}
          {useCase && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Use Case</p>
              <p className="text-xs text-muted-foreground leading-snug">{useCase}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
