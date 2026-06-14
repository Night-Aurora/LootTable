import type { Dispatch, SetStateAction } from "react";
import type { IconRegistry } from "../types/loot";
import { fetchImageAsDataUrl, TimeoutError } from "../utils/network";
import { loadPathIndex } from "../utils/jsonMapping";
import { routes } from "../types/route";

const FETCH_TIMEOUT_MS = 6000;
const IN_FLIGHT_ICON_REQUESTS = new Set<string>();


export function loadItemIcon(
  id: string,
  iconRegistry: IconRegistry,
  setIconRegistry: Dispatch<SetStateAction<IconRegistry>>,
) {
  if (!id || iconRegistry[id] || IN_FLIGHT_ICON_REQUESTS.has(id)) {
    return;
  }

  const cacheKey = `icon_${id}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    setIconRegistry((prev) => ({ ...prev, [id]: true }));
    return;
  }

  const id_arr = id.split(":")
  const mod_id = id_arr[0]
  const name = id_arr[1]

  if (!mod_id || !name) {
    return;
  }

  IN_FLIGHT_ICON_REQUESTS.add(id);

  // 根据mod_id获取分流规则
  const route = routes.find((r) => (Array.isArray(r.modID) ? r.modID.includes(mod_id) : r.modID === "*"));

  if (!route) {
    IN_FLIGHT_ICON_REQUESTS.delete(id);
    return;
  }

  if (route.iconURL === "github") {
    loadFromGit(mod_id, name, setIconRegistry);
    return;
  }

  const path = `${route.iconURL}${id.replace(":", "/")}.png`;

  fetchImageAsDataUrl(path, FETCH_TIMEOUT_MS)
    .then((dataUrl) => {
      sessionStorage.setItem(cacheKey, dataUrl);
      setIconRegistry((prev) => ({ ...prev, [id]: true }));
    })
    .catch(() => {
      //sessionStorage.setItem(cacheKey, false);
      setIconRegistry((prev) => ({ ...prev, [id]: false }));
    })
    .finally(() => {
      IN_FLIGHT_ICON_REQUESTS.delete(id);
    });
}

function loadFromGit(
  mod_id: string,
  name: string,
  setIconRegistry: Dispatch<SetStateAction<IconRegistry>>,
) {
  const id = `${mod_id}:${name}`;
  const cacheKey = `icon_${id}`;

  // const getMeta = async (): Promise<GitModMeta> => {
  //   // 已有缓存
  //   if (JSON_REGISTRY[mod_id]) {
  //     return JSON_REGISTRY[mod_id];
  //   }

  //   // 已有进行中的请求
  //   if (pendingJsonRequests.has(mod_id)) {
  //     return await pendingJsonRequests.get(mod_id)!;
  //   }

  //   // 发起新请求（async 函数自动返回 Promise）
  //   const promise = (async () => {
  //     const url = `${MOD_META_BASE_URL}assets/textures/${mod_id}.json`;
  //     const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);

  //     if (!response.ok) {
  //       throw new Error(`Metadata not found: ${response.status}`);
  //     }
  //     const contentType = response.headers.get("Content-Type") || undefined;
  //     if (!contentType || !contentType.startsWith("application/json")) {
  //       throw new Error(`Invalid json:${mod_id}`);
  //     }

  //     const json = await response.json() as GitModMeta;

  //     if (!json?.repository || !json?.icons) {
  //       throw new Error("Invalid metadata json");
  //     }

  //     JSON_REGISTRY[mod_id] = json;
  //     return json;
  //   })();

  //   // 清理进行中的请求
  //   promise.then(
  //     () => {
  //       pendingJsonRequests.delete(mod_id);
  //     },
  //     () => {
  //       pendingJsonRequests.delete(mod_id);
  //     },
  //   );
  //   pendingJsonRequests.set(mod_id, promise);
  //   return await promise;
  // };

  const load = async () => {
    try {
      //const meta = await getMeta();
      const meta = await loadPathIndex(mod_id); // 获取路径索引表

      const key = Object.keys(meta.icons).find((groupKey) => {
        const names = meta.icons[groupKey];
        return Array.isArray(names) && names.includes(name);
      });

      if (!key) {
        throw new Error("Icon key not found");
      }

      const repoUrl = key;
      const iconUrl = `${meta.repository}/${meta.prefix}src/main/resources/assets/${mod_id}/textures/${repoUrl}/${name}.png`;
      const dataUrl = await fetchImageAsDataUrl(iconUrl, FETCH_TIMEOUT_MS);
      sessionStorage.setItem(cacheKey, dataUrl);
      setIconRegistry((prev) => ({ ...prev, [id]: true }));
    } catch (error:any) {
      if (error instanceof TimeoutError) {
        // 网络超时不处理，等待后续可能重试成功
      return;
      }
      //sessionStorage.setItem(cacheKey, NULL_ICON);
      setIconRegistry((prev) => ({ ...prev, [id]: false }));
    } finally {
      IN_FLIGHT_ICON_REQUESTS.delete(id);
    }
  };

  load();
}
