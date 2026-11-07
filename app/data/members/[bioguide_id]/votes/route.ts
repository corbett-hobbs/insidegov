import { getCurrentMemberIndex } from "@/lib/congress-data";
import { getMemberVotes } from "@/lib/member-votes-data";

/**
 * `/data/members/[bioguide_id]/votes` — a member's final-passage votes on enacted laws and how often they sided with their party
 * (see `MemberVotes`), prerendered to static JSON for every current member. The member page's voting record fetches it on mount.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [...getCurrentMemberIndex().keys()].map((id) => ({ bioguide_id: id }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ bioguide_id: string }> }) {
  const { bioguide_id } = await params;
  if (!getCurrentMemberIndex().has(bioguide_id)) return new Response("Not found", { status: 404 });
  return Response.json(getMemberVotes(bioguide_id) ?? null, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
