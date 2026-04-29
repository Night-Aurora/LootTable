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

  const path = `${import.meta.env.BASE_URL}assets/textures/${id.replace(":", "/")}.png`;
  const cacheKey = `icon_${id}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    setIconRegistry((prev) => ({ ...prev, [id]: cached }));
    return;
  }

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

export function isMissingIcon(icon: string | undefined) {
  return icon === NULL_ICON;
}
