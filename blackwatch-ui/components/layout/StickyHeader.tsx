"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Page header that stays pinned at the top of the scrolling area from `md` up
 * (on phones it scrolls away, since vertical space is scarce).
 *
 * It publishes its own height as the CSS variable `--sticky-header-h`, so the
 * things that stick or scroll *below* it (the contents sidebar, anchor jumps)
 * can offset themselves by exactly that much, even when the header wraps onto
 * a second line. The variable is removed again when the page unmounts.
 */
export function StickyHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    const publish = () => {
      // Only meaningful while it is actually sticky (md and up).
      const sticky = window.matchMedia("(min-width: 768px)").matches;
      root.style.setProperty("--sticky-header-h", sticky ? `${element.getBoundingClientRect().height}px` : "0px");
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    window.addEventListener("resize", publish);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publish);
      root.style.removeProperty("--sticky-header-h");
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "z-20 -mx-3 mb-4 border-b border-line bg-canvas px-3 pb-3 sm:-mx-4 sm:px-4 md:sticky md:top-0 md:-mx-6 md:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
