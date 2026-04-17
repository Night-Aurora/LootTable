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
  FileText
} from 'lucide-react';

// --- 类型定义 ---
interface LootItem {
  id: string;
  weight: number;
  variant: string;
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

// 物品 ID 到 LootItem 引用列表的映射表类型
type ItemRegistry = { [itemId: string]: LootItem[] };

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
        let variant = 'None';
        const nbtFunc = entry.functions?.find((f: any) => 
          ['minecraft:set_nbt', 'minecraft:set_custom_data', 'minecraft:set_components'].includes(f.function)
        );
        if (nbtFunc) {
          variant = nbtFunc.tag || JSON.stringify(nbtFunc.data || nbtFunc.components) || 'Custom Data';
        }
        const prob = ((entry.weight || 1) / totalWeight * rolls * 100).toFixed(1) + '%';
        
        // 创建对象
        const newItem: LootItem = { id: entry.name, weight: entry.weight || 1, variant, container: path, probability: prob };
        items.push(newItem);

        // 存入全局映射表（存储引用以节省内存）
        if (!registry[newItem.id]) {
          registry[newItem.id] = [];
        }
        registry[newItem.id].push(newItem);
      }
    });
  });
  return items;
};

/**
 * 核心匹配逻辑：合并同类结构
 * 去掉末尾的数字及其可选的前缀下划线
 */
const normalizeName = (name: string): string => {
  return name.replace(/_?\d+$/, '');
};

const App: React.FC = () => {
  const [rootData, setRootData] = useState<{ [key: string]: DataNode } | null>(null);
  const [itemRegistry, setItemRegistry] = useState<ItemRegistry>({});
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  
  // 核心：存储每一层路径对应的搜索关键词
  // key: 路径字符串 join('/')，value: 搜索词
  const [pathSearchQueries, setPathSearchQueries] = useState<{ [path: string]: string }>({});
  
  const [error, setError] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // 获取当前层的搜索词
  const currentLevelKey = currentPath.join('/');
  const searchQuery = pathSearchQueries[currentLevelKey] || '';

  // 处理点击外部关闭搜索下拉框
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
    const newRegistry: ItemRegistry = {}; // 本次解析的临时映射表

    try {
      const processSingleFile = async (name: string, content: string) => {
        if (!name.endsWith('.json')) return;
        try {
          const json = JSON.parse(content);
          const normalizedPath = name.replace(/\\/g, '/');
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
      setItemRegistry(newRegistry); // 解析完毕后保存映射表
      setCurrentPath([]);
      setPathSearchQueries({}); // 重置所有搜索
    } catch (err: any) { setError(err.message); } finally { setIsParsing(false); }
  };

  // 获取当前显示数据
  const currentViewData = useMemo(() => {
    if (!rootData) return [];
    let currentLevel = rootData;
    for (const p of currentPath) {
      const node = currentLevel[p];
      if (node && node.type === 'folder' && node.children) {
        currentLevel = node.children;
      } else if (node && node.type === 'file') {
        return node.items || [];
      }
    }
    return Object.values(currentLevel);
  }, [rootData, currentPath]);

  // 计算过滤后的数据（主视图）
  const filteredDisplayData = useMemo(() => {
    const isFile = currentViewData.length > 0 && 'id' in currentViewData[0];
    if (isFile) {
      return (currentViewData as LootItem[])
        .filter(item => item.id.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => a.id.localeCompare(b.id));
    }
    return (currentViewData as DataNode[])
      .filter(node => node.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentViewData, searchQuery]);

  // 搜索建议匹配项
  const searchSuggestions = useMemo(() => {
    if (!searchQuery) return [];
    return filteredDisplayData.slice(0, 20); // 内部匹配最多拿20条供滚动
  }, [filteredDisplayData, searchQuery]);

  const navigateTo = (path: string[]) => {
    setCurrentPath(path);
    setShowSearchDropdown(false);
  };

  const handleBack = () => {
    if (currentPath.length === 0) return;
    const currentKey = currentPath.join('/');
    
    // 2. 返回时，清除当前层搜索框内容
    setPathSearchQueries(prev => {
      const next = { ...prev };
      delete next[currentKey];
      return next;
    });
    
    setCurrentPath(prev => prev.slice(0, -1));
  };

  const handleSearchChange = (val: string) => {
    setPathSearchQueries(prev => ({
      ...prev,
      [currentLevelKey]: val
    }));
    setShowSearchDropdown(val.length > 0);
  };

  const sortedSidebarKeys = useMemo(() => {
    if (!rootData) return [];
    return Object.keys(rootData).sort((a, b) => a.localeCompare(b));
  }, [rootData]);

  const isViewingItems = useMemo(() => {
    if (!rootData || currentPath.length === 0) return false;
    let node = rootData[currentPath[0]];
    for (let i = 1; i < currentPath.length; i++) {
      if (node && node.children) node = node.children[currentPath[i]];
    }
    return node?.type === 'file';
  }, [rootData, currentPath]);

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
              {rootData && sortedSidebarKeys.map(key => (
                <button
                  key={key}
                  onClick={() => { 
                    // 3. 当用户点击标签栏时，清除所有记录的搜索框内容
                    setPathSearchQueries({});
                    setCurrentPath([key]); 
                  }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-[22px] text-xs transition-all duration-300 ${currentPath[0] === key ? 'bg-white shadow-xl shadow-slate-200/50 border border-slate-50 text-slate-900 font-bold scale-[1.03]' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Box className={`h-4 w-4 ${currentPath[0] === key ? 'text-blue-500' : ''}`} />
                  <span className="capitalize truncate">{key}</span>
                </button>
              ))}
              {!rootData && <div className="px-5 py-8 border-2 border-dashed border-slate-100 rounded-[24px] text-[10px] text-slate-300 italic">等待数据...</div>}
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
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest shrink-0">Root</span>
              {currentPath.map((p, i) => (
                <React.Fragment key={i}>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-200 shrink-0" />
                  <span className="text-[11px] font-black text-slate-700 truncate">{p}</span>
                </React.Fragment>
              ))}
            </div>

            <div className="relative" ref={searchRef}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <input 
                type="text"
                disabled={!rootData}
                placeholder="搜索内容..."
                value={searchQuery}
                onFocus={() => searchQuery.length > 0 && setShowSearchDropdown(true)}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-52 h-12 bg-slate-50 border-none rounded-[20px] pl-12 pr-6 text-[11px] font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all"
              />
              
              {/* 4. 搜索框匹配结果下拉框 */}
              {showSearchDropdown && searchSuggestions.length > 0 && (
                <div className="absolute top-14 right-[-20px] w-46 bg-white rounded-[24px] shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-[220px] overflow-y-auto custom-scrollbar py-2">
                    {searchSuggestions.map((item: any, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          if (!isViewingItems) {
                            navigateTo([...currentPath, item.name]);
                          } else {
                            setShowSearchDropdown(false);
                          }
                        }}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-none"
                      >
                        {isViewingItems ? <Package className="h-3 w-3 text-blue-400" /> : (item.type === 'folder' ? <FolderOpen className="h-3 w-3 text-slate-300" /> : <FileText className="h-3 w-3 text-blue-300" />)}
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold text-slate-700 truncate">
                            {isViewingItems ? item.id.replace('minecraft:', '') : item.name}
                          </span>
                          {isViewingItems && <span className="text-[8px] text-slate-400">几率: {item.probability}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-50 text-[8px] font-bold text-slate-300 uppercase tracking-widest text-center">
                    匹配到 {filteredDisplayData.length} 项
                  </div>
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#ffffff]">
            {!rootData ? (
              <div className="h-full w-full flex flex-col items-center justify-center p-12">
                <div className="w-full max-w-2xl aspect-[1.6/1] border-[3px] border-dashed border-slate-100 rounded-[60px] flex flex-col items-center justify-center relative bg-slate-50/20 group hover:bg-slate-50/50 transition-all duration-700 shadow-inner">
                  <input type="file" id="dir-up" className="hidden" multiple {...({ webkitdirectory: "" } as any)} onChange={handleFileChange} />
                  <input type="file" id="zip-up" className="hidden" accept=".zip" onChange={handleFileChange} />
                  <div className="flex gap-12 mb-12">
                    <label htmlFor="dir-up" className="flex flex-col items-center gap-5 cursor-pointer hover:scale-105 transition-transform">
                      <div className="h-28 w-28 bg-white shadow-2xl rounded-[40px] flex items-center justify-center border border-slate-50"><FolderOpen className="h-10 w-10 text-blue-500" /></div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">上传文件夹</span>
                    </label>
                    <label htmlFor="zip-up" className="flex flex-col items-center gap-5 cursor-pointer hover:scale-105 transition-transform">
                      <div className="h-28 w-28 bg-white shadow-2xl rounded-[40px] flex items-center justify-center border border-slate-50"><FileArchive className="h-10 w-10 text-purple-500" /></div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">上传压缩包</span>
                    </label>
                  </div>
                  <h2 className="text-3xl font-black text-slate-800">请上传战利品数据</h2>
                  {isParsing && <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center rounded-[60px] z-20 backdrop-blur-2xl">
                    <div className="w-80 h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-800 animate-[progress_1.6s_infinite_ease-in-out] rounded-full"></div></div>
                  </div>}
                </div>
                {error && <div className="mt-8 text-red-500 bg-red-50 px-8 py-4 rounded-[28px] text-[11px] font-black border border-red-100 uppercase tracking-widest">{error}</div>}
              </div>
            ) : currentPath.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-200">
                <LayoutGrid className="h-28 w-28 opacity-5" />
                <p className="text-[12px] font-black tracking-[0.6em] uppercase mt-10">请从左侧选择一个类别</p>
              </div>
            ) : (
              <div className={`p-10 grid gap-6 ${!isViewingItems ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                {filteredDisplayData.map((node: any, idx) => (
                  <div 
                    key={idx}
                    onClick={() => !isViewingItems && navigateTo([...currentPath, node.name])}
                    className={`group relative p-6 bg-white border border-slate-100 rounded-[30px] shadow-sm transition-all duration-500 flex flex-col ${!isViewingItems ? 'hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 cursor-pointer' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className={`p-3 rounded-[18px] ${isViewingItems ? 'bg-blue-50' : 'bg-slate-50'}`}>
                        {!isViewingItems ? (
                          node.type === 'folder' ? <FolderOpen className="h-5 w-5 text-slate-400" /> : <FileText className="h-5 w-5 text-blue-400" />
                        ) : (
                          <Package className="h-5 w-5 text-blue-500" />
                        )}
                      </div>

                      {isViewingItems && (
                        <div className="text-[9px] font-black px-3 py-1.5 bg-green-50 text-green-600 rounded-full border border-green-100/50 shadow-sm">
                          {node.probability}
                        </div>
                      )}
                    </div>

                    <h3 className="text-[13px] font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors break-words overflow-wrap-anywhere whitespace-normal leading-tight">
                      {isViewingItems ? node.id.replace('minecraft:', '') : node.name}
                    </h3>

                    <div className="mt-auto">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed break-words whitespace-normal">
                        {!isViewingItems ? (
                          node.type === 'folder' ? `${Object.keys(node.children || {}).length} 个子层级` : `${node.items?.length || 0} 种掉落项`
                        ) : (
                          `NBT: ${node.variant || "None"}`
                        )}
                      </p>
                    </div>

                    {isViewingItems && (
                      <div className="mt-6 pt-5 border-t border-slate-50 flex flex-col gap-2 overflow-hidden">
                         <div className="flex items-center gap-2">
                           <Info className="h-3 w-3 text-slate-200 shrink-0" />
                           <span className="text-[8px] text-slate-400 font-mono tracking-tighter truncate italic text-right">
                             来自: {node.container?.split(/[\\/]/).pop()}
                           </span>
                         </div>
                      </div>
                    )}

                    {!isViewingItems && (
                      <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <ChevronRight className="h-4 w-4 text-blue-300" />
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
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 10px; }
        .overflow-wrap-anywhere { overflow-wrap: anywhere; }
      `}</style>
    </div>
  );
};

export default App;