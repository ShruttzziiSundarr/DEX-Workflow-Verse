import { useState } from "react";
import { ModuleType } from "@shared/schema";

interface ModuleCardProps {
  type: ModuleType;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
}

export function ModuleCard({ type, title, description, icon, color, bgColor }: ModuleCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true);
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };
  
  const onDragEnd = () => {
    setIsDragging(false);
  };
  
  return (
    <div 
      className={`module-card bg-dark-100 rounded-lg p-3 border-l-4 transition-all duration-200 cursor-grab ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
      style={{ borderLeftColor: color }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center mr-3"
          style={{ backgroundColor: bgColor }}
        >
          <span className="material-icons text-sm" style={{ color }}>
            {icon}
          </span>
        </div>
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
      </div>
    </div>
  );
}
