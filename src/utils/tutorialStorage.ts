const TUTORIAL_STORAGE_KEY = "hasSeenTutorial";

export function shouldShowTutorial(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TUTORIAL_STORAGE_KEY) !== "true";
}

export function markTutorialAsSeen(): void {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
}
