import { fetchWithTimeout, checkContentType } from "./network";
import type { LootItem, GitModMeta } from "../types/loot";

const FETCH_TIMEOUT_MS = 6000;
const MOD_META_BASE_URL = import.meta.env.BASE_URL;
const JSON_REGISTRY: Record<string, GitModMeta> = {};
const pendingJsonRequests = new Map<string, Promise<GitModMeta>>();


export async function loadTranslation(mod_id: string, items: LootItem[][]) {
  try {
    const meta = await loadPathIndex(mod_id); // 获取路径索引表
    if (!meta.translation) {
      return;
    }

    const getType = (name: string) => { // 通过路径索引获取物品类型（item | block）
      const key = Object.keys(meta.icons).find((groupKey) => {
        const names = meta.icons[groupKey];
        return Array.isArray(names) && names.includes(name);
      });
      const type = key ? (key.includes("/") ? key.slice(0, key.indexOf("/")) : key) : null;
      return type;
    }
    const loadTranslationJson = (async () => { // 加载github上的翻译json
      const response = await fetchWithTimeout(`${meta.repository}/${meta.prefix}${meta.translation}`, FETCH_TIMEOUT_MS);

      if (!response.ok) {
        throw new Error(`Translation not found: ${response.status}`);
      }
      if (!checkContentType(response, "text/plain")) {
        throw new Error(`Invalid translation json:${mod_id}`);
      }

      return await response.json() as Record<string, string>;
    });
    const translation = await loadTranslationJson();
    items.forEach(item => {
      const standard = item.at(0)!;
      const type = getType(standard.id.slice(standard.id.indexOf(":") + 1));
      if (!type) return;
      const key = `${type}.${standard.id.replace(':', '.')}`;
      item.forEach(i => i.translatedName = translation[key] || undefined);
    });
  } catch (e: any) {
    console.warn(`${mod_id}: ${e.message}`);
  }
}

export async function loadPathIndex(mod_id: string): Promise<GitModMeta> {
  // 已有缓存
  if (JSON_REGISTRY[mod_id]) {
    return JSON_REGISTRY[mod_id];
  }

  // 已有进行中的请求
  if (pendingJsonRequests.has(mod_id)) {
    return await pendingJsonRequests.get(mod_id)!;
  }

  // 发起新请求（async 函数自动返回 Promise）
  const promise = (async () => {
    const url = `${MOD_META_BASE_URL}assets/textures/${mod_id}.json`;
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(`Metadata of ${mod_id} not found: ${response.status}`);
    }
    if (!checkContentType(response, "application/json")) {
      throw new Error("Unintended Type");
    }

    const json = await response.json() as GitModMeta;

    if (!json?.repository || !json?.icons) {
      throw new Error(`Invalid metadata json of ${mod_id}`);
    }

    JSON_REGISTRY[mod_id] = json;
    return json;
  })();

  // 清理进行中的请求
  promise.then(
    () => {
      pendingJsonRequests.delete(mod_id);
    },
    () => {
      pendingJsonRequests.delete(mod_id);
    },
  )
  pendingJsonRequests.set(mod_id, promise);
  return await promise;
}
