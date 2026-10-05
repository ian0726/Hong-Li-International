"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

type AutoFitTitleProps = {
  as: "h1" | "h3";
  children: string;
  maxSize: number;
  mobileMaxSize?: number;
  minSize?: number;
};

export default function AutoFitTitle({
  as,
  children,
  maxSize,
  mobileMaxSize,
  minSize = 10,
}: AutoFitTitleProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  const fitTitle = useCallback(() => {
    const element = titleRef.current;
    if (!element) return;

    const responsiveMaximum = window.matchMedia("(max-width: 680px)").matches
      ? mobileMaxSize ?? maxSize
      : maxSize;
    let lower = minSize;
    let upper = responsiveMaximum;
    let best = minSize;

    element.style.fontSize = `${responsiveMaximum}px`;
    if (element.scrollWidth <= element.clientWidth) return;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = (lower + upper) / 2;
      element.style.fontSize = `${candidate}px`;
      if (element.scrollWidth <= element.clientWidth) {
        best = candidate;
        lower = candidate;
      } else {
        upper = candidate;
      }
    }

    element.style.fontSize = `${Math.floor(best * 10) / 10}px`;
  }, [maxSize, minSize, mobileMaxSize]);

  useLayoutEffect(() => {
    fitTitle();
    const observer = new ResizeObserver(fitTitle);
    if (titleRef.current) observer.observe(titleRef.current);
    void document.fonts?.ready.then(fitTitle);
    return () => observer.disconnect();
  }, [children, fitTitle]);

  const props = { ref: titleRef, className: "auto-fit-title", title: children };
  return as === "h1" ? <h1 {...props}>{children}</h1> : <h3 {...props}>{children}</h3>;
}
