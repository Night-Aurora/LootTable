import { FileArchive, FolderOpen, LayoutGrid } from "lucide-react";
import { DisplayCard } from "./DisplayCard";
import type { DataNode, IconRegistry, LootItem } from "../types/loot";

interface MainContentProps {
  rootDataReady: boolean;
  isParsing: boolean;
  currentPath: string[];
  isListView: boolean;
  filteredDisplayData: Array<DataNode | LootItem>;
  iconRegistry: IconRegistry;
  setIconRegistry: React.Dispatch<React.SetStateAction<IconRegistry>>;
  onOpenNode: (name: string) => void;
  onUploadFiles: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function MainContent({
  rootDataReady,
  isParsing,
  currentPath,
  isListView,
  filteredDisplayData,
  iconRegistry,
  setIconRegistry,
  onOpenNode,
  onUploadFiles,
}: MainContentProps) {
  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#ffffff]">
      {isParsing && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4">
          <div className="h-1 w-48 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-900 animate-[progress_1.5s_infinite_linear]" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            正在分析...
          </p>
        </div>
      )}

      {!rootDataReady ? (
        <div className="h-full w-full flex flex-col items-center justify-center p-12">
          <div className="w-full max-w-2xl aspect-[1.6/1] border-[3px] border-dashed border-slate-100 rounded-[60px] flex flex-col items-center justify-center relative bg-slate-50/20 group hover:bg-slate-50/50 transition-all duration-700 shadow-inner">
            <input
              type="file"
              id="dir-up"
              className="hidden"
              multiple
              {...({ webkitdirectory: "" } as any)}
              onChange={onUploadFiles}
            />
            <input
              type="file"
              id="zip-up"
              className="hidden"
              accept=".zip"
              onChange={onUploadFiles}
            />

            <div className="flex gap-12 mb-12">
              <label
                htmlFor="dir-up"
                className="flex flex-col items-center gap-5 cursor-pointer hover:scale-105 transition-transform"
              >
                <div className="h-28 w-28 bg-white shadow-2xl rounded-[40px] flex items-center justify-center border border-slate-50">
                  <FolderOpen className="h-10 w-10 text-blue-500" />
                </div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  文件夹
                </span>
              </label>

              <label
                htmlFor="zip-up"
                className="flex flex-col items-center gap-5 cursor-pointer hover:scale-105 transition-transform"
              >
                <div className="h-28 w-28 bg-white shadow-2xl rounded-[40px] flex items-center justify-center border border-slate-50">
                  <FileArchive className="h-10 w-10 text-purple-500" />
                </div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  压缩包
                </span>
              </label>
            </div>

            <h2 className="text-3xl font-black text-slate-800">上传战利品数据</h2>
            <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              支持 ZIP 压缩包或整个数据包文件夹
            </p>
          </div>
        </div>
      ) : currentPath.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-200">
          <LayoutGrid className="h-28 w-28 opacity-5" />
          <p className="text-[12px] font-black tracking-[0.6em] uppercase mt-10">
            选择类别或使用 # 搜索
          </p>
        </div>
      ) : (
        <div
          className={`p-10 grid gap-6 ${
            !isListView
              ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {filteredDisplayData.map((node, index) => (
            <DisplayCard
              key={index}
              node={node}
              isListView={isListView}
              currentPath={currentPath}
              iconRegistry={iconRegistry}
              setIconRegistry={setIconRegistry}
              onOpenNode={onOpenNode}
            />
          ))}
        </div>
      )}
    </main>
  );
}
