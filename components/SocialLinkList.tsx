import { socialLinks } from "@/lib/site-info";

/** "Bluesky and X" / "Bluesky, X and Threads", each a link to the account. Renders nothing while no account is filled in. */
export function SocialLinkList({ className }: { className: string }) {
  const links = socialLinks();
  return (
    <>
      {links.map((l, i) => (
        <span key={l.label}>
          {i > 0 ? (i === links.length - 1 ? " and " : ", ") : ""}
          <a href={l.url} className={className} rel="noopener">
            {l.label}
          </a>
        </span>
      ))}
    </>
  );
}
