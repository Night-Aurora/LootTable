import { Info } from "lucide-react";
import { ItemIcon } from "./ItemIcon";
import type { DataNode, IconRegistry, LootItem } from "../types/loot";

interface DisplayCardProps {
  node: DataNode | LootItem;
  isListView: boolean;
  currentPath: string[];
  iconRegistry: IconRegistry;
  setIconRegistry: React.Dispatch<React.SetStateAction<IconRegistry>>;
  onOpenNode: (name: string) => void;
}

export function DisplayCard({
  node,
  isListView,
  currentPath,
  iconRegistry,
  setIconRegistry,
  onOpenNode,
}: DisplayCardProps) {
  const dataNode = node as DataNode;
  const lootItem = node as LootItem;

  return (
    <div
      onClick={() => !isListView && onOpenNode(dataNode.name)}
      className={`group relative p-6 bg-white border border-slate-100 rounded-[30px] shadow-sm transition-all duration-500 flex flex-col ${
        !isListView
          ? "hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
          : ""
      }`}
    >
      <div className="flex items-start justify-between mb-6">
        <div className={`p-3 rounded-[18px] ${isListView ? "bg-blue-50" : "bg-slate-50"}`}>
          <ItemIcon
            isListView={isListView}
            isFolder={dataNode.type === "folder"}
            id={isListView ? lootItem.id : dataNode.name}
            iconRegistry={iconRegistry}
            setIconRegistry={setIconRegistry}
          />
        </div>

        {isListView && (
          <div className="flex items-start justify-between gap-1.5">
            <div className="text-[9px] font-black px-3 py-1.5 bg-green-50 text-green-600 rounded-full border border-green-100/50 shadow-sm">
              {lootItem.probability}
            </div>
            <div className="text-[9px] font-black px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100/50 shadow-sm">
              数量: {lootItem.count}
            </div>
          </div>
        )}
      </div>

      <h3 className="text-[13px] font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors break-words overflow-wrap-anywhere leading-tight">
        {isListView ? (lootItem.id || "").replace("minecraft:", "") : dataNode.name}
      </h3>

      <div className="mt-auto text-[9px] text-slate-400 font-bold uppercase tracking-widest break-all leading-relaxed">
        {isListView
          ? `NBT: ${lootItem.nbt || "None"}`
          : dataNode.type === "folder"
            ? `${Object.keys(dataNode.children || {}).length} 子项`
            : `${dataNode.items?.length || 0} 掉落项`}
      </div>

      {isListView && (
        <div className="mt-6 pt-5 border-t border-slate-50 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-start gap-2">
            <Info className="h-3 w-3 text-slate-200 shrink-0" />
            <span className="text-[10px] text-slate-400 font-mono italic break-all">
              {(lootItem.container || "").split(/[\\/]/).slice(currentPath.length).join("/")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
