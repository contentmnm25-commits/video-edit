"use client";

import { useState } from "react";

/** Drag a divider across two stacked images to spot what changed. */
export function CompareSlider({ before, after, beforeLabel, afterLabel }: { before: string; after: string; beforeLabel: string; afterLabel: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div>
      <div className="relative mx-auto w-fit max-w-full select-none overflow-hidden rounded-lg bg-white ring-1 ring-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={afterLabel} className="block max-h-[70vh] w-auto max-w-full" draggable={false} />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt={beforeLabel} className="block size-full object-contain" draggable={false} />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent shadow" style={{ left: `${pos}%` }} />
        <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">{beforeLabel}</span>
        <span className="absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">{afterLabel}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="mx-auto mt-3 block w-full max-w-md accent-accent"
        aria-label="Slide to compare"
      />
    </div>
  );
}
