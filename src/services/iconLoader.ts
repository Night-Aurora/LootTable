import type { Dispatch, SetStateAction } from "react";
import type { IconRegistry } from "../types/loot";
import { routes } from "../types/route";

const NULL_ICON = "NULL";
const FETCH_TIMEOUT_MS = 6000;
const MOD_META_BASE_URL = import.meta.env.BASE_URL;
const JSON_REGISTRY: Record<string, GitModMeta> = {};
const IN_FLIGHT_ICON_REQUESTS = new Set<string>();
const pendingJsonRequests = new Map<string, Promise<GitModMeta>>();

type GitModMeta = {
  repository: string;
  prefix: string | "";
  icons: Record<string, string[]>;
};

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

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
    setIconRegistry((prev) => ({ ...prev, [id]: cached }));
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
      setIconRegistry((prev) => ({ ...prev, [id]: dataUrl }));
    })
    .catch(() => {
      sessionStorage.setItem(cacheKey, NULL_ICON);
      setIconRegistry((prev) => ({ ...prev, [id]: NULL_ICON }));
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

  const getMeta = async (): Promise<GitModMeta> => {
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
        throw new Error(`Metadata not found: ${response.status}`);
      }
      const contentType = response.headers.get("Content-Type") || undefined;
      if (!contentType || !contentType.startsWith("application/json")) {
        throw new Error(`Invalid json:${mod_id}`);
      }

      const json = await response.json() as GitModMeta;

      if (!json?.repository || !json?.icons) {
        throw new Error("Invalid metadata json");
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
    );
    pendingJsonRequests.set(mod_id, promise);
    return await promise;
  };

  const load = async () => {
    try {
      const meta = await getMeta();

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
      setIconRegistry((prev) => ({ ...prev, [id]: dataUrl }));
    } catch (error:any) {
      if (error instanceof TimeoutError) {
        // 网络超时不处理，等待后续可能重试成功
        return;
      }
      sessionStorage.setItem(cacheKey, NULL_ICON);
      setIconRegistry((prev) => ({ ...prev, [id]: NULL_ICON }));
    } finally {
      IN_FLIGHT_ICON_REQUESTS.delete(id);
    }
  };

  load();
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }) // 计时器信号
    .catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new TimeoutError(`Request timed out: ${url}`);
      }
      throw error;
    })
    .finally(() => {
      window.clearTimeout(timer);
    });
}

function fetchImageAsDataUrl(url: string, timeoutMs: number): Promise<string> { // 将读取到的结果编码成Data URL字符串
  return fetchWithTimeout(url, timeoutMs)
    .then((response) => {
      if (!response.ok) {
        throw new Error("404 Not found");
      }
      const contentType = response.headers.get("Content-Type") || undefined;
      if (!contentType || !contentType.startsWith("image/")) {
        throw new Error("Invalid image");
      }
      return response.blob();
    })
    .then((blob) => new Promise<string>((resolve) => { // 编码
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    }),
    )
}


export function isMissingIcon(icon: string | undefined) {
  return icon === NULL_ICON;
}
