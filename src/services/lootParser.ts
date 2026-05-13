import type { DataTree, ItemRegistry, LootItem } from "../types/loot";

type JsonValue = Record<string, any>;

interface ParsedLootData {
  tree: DataTree;
  registry: ItemRegistry;
}

const JS_ZIP_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";

function normalizeName(name: string): string {
  return (name || "").replace(/_?\d+$/, "");
}

async function loadJSZip(): Promise<any> {
  const win = window as any;
  if (win.JSZip) {
    return win.JSZip;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = JS_ZIP_CDN;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load JSZip"));
    document.head.appendChild(script);
  });

  return win.JSZip;
}

function parseLootTable(
  json: JsonValue,
  path: string,
  registry: ItemRegistry,
): LootItem[] {
  const items: LootItem[] = [];
  if (!json || !Array.isArray(json.pools)) {
    return items;
  }

  json.pools.forEach((pool: any) => {
    const totalWeight =
      pool.entries?.reduce(
        (sum: number, entry: any) => sum + (entry.weight || 1),
        0,
      ) || 1;
    const rolls =
      typeof pool.rolls === "number" ? pool.rolls : ((pool.rolls?.min ?? 0) + (pool.rolls?.max ?? 0)) / 2 ;
    

    pool.entries?.forEach((entry: any) => {
      if (entry.type !== "minecraft:item" && entry.type !== "item") {
        return;
      }

      let nbt = "None";
      const nbtFunction = entry.functions?.find((fn: any) =>
        [
          "minecraft:set_nbt",
          "minecraft:set_custom_data",
          "minecraft:set_components",
        ].includes(fn.function),
      );

      if (nbtFunction) {
        nbt =
          nbtFunction.tag ||
          JSON.stringify(nbtFunction.data || nbtFunction.components) ||
          "Custom Data";
      }

      let count = "1";
      const countFunction = entry.functions?.find(
        (fn: any) => fn.function === "minecraft:set_count",
      );
      if (countFunction) {
        if (typeof countFunction.count === "number") {
          count = String(countFunction.count);
        } else if (countFunction.count?.min !== undefined) {
          count = `${countFunction.count.min}-${countFunction.count.max}`;
        }
      }

      const probability = `${(((entry.weight || 1) / totalWeight) * rolls * 100).toFixed(1)}%`;

      if(!probability.match("[1-9]")){
        console.log("Detected zero probability item", entry.name, path)
      }

      const newItem: LootItem = {
        id: entry.name || "unknown",
        weight: entry.weight || 1,
        nbt,
        count,
        container: path,
        probability,
      };

      items.push(newItem);

      if (newItem.id !== "unknown") {
        if (!registry[newItem.id]) {
          registry[newItem.id] = [];
        }
        registry[newItem.id].push(newItem);
      }
    });
  });

  return items;
}

export async function parseLootFiles(files: FileList): Promise<ParsedLootData> {
  const tree: DataTree = {};
  const registry: ItemRegistry = {};

  const processSingleFile = async (name: string, content: string) => {
    if (!name.endsWith(".json")) {
      return;
    }

    try {
      const json = JSON.parse(content);
      const normalizedPath = (name || "").replace(/\\/g, "/");
      const parts = normalizedPath.split("/");
      const lootIndex = parts.findIndex(para => ["loot_tables","loot_table"].includes(para));
      const relevantParts = lootIndex !== -1 ? parts.slice(lootIndex + 1) : parts;

      if (relevantParts.length === 0) {
        return;
      }

      let currentNode = tree;
      for (let i = 0; i < relevantParts.length; i += 1) {
        const part = relevantParts[i];
        const isFile = part.endsWith(".json");
        const cleanName = isFile ? part.replace(".json", "") : part;
        const nodeKey = isFile
          ? cleanName
          : i < 2
            ? normalizeName(cleanName)
            : cleanName;

        if (!currentNode[nodeKey]) {
          currentNode[nodeKey] = {
            name: nodeKey,
            originalNames: isFile ? [] : [cleanName],
            type: isFile ? "file" : "folder",
            children: isFile ? undefined : {},
            items: isFile ? [] : undefined,
          };
        } else if (
          !isFile &&
          !currentNode[nodeKey].originalNames?.includes(cleanName)
        ) {
          currentNode[nodeKey].originalNames?.push(cleanName);
        }

        if (isFile) {
          const parsedItems = parseLootTable(json, name, registry);
          currentNode[nodeKey].items = [
            ...(currentNode[nodeKey].items || []),
            ...parsedItems,
          ];
        } else {
          currentNode = currentNode[nodeKey].children!;
        }
      }
    } catch (error) {
      console.warn("Parse Error:", error);
    }
  };

  const firstFile = files[0];
  if (firstFile.name.toLowerCase().endsWith(".zip")) {
    const JSZipLib = await loadJSZip();
    const zip = new JSZipLib();
    const loadedZip = await zip.loadAsync(firstFile);
    const tasks: Promise<void>[] = [];

    loadedZip.forEach((path: string, file: any) => {
      if (!file.dir) {
        tasks.push(
          file
            .async("string")
            .then((content: string) => processSingleFile(path, content)),
        );
      }
    });

    await Promise.all(tasks);
  } else {
    await Promise.all(
      Array.from(files).map(async (file) => {
        const fileWithPath = file as File & { webkitRelativePath?: string };
        const path = fileWithPath.webkitRelativePath || file.name;
        const content = await file.text();
        await processSingleFile(path, content);
      }),
    );
  }

  if (Object.keys(tree).length === 0) {
    throw new Error("Loot parse fail");
  }

  return { tree, registry };
}

