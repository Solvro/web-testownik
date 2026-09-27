type SatelliteHoverListener = (hovered: boolean) => void;

const listeners = new Set<SatelliteHoverListener>();
let isSatelliteHovered = false;

/** Shrinks the hero Bubble while a device screen is hovered — no React state. */
export function setSatelliteHovered(hovered: boolean): void {
  if (hovered === isSatelliteHovered) {
    return;
  }

  isSatelliteHovered = hovered;
  for (const listener of listeners) {
    listener(hovered);
  }
}

export function getSatelliteHovered(): boolean {
  return isSatelliteHovered;
}

export function subscribeSatelliteHover(
  listener: SatelliteHoverListener,
): () => void {
  listeners.add(listener);
  listener(isSatelliteHovered);
  return () => {
    listeners.delete(listener);
  };
}
