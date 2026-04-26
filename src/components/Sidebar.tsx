import { Box, Database } from "lucide-react";
import type { DataTree } from "../types/loot";

interface SidebarProps {
  rootData: DataTree | null;
  currentPath: string[];
  onSelectRoot: (key: string) => void;
}

export function Sidebar({ rootData, currentPath, onSelectRoot }: SidebarProps) {
  return (
    <aside className="w-72 border-r border-slate-100 bg-[#fbfcfd] flex flex-col shrink-0">
      <div className="p-10">
        <div className="flex items-center gap-4 mb-14">
          <div className="h-11 w-11 bg-slate-900 rounded-[18px] flex items-center justify-center shadow-xl rotate-2">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-[13px] tracking-[0.2em] text-slate-800 uppercase">
              MC Loot
            </h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Analyzer
            </p>
          </div>
        </div>

        <nav className="space-y-2">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-6 px-3">
            Root Categories
          </p>
          {rootData &&
            Object.keys(rootData)
              .sort()
              .map((key) => {
                const isActive = currentPath.length === 1 && currentPath[0] === key;
                return (
                  <button
                    key={key}
                    onClick={() => onSelectRoot(key)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-[22px] text-xs transition-all duration-300 ${
                      isActive
                        ? "bg-white shadow-xl shadow-slate-200/50 border border-slate-50 text-slate-900 font-bold scale-[1.03]"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Box className={`h-4 w-4 ${isActive ? "text-blue-500" : ""}`} />
                    <span className="capitalize truncate">{key}</span>
                  </button>
                );
              })}
        </nav>
      </div>
    </aside>
  );
}
