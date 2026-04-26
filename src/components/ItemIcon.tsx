import { FileText, FolderOpen, Package } from "lucide-react";
import { useEffect } from "react";
import { isMissingIcon, loadItemIcon } from "../services/iconLoader";
import type { IconRegistry } from "../types/loot";

interface ItemIconProps {
  isListView: boolean;
  isFolder: boolean;
  id: string;
  iconRegistry: IconRegistry;
  setIconRegistry: React.Dispatch<React.SetStateAction<IconRegistry>>;
}

export function ItemIcon({
  isListView,
  isFolder,
  id,
  iconRegistry,
  setIconRegistry,
}: ItemIconProps) {
  useEffect(() => {
    if (!isListView) {
      return;
    }
    loadItemIcon(id, iconRegistry, setIconRegistry);
  }, [id, iconRegistry, isListView, setIconRegistry]);

  if (isListView) {
    const iconPath = iconRegistry[id];
    if (iconPath && !isMissingIcon(iconPath)) {
      return <img src={iconPath} alt="" className="h-5 w-5" />;
    }
    return <Package className="h-5 w-5 text-blue-500" />;
  }

  if (isFolder) {
    return <FolderOpen className="h-5 w-5 text-slate-400" />;
  }

  return <FileText className="h-5 w-5 text-blue-400" />;
}
