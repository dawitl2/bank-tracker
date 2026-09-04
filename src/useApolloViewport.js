import { useEffect, useRef } from "react";

// Mobile keyboards can shrink the visual viewport without resizing the layout.
export default function useApolloViewport(open) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const viewport = window.visualViewport;
    const overlay = overlayRef.current;
    if (!viewport || !overlay) return undefined;

    const update = () => {
      overlay.style.setProperty("--apollo-visible-height", `${viewport.height}px`);
      overlay.style.setProperty("--apollo-visible-top", `${viewport.offsetTop}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [open]);

  return overlayRef;
}
