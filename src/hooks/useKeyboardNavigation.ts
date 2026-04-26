import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export function useKeyboardNavigation<T>(
  items: T[],
  onSelect: (item: T) => void,
  isOpen: boolean,
) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [items, isOpen]);

  useEffect(() => {
    if (selectedIndex < 0 || !scrollContainerRef.current) {
      return;
    }

    const container = scrollContainerRef.current;
    const selectedElement = container.children[selectedIndex] as HTMLElement;
    if (!selectedElement) {
      return;
    }

    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const elementTop = selectedElement.offsetTop;
    const elementBottom = selectedElement.offsetTop + selectedElement.clientHeight;

    if (elementTop < containerTop) {
      container.scrollTop = elementTop;
      return;
    }

    if (elementBottom > containerBottom) {
      container.scrollTop = elementBottom - container.clientHeight;
    }
  }, [selectedIndex]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isOpen || items.length === 0) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
        break;
      case "Enter":
        if (selectedIndex >= 0) {
          event.preventDefault();
          onSelect(items[selectedIndex]);
        }
        break;
      default:
        break;
    }
  };

  return {
    selectedIndex,
    handleKeyDown,
    scrollContainerRef,
    setSelectedIndex,
  };
}
