import type { Dispatch, SetStateAction } from "react";
import type { IconRegistry } from "../types/loot";

const NULL_ICON = "NULL";

export function loadItemIcon(
  id: string,
  iconRegistry: IconRegistry,
  setIconRegistry: Dispatch<SetStateAction<IconRegistry>>,
) {
  if (!id || iconRegistry[id]) {
    return;
  }

  const cacheKey = `icon_${id}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    setIconRegistry((prev) => ({ ...prev, [id]: cached }));
    return;
  }

  const namespace = id.split(":").at(0)

  if (!namespace) {
    return
  }

  // 根据命名空间获取分流规则
  // 如果分流到默认规则调用“load Default”，否则继续”
  const route = routes.find(r => r.modID.includes(namespace))

  if (!route) {
    return
  } 

  const path = `${route.iconURL}${id.replace(":", "/")}.png`

  fetch(path)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Not found");
      }
      const contentType = response.headers.get("Content-Type") || "";
      if (!contentType.startsWith("image/")) {
        throw new Error("Invalid image");
      }
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        }),
    )
    .then((dataUrl) => {
      sessionStorage.setItem(cacheKey, dataUrl);
      setIconRegistry((prev) => ({ ...prev, [id]: dataUrl }));
    })
    .catch(() => {
      sessionStorage.setItem(cacheKey, NULL_ICON);
      setIconRegistry((prev) => ({ ...prev, [id]: NULL_ICON }));
    });
}

const routes = [
  {
    modID: ["minecraft"],
    iconURL: `${import.meta.env.BASE_URL}assets/textures/`
  },
  {
    modID: "*",
    iconURL: "localhost"
  }
]

/* function loadDefault
  从本地加载图表，保留功能，先不实现。
  
*/

export function isMissingIcon(icon: string | undefined) {
  return icon === NULL_ICON;
}
