import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { parseLootFiles } from "../services/lootParser";
import type { DataNode, DataTree, IconRegistry, ItemRegistry, LootItem } from "../types/loot";

type SearchSuggestion = string | LootItem | DataNode;

function isDataNode(item: SearchSuggestion): item is DataNode {
  return typeof item !== "string" && "name" in item;
}

export function useLootExplorer() {
  const [rootData, setRootData] = useState<DataTree | null>(null);
  const [itemRegistry, setItemRegistry] = useState<ItemRegistry>({});
  const [iconRegistry, setIconRegistry] = useState<IconRegistry>({});
  const [isParsing, setIsParsing] = useState(false);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [pathSearchQueries, setPathSearchQueries] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const currentLevelKey = currentPath.join("/") || "root";
  const searchQuery = pathSearchQueries[currentLevelKey] || "";
  const isInputGlobalSearch = searchQuery.startsWith("#");

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      const parsed = await parseLootFiles(files);
      setRootData(parsed.tree);
      setItemRegistry(parsed.registry);
      setIconRegistry({});
      setCurrentPath([]);
      setPathSearchQueries({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setIsParsing(false);
    }
  };

  const currentViewData = useMemo(() => {
    if (!rootData) {
      return [] as Array<DataNode | LootItem>;
    }

    const lastPart = currentPath[currentPath.length - 1];
    if (lastPart?.startsWith("#")) {
      const itemId = lastPart.slice(1);
      const allOccurrences = itemRegistry[itemId] || [];

      if (currentPath.length > 1) {
        const limitPath = currentPath.slice(0, -1).join("/");
        return allOccurrences.filter((occurrence) =>
          occurrence.container.replace(/\\/g, "/").includes(limitPath),
        );
      }

      return allOccurrences;
    }

    let currentLevel = rootData;
    for (const segment of currentPath) {
      const node = currentLevel[segment];
      if (node?.type === "folder" && node.children) {
        currentLevel = node.children;
      } else if (node?.type === "file") {
        return node.items || [];
      } else {
        return [] as Array<DataNode | LootItem>;
      }
    }

    return Object.values(currentLevel);
  }, [rootData, currentPath, itemRegistry]);

  const isListView = useMemo(() => {
    const lastPart = currentPath[currentPath.length - 1];
    if (lastPart?.startsWith("#")) {
      return true;
    }

    if (!rootData || currentPath.length === 0) {
      return false;
    }

    let node: DataNode | undefined = rootData[currentPath[0]];
    for (let i = 1; i < currentPath.length; i += 1) {
      node = node?.children?.[currentPath[i]];
    }

    return node?.type === "file";
  }, [rootData, currentPath]);

  const filteredDisplayData = useMemo(() => {
    const lastPart = currentPath[currentPath.length - 1];
    if (lastPart?.startsWith("#")) {
      return currentViewData;
    }

    const isFileContent =
      currentViewData.length > 0 && "id" in (currentViewData[0] as LootItem);
    const term = (isInputGlobalSearch ? "" : searchQuery).toLowerCase();

    if (isFileContent) {
      return (currentViewData as LootItem[])
        .filter((item) => (item.id || "").toLowerCase().includes(term))
        .sort((a, b) => (a.id || "").localeCompare(b.id || ""));
    }

    return (currentViewData as DataNode[])
      .filter((node) => (node.name || "").toLowerCase().includes(term))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [currentViewData, currentPath, isInputGlobalSearch, searchQuery]);

  const globalSearchSuggestions = useMemo(() => {
    if (!isInputGlobalSearch || !searchQuery.slice(1)) {
      return [] as string[];
    }

    const term = searchQuery.slice(1).toLowerCase();
    const currentDirPath = currentPath.join("/");

    return Object.keys(itemRegistry)
      .filter((id) => {
        if (!id || !id.toLowerCase().includes(term)) {
          return false;
        }
        if (currentPath.length === 0) {
          return true;
        }

        return itemRegistry[id].some((occurrence) =>
          occurrence.container.replace(/\\/g, "/").includes(currentDirPath),
        );
      })
      .sort()
      .slice(0, 50);
  }, [itemRegistry, searchQuery, isInputGlobalSearch, currentPath]);

  const searchSuggestions = useMemo<SearchSuggestion[]>(() => {
    if (!searchQuery) {
      return [];
    }

    if (isInputGlobalSearch) {
      return globalSearchSuggestions;
    }

    return filteredDisplayData.slice(0, 20);
  }, [filteredDisplayData, searchQuery, isInputGlobalSearch, globalSearchSuggestions]);

  const navigateTo = (path: string[]) => {
    setCurrentPath(path);
    setShowSearchDropdown(false);
    setPathSearchQueries((prev) => ({ ...prev, [currentLevelKey]: "" }));
  };

  const handleSelectItem = (item: SearchSuggestion) => {
    if (isInputGlobalSearch && typeof item === "string") {
      navigateTo([...currentPath, `#${item}`]);
      return;
    }

    if (!isListView && isDataNode(item)) {
      navigateTo([...currentPath, item.name]);
      return;
    }

    setShowSearchDropdown(false);
  };

  const handleBack = () => {
    if (currentPath.length === 0) {
      return;
    }

    const currentKey = currentPath.join("/");
    setPathSearchQueries((prev) => {
      const next = { ...prev };
      delete next[currentKey];
      return next;
    });

    setCurrentPath((prev) => prev.slice(0, -1));
  };

  const handleSearchChange = (value: string) => {
    setPathSearchQueries((prev) => ({ ...prev, [currentLevelKey]: value }));
    setShowSearchDropdown(value.length > 0);
  };

  return {
    rootData,
    itemRegistry,
    iconRegistry,
    setIconRegistry,
    isParsing,
    currentPath,
    setCurrentPath,
    searchQuery,
    isInputGlobalSearch,
    showSearchDropdown,
    setShowSearchDropdown,
    error,
    isListView,
    filteredDisplayData,
    searchSuggestions,
    handleFileChange,
    handleBack,
    handleSearchChange,
    handleSelectItem,
    navigateTo,
    setPathSearchQueries,
  };
}
