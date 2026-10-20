import React, { useLayoutEffect, useRef } from 'react';

/** Fit the complete answer to the actual cell, including after rotation/font loading. */
export function FitAnswerText({ text }: { text: string }) {
  const box = useRef<HTMLSpanElement>(null), content = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    let alive = true;
    const fit = () => {
      if (!alive || !box.current || !content.current || !box.current.clientHeight) return;
      const node = content.current, bounds = box.current;
      const measure = () => {
        let low = 1, high = 26;
        for (let n = 0; n < 9; n++) {
          const size = (low + high) / 2;
          node.style.fontSize = `${size}px`;
          if (node.scrollHeight <= bounds.clientHeight && node.scrollWidth <= bounds.clientWidth) low = size; else high = size;
        }
        return Math.floor(low * 10) / 10;
      };
      // Prefer complete words; allow character wrapping only for unusually dense text.
      node.style.overflowWrap = 'normal';
      let size = measure();
      if (size < 9) { node.style.overflowWrap = 'anywhere'; size = measure(); }
      node.style.fontSize = `${size}px`;
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit);
    if (box.current) observer?.observe(box.current);
    window.addEventListener('resize', fit);
    void document.fonts?.ready.then(fit);
    return () => { alive = false; observer?.disconnect(); window.removeEventListener('resize', fit); };
  }, [text]);
  return <span ref={box} className="player-answer-text w-full min-w-0 min-h-0 h-full flex items-center justify-center font-bold text-ink"><span ref={content} className="block w-full whitespace-normal [overflow-wrap:anywhere]" style={{ lineHeight: 1.12 }}>{text}</span></span>;
}
