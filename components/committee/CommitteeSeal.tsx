import { useId } from "react";

export type SealChamber = "house" | "senate" | "joint" | "House" | "Senate" | "Joint";

/** Below this the joint seal drops its ring lettering (unreadable that small). */
const LETTERING_MIN = 40;

function JointSeal({ size, className }: { size: number; className?: string }) {
  const k = useId().replace(/:/g, "");
  const lettering = size >= LETTERING_MIN;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    >
      {lettering && (
        <defs>
          <path id={`t${k}`} d="M24.7 120.2A78 78 0 1 1 175.3 120.2" />
          <path id={`b${k}`} d="M12 100A88 88 0 0 0 188 100" />
        </defs>
      )}
      <circle cx="100" cy="100" r="98" fill="#1d3b6f" />
      <circle cx="100" cy="100" r="94" fill="none" stroke="#b8902f" strokeWidth="2" />
      <circle cx="100" cy="100" r="70" fill="#f6f1e4" stroke="#b8902f" strokeWidth="3" />
      <circle cx="100" cy="100" r="66" fill="none" stroke="#1d3b6f" strokeWidth="1" />
      {lettering && (
        <>
          <text fontFamily="Newsreader,Georgia,serif" fontSize="11.5" fontWeight="600" letterSpacing="1.1" fill="#f6f1e4" textAnchor="middle">
            <textPath href={`#t${k}`} startOffset="50%">UNITED STATES CONGRESS</textPath>
          </text>
          <text fontFamily="Newsreader,Georgia,serif" fontSize="12" fontWeight="600" letterSpacing="2.4" fill="#f6f1e4" textAnchor="middle">
            <textPath href={`#b${k}`} startOffset="50%">JOINT COMMITTEE</textPath>
          </text>
          <g fill="#b8902f">
            <path id={`s${k}`} d="M0-5l1.5 3.5 3.8.3-2.9 2.5.9 3.7L0 2.2-3.3 5l.9-3.7-2.9-2.5 3.8-.3z" transform="translate(13 100)" />
            <use href={`#s${k}`} x="174" />
          </g>
        </>
      )}
      <g stroke="#1d3b6f" strokeWidth="1.2" strokeLinejoin="round">
        <rect x="50" y="138" width="100" height="5" fill="#b8902f" />
        <rect x="56" y="132" width="88" height="6" fill="#f6f1e4" />
        <rect x="58" y="110" width="84" height="22" fill="#1d3b6f" />
        {[62, 71, 80, 89, 98, 107, 116, 125, 134].map((x) => (
          <rect key={x} x={x} y="113" width="3.2" height="14" fill="#f6f1e4" stroke="none" />
        ))}
        <rect x="54" y="106" width="92" height="4" fill="#b8902f" />
        <rect x="76" y="92" width="48" height="14" fill="#f6f1e4" />
        <path d="M82 92v14M90 92v14M100 92v14M110 92v14M118 92v14" fill="none" />
        <path d="M76 92Q76 60 100 54Q124 60 124 92Z" fill="#1d3b6f" />
      </g>
      <g fill="none" stroke="#b8902f" strokeWidth="1.2">
        <path d="M84 96Q88 66 100 58" />
        <path d="M92 96Q94 66 100 58" />
        <path d="M108 96Q106 66 100 58" />
        <path d="M116 96Q112 66 100 58" />
      </g>
      <g stroke="#1d3b6f" strokeWidth="1.2" fill="#b8902f">
        <rect x="94" y="44" width="12" height="11" fill="#f6f1e4" />
        <path d="M94 44Q100 36 106 44Z" />
        <rect x="99" y="30" width="2" height="8" stroke="none" />
        <circle cx="100" cy="29" r="2.4" stroke="none" />
      </g>
    </svg>
  );
}

/**
 * A committee's mark: the House or Senate seal (public domain, Wikimedia
 * Commons, saved in `public/images/seals/`), or the site's own drawn "Joint
 * Committee" seal for joint committees, which have no official one. Decorative
 * (the committee's name always sits beside it), so it is hidden from screen
 * readers. `size` is the square side in px.
 */
export function CommitteeSeal({
  chamber,
  size = 24,
  className = "",
}: {
  chamber: SealChamber;
  size?: number;
  className?: string;
}) {
  const c = chamber.toLowerCase();
  if (c === "joint") {
    return <JointSeal size={size} className={`flex-none max-sm:hidden ${className}`} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- two tiny static files; see MemberPhoto
    <img
      src={`/images/seals/${c === "senate" ? "senate" : "house"}.png`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`flex-none object-contain max-sm:hidden ${className}`}
    />
  );
}
