import React, { useState, useMemo, type ChangeEvent, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Search,
  FolderOpen,
  Box,
  Database,
  ChevronRight,
  Info,
  Package,
  FileArchive,
  LayoutGrid,
  FileText,
  Sparkles
} from 'lucide-react';

// --- 类型定义 ---
interface LootItem {
  id: string;
  weight: number;
  nbt: string;
  count: string;
  container: string;
  probability: string;
}

interface DataNode {
  name: string;
  originalNames?: string[];
  type: 'folder' | 'file';
  children?: { [key: string]: DataNode };
  items?: LootItem[];
}

type ItemRegistry = { [itemId: string]: LootItem[] };
type IconRegistry = { [itemId: string]: string }

// --- 自定义 Hook: 键盘导航 ---
function useKeyboardNavigation<T>(
  items: T[],
  onSelect: (item: T) => void,
  isOpen: boolean
) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [items, isOpen]);

  useEffect(() => {
    if (selectedIndex >= 0 && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const selectedElement = container.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;
        const elementTop = selectedElement.offsetTop;
        const elementBottom = elementTop + selectedElement.clientHeight;

        if (elementTop < containerTop) {
          container.scrollTop = elementTop;
        } else if (elementBottom > containerBottom) {
          container.scrollTop = elementBottom - container.clientHeight;
        }
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || items.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          onSelect(items[selectedIndex]);
        }
        break;
    }
  };

  return { selectedIndex, handleKeyDown, scrollContainerRef, setSelectedIndex };
}

// --- 工具函数 ---
const loadJSZip = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).JSZip) {
      resolve((window as any).JSZip);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve((window as any).JSZip);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const parseLootTable = (json: any, path: string, registry: ItemRegistry): LootItem[] => {
  const items: LootItem[] = [];
  if (!json || !json.pools || !Array.isArray(json.pools)) return items;

  json.pools.forEach((pool: any) => {
    const totalWeight = pool.entries?.reduce((sum: number, entry: any) => sum + (entry.weight || 1), 0) || 1;
    const rolls = typeof pool.rolls === 'number' ? pool.rolls : (pool.rolls?.min || 1);

    pool.entries?.forEach((entry: any) => {
      if (entry.type === 'minecraft:item' || entry.type === 'item') {
        // 解析变体
        let nbt = 'None';
        const nbtFunc = entry.functions?.find((f: any) =>
          ['minecraft:set_nbt', 'minecraft:set_custom_data', 'minecraft:set_components'].includes(f.function)
        );
        if (nbtFunc) {
          nbt = nbtFunc.tag || JSON.stringify(nbtFunc.data || nbtFunc.components) || 'Custom Data';
        }

        // 解析数量 (Count)
        let count = '1';
        const countFunc = entry.functions?.find((f: any) => f.function === 'minecraft:set_count');
        if (countFunc) {
          if (typeof countFunc.count === 'number') {
            count = countFunc.count.toString();
          } else if (countFunc.count?.min !== undefined) {
            count = `${countFunc.count.min}-${countFunc.count.max}`;
          }
        }

        const prob = ((entry.weight || 1) / totalWeight * rolls * 100).toFixed(1) + '%';

        const newItem: LootItem = {
          id: entry.name || 'unknown',
          weight: entry.weight || 1,
          nbt,
          count, // 赋值数量
          container: path,
          probability: prob
        };
        items.push(newItem);

        if (newItem.id !== 'unknown') {
          if (!registry[newItem.id]) {
            registry[newItem.id] = [];
          }
          registry[newItem.id].push(newItem);
        }
      }
    });
  });
  return items;
};

const normalizeName = (name: string): string => {
  return (name || '').replace(/_?\d+$/, '');
};

const displayIcon = (isListView: boolean, isFolder: boolean, id: string, [iconRegistry, setIconRegistry]: [IconRegistry, React.Dispatch<React.SetStateAction<IconRegistry>>]): any => {
  if (isListView) {
    const iconPath = iconRegistry[id];
    if (!iconPath) {
      const path = `/assets/textures/` + id.replace(':', '/') + `.png`;
      const itemId = id;
      const cacheKey = `icon_${id}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        if (cached === 'NULL') {
          setIconRegistry(prev => ({ ...prev, [itemId]: 'NULL' }));
        } else {
          setIconRegistry(prev => ({ ...prev, [itemId]: cached }));
        }
      } else {
        fetch(path)
          .then(res => {
            if (!res.ok) throw new Error('Not found');
            const contentType = res.headers.get('Content-Type') || '';
            if (!contentType.startsWith('image/')) throw new Error('Not an image');
            return res.blob();
          })
          .then(blob => {
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          })
          .then(dataUrl => {
            sessionStorage.setItem(cacheKey, dataUrl);
            setIconRegistry(prev => ({ ...prev, [itemId]: dataUrl }));
          })
          .catch(() => {
            sessionStorage.setItem(cacheKey, 'NULL');
            setIconRegistry(prev => ({ ...prev, [itemId]: 'NULL' }));
          });
      }
    } else if (iconPath !== 'NULL') {
      return <img src={iconPath} alt="" className="h-5 w-5" />;
    } else {
      return <Package className="h-5 w-5 text-blue-500" />;
    }
  } else if (isFolder) {
    return <FolderOpen className="h-5 w-5 text-slate-400" />
  } else {
    return <FileText className="h-5 w-5 text-blue-400" />
  }
}

const App: React.FC = () => {
  const [rootData, setRootData] = useState<{ [key: string]: DataNode } | null>(null);
  const [itemRegistry, setItemRegistry] = useState<ItemRegistry>({});
  const [iconRegistry, setIconRegistry] = useState<IconRegistry>({});
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [pathSearchQueries, setPathSearchQueries] = useState<{ [path: string]: string }>({});
  const [, setError] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const currentLevelKey = currentPath.join('/') || 'root';
  const searchQuery = pathSearchQueries[currentLevelKey] || '';
  const isInputGlobalSearch = searchQuery.startsWith('#');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsParsing(true);
    setError(null);
    const tree: { [key: string]: DataNode } = {};
    const newRegistry: ItemRegistry = {};
    const newIconRegistry: IconRegistry = {};

    try {
      const processSingleFile = async (name: string, content: string) => {
        if (!name.endsWith('.json')) return;
        try {
          const json = JSON.parse(content);
          const normalizedPath = (name || '').replace(/\\/g, '/');
          const parts = normalizedPath.split('/');
          const lootIndex = parts.indexOf('loot_tables');

          const relevantParts = lootIndex !== -1 ? parts.slice(lootIndex + 1) : parts;
          if (relevantParts.length === 0) return;

          let currentNode = tree;
          for (let i = 0; i < relevantParts.length; i++) {
            const part = relevantParts[i];
            const isFile = part.endsWith('.json');
            const cleanName = isFile ? part.replace('.json', '') : part;
            const nodeKey = isFile ? cleanName : (i < 2 ? normalizeName(cleanName) : cleanName);

            if (!currentNode[nodeKey]) {
              currentNode[nodeKey] = {
                name: nodeKey,
                originalNames: isFile ? [] : [cleanName],
                type: isFile ? 'file' : 'folder',
                children: isFile ? undefined : {},
                items: isFile ? [] : undefined
              };
            } else if (!isFile && !currentNode[nodeKey].originalNames?.includes(cleanName)) {
              currentNode[nodeKey].originalNames?.push(cleanName);
            }

            if (isFile) {
              const newItems = parseLootTable(json, name, newRegistry);
              currentNode[nodeKey].items = [...(currentNode[nodeKey].items || []), ...newItems];
            } else {
              currentNode = currentNode[nodeKey].children!;
            }
          }
        } catch (e) { console.warn("Parse Error:", e); }
      };

      const firstFile = files[0];
      if (firstFile.name.toLowerCase().endsWith('.zip')) {
        const JSZipLib = await loadJSZip();
        const zip = new JSZipLib();
        const loadedZip = await zip.loadAsync(firstFile);
        const promises: Promise<void>[] = [];
        loadedZip.forEach((path: string, file: any) => {
          if (!file.dir) promises.push(file.async('string').then((c: string) => processSingleFile(path, c)));
        });
        await Promise.all(promises);
      } else {
        await Promise.all(Array.from(files).map(async (f) => processSingleFile((f as any).webkitRelativePath || f.name, await f.text())));
      }

      if (Object.keys(tree).length === 0) throw new Error("未识别到有效的战利品表数据。");

      setRootData(tree);
      setItemRegistry(newRegistry);
      setIconRegistry(newIconRegistry);
      setCurrentPath([]);
      setPathSearchQueries({});
    } catch (err: any) { setError(err.message); } finally { setIsParsing(false); }
  };

  const currentViewData = useMemo(() => {
    if (!rootData) return [];
    const lastPart = currentPath[currentPath.length - 1];
    if (lastPart?.startsWith('#')) {
      const itemId = lastPart.slice(1);
      const allOccurrences = itemRegistry[itemId] || [];
      if (currentPath.length > 1) {
        const limitPath = currentPath.slice(0, -1).join('/');
        return allOccurrences.filter(occ =>
          occ.container.replace(/\\/g, '/').includes(limitPath)
        );
      }
      return allOccurrences;
    }

    let currentLevel = rootData;
    for (const p of currentPath) {
      const node = currentLevel[p];
      if (node && node.type === 'folder' && node.children) {
        currentLevel = node.children;
      } else if (node && node.type === 'file') {
        return node.items || [];
      } else {
        return [];
      }
    }
    return Object.values(currentLevel);
  }, [rootData, currentPath, itemRegistry]);

  const isListView = useMemo(() => {
    const lastPart = currentPath[currentPath.length - 1];
    if (lastPart?.startsWith('#')) return true;
    if (!rootData || currentPath.length === 0) return false;
    let node: DataNode | undefined = rootData[currentPath[0]];
    for (let i = 1; i < currentPath.length; i++) {
      if (node && node.children) node = node.children[currentPath[i]];
    }
    return node?.type === 'file';
  }, [rootData, currentPath]);

  const filteredDisplayData = useMemo(() => {
    const lastPart = currentPath[currentPath.length - 1];
    if (lastPart?.startsWith('#')) return currentViewData;

    const isFileContent = currentViewData.length > 0 && 'id' in (currentViewData[0] as any);
    const term = (isInputGlobalSearch ? "" : searchQuery).toLowerCase();

    if (isFileContent) {
      return (currentViewData as LootItem[])
        .filter(item => (item.id || '').toLowerCase().includes(term))
        .sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    }
    return (currentViewData as DataNode[])
      .filter(node => (node.name || '').toLowerCase().includes(term))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [currentViewData, searchQuery, isInputGlobalSearch, currentPath]);

  const globalSearchSuggestions = useMemo(() => {
    if (!isInputGlobalSearch || !searchQuery.slice(1)) return [];
    const term = searchQuery.slice(1).toLowerCase();
    const currentDirPath = currentPath.join('/');

    return Object.keys(itemRegistry)
      .filter(id => {
        if (!id || !id.toLowerCase().includes(term)) return false;
        if (currentPath.length === 0) return true;
        return itemRegistry[id].some(occurrence =>
          occurrence.container.replace(/\\/g, '/').includes(currentDirPath)
        );
      })
      .sort()
      .slice(0, 50);
  }, [itemRegistry, searchQuery, isInputGlobalSearch, currentPath]);

  const searchSuggestions = useMemo(() => {
    if (!searchQuery) return [];
    if (isInputGlobalSearch) return globalSearchSuggestions;
    return filteredDisplayData.slice(0, 20);
  }, [filteredDisplayData, searchQuery, isInputGlobalSearch, globalSearchSuggestions]);

  const navigateTo = (path: string[]) => {
    setCurrentPath(path);
    setShowSearchDropdown(false);
    setPathSearchQueries(prev => ({ ...prev, [currentLevelKey]: '' }));
  };

  const handleSelectItem = (item: any) => {
    if (isInputGlobalSearch) {
      navigateTo([...currentPath, `#${item}`]);
    } else if (!isListView) {
      navigateTo([...currentPath, item.name]);
    } else {
      setShowSearchDropdown(false);
    }
  };

  const {
    selectedIndex,
    handleKeyDown,
    scrollContainerRef,
    setSelectedIndex
  } = useKeyboardNavigation(searchSuggestions, handleSelectItem, showSearchDropdown);

  const handleBack = () => {
    if (currentPath.length === 0) return;
    const currentKey = currentPath.join('/');
    setPathSearchQueries(prev => {
      const next = { ...prev };
      delete next[currentKey];
      return next;
    });
    setCurrentPath(prev => prev.slice(0, -1));
  };

  const handleSearchChange = (val: string) => {
    setPathSearchQueries(prev => ({ ...prev, [currentLevelKey]: val }));
    setShowSearchDropdown(val.length > 0);
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] flex items-center justify-center p-4 md:p-10 font-sans text-slate-900 overflow-hidden">
      <div className="w-full max-w-7xl h-full bg-white rounded-[40px] border border-slate-200 shadow-2xl flex overflow-hidden">

        <aside className="w-72 border-r border-slate-100 bg-[#fbfcfd] flex flex-col shrink-0">
          <div className="p-10">
            <div className="flex items-center gap-4 mb-14">
              <div className="h-11 w-11 bg-slate-900 rounded-[18px] flex items-center justify-center shadow-xl rotate-2">
                <Database className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-black text-[13px] tracking-[0.2em] text-slate-800 uppercase">MC Loot</h1>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Analyzer</p>
              </div>
            </div>
            <nav className="space-y-2">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-6 px-3">Root Categories</p>
              {rootData && Object.keys(rootData).sort().map(key => (
                <button
                  key={key}
                  onClick={() => { setPathSearchQueries({}); setCurrentPath([key]); }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-[22px] text-xs transition-all duration-300 ${currentPath.length === 1 && currentPath[0] === key ? 'bg-white shadow-xl shadow-slate-200/50 border border-slate-50 text-slate-900 font-bold scale-[1.03]' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Box className={`h-4 w-4 ${currentPath.length === 1 && currentPath[0] === key ? 'text-blue-500' : ''}`} />
                  <span className="capitalize truncate">{key}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-24 border-b border-slate-50 flex items-center px-10 gap-8 bg-white/60 backdrop-blur-xl sticky top-0 z-10">
            <button
              onClick={handleBack}
              className={`h-12 w-12 flex items-center justify-center rounded-[20px] border border-slate-100 transition-all ${currentPath.length > 0 ? 'hover:bg-white hover:shadow-lg' : 'opacity-0 pointer-events-none'}`}
            >
              <ChevronLeft className="h-6 w-6 text-slate-600" />
            </button>
            <div className="flex-1 flex items-center gap-3 bg-slate-50/50 rounded-[22px] px-6 py-3.5 border border-slate-100/50 overflow-hidden">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest shrink-0 cursor-pointer hover:text-blue-500" onClick={() => setCurrentPath([])}>Root</span>
              {currentPath.map((p, i) => (
                <React.Fragment key={i}>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-200 shrink-0" />
                  <span className="text-[11px] font-black text-slate-700 truncate">
                    {p}
                  </span>
                </React.Fragment>
              ))}
            </div>
            <div className="relative" ref={searchRef}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <input
                type="text"
                disabled={!rootData}
                placeholder={"请输入内容"}
                value={searchQuery}
                onKeyDown={handleKeyDown}
                onFocus={() => searchQuery.length > 0 && setShowSearchDropdown(true)}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-56 h-12 bg-slate-50 border-none rounded-[20px] pl-12 pr-6 text-[11px] font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all"
              />
              {showSearchDropdown && searchSuggestions.length > 0 && (
                <div className="absolute top-14 right-[-20px] w-64 bg-white rounded-[24px] shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div
                    ref={scrollContainerRef}
                    className="max-h-[280px] overflow-y-auto custom-scrollbar py-2"
                  >
                    {searchSuggestions.map((item: any, idx) => (
                      <div
                        key={idx}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => handleSelectItem(item)}
                        className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors border-b border-slate-50 last:border-none ${selectedIndex === idx ? 'bg-blue-50/80' : 'hover:bg-slate-50'}`}
                      >
                        {isInputGlobalSearch ? <Sparkles className="h-3 w-3 text-purple-400" /> : (isListView ? <Package className="h-3 w-3 text-blue-400" /> : (item.type === 'folder' ? <FolderOpen className="h-3 w-3 text-slate-300" /> : <FileText className="h-3 w-3 text-blue-300" />))}
                        <div className="flex flex-col min-w-0">
                          <span className={`text-[10px] font-bold break-all ${selectedIndex === idx ? 'text-blue-700' : 'text-slate-700'}`}>
                            {isInputGlobalSearch ? (item || '') : (isListView ? (item.id || '') : (item.name || ''))}
                          </span>
                          {isInputGlobalSearch && <span className={`text-[8px] ${selectedIndex === idx ? 'text-blue-400' : 'text-slate-400'}`}>匹配数: {
                            currentPath.length === 0
                              ? itemRegistry[item]?.length
                              : itemRegistry[item]?.filter(o => o.container.replace(/\\/g, '/').includes(currentPath.join('/'))).length
                          }</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#ffffff]">
            {isParsing && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4">
                <div className="h-1 w-48 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-900 animate-[progress_1.5s_infinite_linear]" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">正在分析...</p>
              </div>
            )}

            {!rootData ? (
              <div className="h-full w-full flex flex-col items-center justify-center p-12">
                <div className="w-full max-w-2xl aspect-[1.6/1] border-[3px] border-dashed border-slate-100 rounded-[60px] flex flex-col items-center justify-center relative bg-slate-50/20 group hover:bg-slate-50/50 transition-all duration-700 shadow-inner">
                  <input type="file" id="dir-up" className="hidden" multiple {...({ webkitdirectory: "" } as any)} onChange={handleFileChange} />
                  <input type="file" id="zip-up" className="hidden" accept=".zip" onChange={handleFileChange} />
                  <div className="flex gap-12 mb-12">
                    <label htmlFor="dir-up" className="flex flex-col items-center gap-5 cursor-pointer hover:scale-105 transition-transform"><div className="h-28 w-28 bg-white shadow-2xl rounded-[40px] flex items-center justify-center border border-slate-50"><FolderOpen className="h-10 w-10 text-blue-500" /></div><span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">文件夹</span></label>
                    <label htmlFor="zip-up" className="flex flex-col items-center gap-5 cursor-pointer hover:scale-105 transition-transform"><div className="h-28 w-28 bg-white shadow-2xl rounded-[40px] flex items-center justify-center border border-slate-50"><FileArchive className="h-10 w-10 text-purple-500" /></div><span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">压缩包</span></label>
                  </div>
                  <h2 className="text-3xl font-black text-slate-800">上传战利品数据</h2>
                  <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">支持 ZIP 压缩包或整个数据包文件夹</p>
                </div>
              </div>
            ) : currentPath.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-200">
                <LayoutGrid className="h-28 w-28 opacity-5" />
                <p className="text-[12px] font-black tracking-[0.6em] uppercase mt-10">选择类别或使用 # 搜索</p>
              </div>
            ) : (
              <div className={`p-10 grid gap-6 ${!isListView ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                {filteredDisplayData.map((node: any, idx) => (
                  <div
                    key={idx}
                    onClick={() => !isListView && navigateTo([...currentPath, node.name])}
                    className={`group relative p-6 bg-white border border-slate-100 rounded-[30px] shadow-sm transition-all duration-500 flex flex-col ${!isListView ? 'hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 cursor-pointer' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className={`p-3 rounded-[18px] ${isListView ? 'bg-blue-50' : 'bg-slate-50'}`}>
                        {
                          displayIcon(isListView, node.type === 'folder', isListView ? node.id : node.name, [iconRegistry, setIconRegistry])
                        }
                      </div>
                      {isListView && (
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="text-[9px] font-black px-3 py-1.5 bg-green-50 text-green-600 rounded-full border border-green-100/50 shadow-sm">
                            {node.probability}
                          </div>
                          <div className="text-[9px] font-black px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100/50 shadow-sm">
                            数量: {node.count}
                          </div>
                        </div>
                      )}
                    </div>
                    <h3 className="text-[13px] font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors break-words overflow-wrap-anywhere leading-tight">
                      {isListView ? (node.id || '').replace('minecraft:', '') : node.name}
                    </h3>
                    <div className="mt-auto text-[9px] text-slate-400 font-bold uppercase tracking-widest break-all leading-relaxed">
                      {isListView ? `NBT: ${node.nbt || "None"}` : (node.type === 'folder' ? `${Object.keys(node.children || {}).length} 子项` : `${node.items?.length || 0} 掉落项`)}
                    </div>
                    {isListView && (
                      <div className="mt-6 pt-5 border-t border-slate-50 flex flex-col gap-2 overflow-hidden">
                        <div className="flex items-start gap-2">
                          <Info className="h-3 w-3 text-slate-200 shrink-0" />
                          <span className="text-[10px] text-slate-400 font-mono italic break-all">
                            {(node.container || '').split(/[\\/]/).slice(currentPath.length).join('/')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
      <style>{`
        @keyframes progress { 0% { width: 0; transform: translateX(-20%); } 50% { width: 50%; } 100% { width: 0; transform: translateX(280%); } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 10px; }
        .overflow-wrap-anywhere { overflow-wrap: anywhere; }
      `}</style>
    </div>
  );
};

export default App;