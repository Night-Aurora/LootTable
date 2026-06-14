export interface LootItem {
  id: string;
  translatedName? : string
  weight: number;
  nbt: string;
  count: string;
  container: string;
  probability: string;
}

export interface DataNode {
  name: string;
  originalNames?: string[];
  type: "folder" | "file";
  children?: Record<string, DataNode>;
  items?: LootItem[];
}

export type GitModMeta = {
  repository: string;
  prefix: string | "";
  translation? : string;
  icons: Record<string, string[]>;
};

export type DataTree = Record<string, DataNode>;
export type ItemRegistry = Record<string, LootItem[]>;
export type IconRegistry = Record<string, boolean>;
