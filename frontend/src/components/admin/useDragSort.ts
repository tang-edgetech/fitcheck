"use client";

import { useState, type DragEvent, type KeyboardEvent } from "react";

/** Returns a copy of the list with one item moved from one position to another. */
export function moveItem<T>(xs: T[], from: number, to: number) {
  const n = [...xs];
  const [x] = n.splice(from, 1);
  n.splice(to, 0, x);
  return n;
}

/**
 * Drag-and-drop ordering for lists and table rows (native HTML5 drag, no extra library).
 * Spread `itemProps(i)` on each row/item and `handleProps(i, count)` on its grip button.
 * A row only becomes draggable while its grip is held, so text and controls in the row behave normally.
 * The grip also answers ↑ / ↓ keys so ordering works without a mouse.
 * Classes set: `sortable-item`, `is-dragging`, `is-drop-before`, `is-drop-after`; grip: `sortable-handle`.
 */
export function useDragSort(onMove: (from: number, to: number) => void) {
  const [armed, setArmed] = useState<number | null>(null);
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const reset = () => { setArmed(null); setFrom(null); setOver(null); };

  const itemProps = (i: number) => ({
    draggable: armed === i,
    className: [
      "sortable-item",
      from === i ? "is-dragging" : "",
      from !== null && over === i && from !== i ? (from > i ? "is-drop-before" : "is-drop-after") : "",
    ].filter(Boolean).join(" "),
    onDragStart: (e: DragEvent) => {
      setFrom(i);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    },
    onDragOver: (e: DragEvent) => {
      if (from === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== i) setOver(i);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (from !== null && from !== i) onMove(from, i);
      reset();
    },
    onDragEnd: reset,
  });

  const handleProps = (i: number, count: number) => ({
    className: "sortable-handle",
    "aria-label": "Drag to reorder, or press the up and down arrow keys",
    onPointerDown: () => setArmed(i),
    onPointerUp: () => { if (from === null) setArmed(null); },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); onMove(i, i - 1); }
      if (e.key === "ArrowDown" && i < count - 1) { e.preventDefault(); onMove(i, i + 1); }
    },
  });

  return { itemProps, handleProps };
}
