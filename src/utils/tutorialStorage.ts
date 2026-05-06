const TUTORIAL_STORAGE_KEY = "hasSeenTutorial";
const TUTORIAL_VERSION = "1";

export function shouldShowTutorial(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TUTORIAL_STORAGE_KEY) !== TUTORIAL_VERSION;
}

export function markTutorialAsSeen(): void {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, TUTORIAL_VERSION);
}
