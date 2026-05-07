export const LOOT_EXPLORER_BACK_EVENT = "loot-explorer:back";

export type LootExplorerBackEventDetail = {
  fromPath: string[];
  toPath: string[];
};

export function emitLootExplorerBack(detail: LootExplorerBackEventDetail) {
  window.dispatchEvent(
    new CustomEvent<LootExplorerBackEventDetail>(LOOT_EXPLORER_BACK_EVENT, { detail }),
  );
}

export function onLootExplorerBack(
  listener: (detail: LootExplorerBackEventDetail) => void,
) {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<LootExplorerBackEventDetail>;
    listener(customEvent.detail);
  };

  window.addEventListener(LOOT_EXPLORER_BACK_EVENT, handler);
  return () => window.removeEventListener(LOOT_EXPLORER_BACK_EVENT, handler);
}
