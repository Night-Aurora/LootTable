import React, { useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Package,
  Search,
  Sparkles,
} from "lucide-react";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation";
import type { DataNode, ItemRegistry, LootItem } from "../types/loot";

type SearchSuggestion = string | LootItem | DataNode;

interface TopBarProps {
  hasData: boolean;
  currentPath: string[];
  searchQuery: string;
  isInputGlobalSearch: boolean;
  isListView: boolean;
  showSearchDropdown: boolean;
  setShowSearchDropdown: (visible: boolean) => void;
  searchSuggestions: SearchSuggestion[];
  itemRegistry: ItemRegistry;
  onBack: () => void;
  onGoRoot: () => void;
  onSearchChange: (value: string) => void;
  onSelectSuggestion: (item: SearchSuggestion) => void;
}

export function TopBar({
  hasData,
  currentPath,
  searchQuery,
  isInputGlobalSearch,
  isListView,
  showSearchDropdown,
  setShowSearchDropdown,
  searchSuggestions,
  itemRegistry,
  onBack,
  onGoRoot,
  onSearchChange,
  onSelectSuggestion,
}: TopBarProps) {
  const searchRef = useRef<HTMLDivElement>(null);

  const {
    selectedIndex,
    handleKeyDown,
    scrollContainerRef,
    setSelectedIndex,
  } = useKeyboardNavigation(searchSuggestions, onSelectSuggestion, showSearchDropdown);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setShowSearchDropdown]);

  return (
    <header className="h-24 border-b border-slate-50 flex items-center px-10 gap-8 bg-white/60 backdrop-blur-xl sticky top-0 z-10">
      <button
        onClick={onBack}
        className={`h-12 w-12 flex items-center justify-center rounded-[20px] border border-slate-100 transition-all ${
          currentPath.length > 0
            ? "hover:bg-white hover:shadow-lg"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <ChevronLeft className="h-6 w-6 text-slate-600" />
      </button>

      <div className="flex-1 flex items-center gap-3 bg-slate-50/50 rounded-[22px] px-6 py-3.5 border border-slate-100/50 overflow-hidden">
        <span
          className="text-[10px] font-black text-slate-300 uppercase tracking-widest shrink-0 cursor-pointer hover:text-blue-500"
          onClick={onGoRoot}
        >
          Root
        </span>
        {currentPath.map((part, index) => (
          <React.Fragment key={`${part}-${index}`}>
            <ChevronRight className="h-3.5 w-3.5 text-slate-200 shrink-0" />
            <span className="text-[11px] font-black text-slate-700 truncate">{part}</span>
          </React.Fragment>
        ))}
      </div>

      <div className="relative" ref={searchRef}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
        <input
          type="text"
          disabled={!hasData}
          placeholder="请输入内容 (#全局搜索)"
          value={searchQuery}
          onKeyDown={handleKeyDown}
          onFocus={() => searchQuery.length > 0 && setShowSearchDropdown(true)}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-56 h-12 bg-slate-50 border-none rounded-[20px] pl-12 pr-6 text-[11px] font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all"
        />

        {showSearchDropdown && searchSuggestions.length > 0 && (
          <div className="absolute top-14 right-[-20px] w-64 bg-white rounded-[24px] shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div
              ref={scrollContainerRef}
              className="max-h-[280px] overflow-y-auto custom-scrollbar py-2"
            >
              {searchSuggestions.map((item, index) => {
                const isSelected = selectedIndex === index;
                const isGlobal = isInputGlobalSearch;
                const searchText = isGlobal
                  ? (item as string)
                  : isListView
                    ? (item as LootItem).id
                    : (item as DataNode).name;

                const matchCount = (() => {
                  if (!isGlobal || !itemRegistry[item as string]) {
                    return 0;
                  }

                  if (currentPath.length === 0) {
                    return itemRegistry[item as string].length;
                  }

                  const currentPathText = currentPath.join("/");
                  return itemRegistry[item as string].filter((occurrence) =>
                    occurrence.container
                      .replace(/\\/g, "/")
                      .includes(currentPathText),
                  ).length;
                })();

                return (
                  <div
                    key={`${searchText}-${index}`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => onSelectSuggestion(item)}
                    className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors border-b border-slate-50 last:border-none ${
                      isSelected ? "bg-blue-50/80" : "hover:bg-slate-50"
                    }`}
                  >
                    {isGlobal ? (
                      <Sparkles className="h-3 w-3 text-purple-400" />
                    ) : isListView ? (
                      <Package className="h-3 w-3 text-blue-400" />
                    ) : (item as DataNode).type === "folder" ? (
                      <FolderOpen className="h-3 w-3 text-slate-300" />
                    ) : (
                      <FileText className="h-3 w-3 text-blue-300" />
                    )}

                    <div className="flex flex-col min-w-0">
                      <span
                        className={`text-[10px] font-bold break-all ${
                          isSelected ? "text-blue-700" : "text-slate-700"
                        }`}
                      >
                        {searchText}
                      </span>
                      {isGlobal && (
                        <span
                          className={`text-[8px] ${
                            isSelected ? "text-blue-400" : "text-slate-400"
                          }`}
                        >
                          匹配数: {matchCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
