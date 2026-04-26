export interface LootItem {
  id: string;
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

export type DataTree = Record<string, DataNode>;
export type ItemRegistry = Record<string, LootItem[]>;
export type IconRegistry = Record<string, string>;
