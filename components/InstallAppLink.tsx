"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void> };

const LINK =
  "cursor-pointer border-0 bg-transparent px-0 py-1.5 text-left sm:py-1 font-[inherit] text-ink-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Footer "Add to home screen" link. Chrome and Edge fire `beforeinstallprompt`, so one tap
 * opens the native install dialog. iOS Safari has no such event, so it gets a one-line hint.
 * Renders nothing when the site is already installed or the browser can't install it.
 */
export function InstallAppLink() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (prompt) {
    return (
      <button type="button" className={LINK} onClick={() => void prompt.prompt()}>
        Add to home screen
      </button>
    );
  }
  if (ios) {
    return (
      <>
        <button type="button" className={LINK} onClick={() => setHint((h) => !h)} aria-expanded={hint}>
          Add to home screen
        </button>
        {hint && (
          <span className="mt-1 block text-[0.78rem] text-ink-muted">
            Tap Share, then Add to Home Screen.
          </span>
        )}
      </>
    );
  }
  return null;
}
