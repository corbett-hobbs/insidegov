import type { CSSProperties } from "react";

/**
 * The homepage intro sentence, split into words so each can light up in turn as
 * the paragraph scrolls into view (scroll-driven, CSS only: `.home-w` in
 * globals.css, where `animation-timeline` is supported). `highlight` is the
 * phrase that gets the gold marker, which wipes in once its words are lit.
 */
export function IntroWords({
  before,
  highlight,
  after,
}: {
  before: string;
  highlight: string;
  after: string;
}) {
  const parts = [
    { text: before, hl: false },
    { text: highlight, hl: true },
    { text: after, hl: false },
  ];
  const total = parts.reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);
  let i = 0;
  const words = (text: string) =>
    text.split(/(\s+)/).map((t, k) =>
      /^\s+$/.test(t) || !t ? (
        t
      ) : (
        <span key={k} className="home-w" style={{ "--w": (i++ / total).toFixed(3) } as CSSProperties}>
          {t}
        </span>
      ),
    );
  return (
    <>
      {parts.map((p, k) => (p.hl ? <span key={k} className="home-hl">{words(p.text)}</span> : <span key={k}>{words(p.text)}</span>))}
    </>
  );
}
