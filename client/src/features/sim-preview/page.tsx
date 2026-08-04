import { Copy, ExternalLink, Eye, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader } from "@/components/app/card";
import { IconTile } from "@/components/app/bits";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { PLAYER_ORIGIN } from "@/lib/player-assets";

// Was hardcoded to localhost:5173, which made this link dead in every
// deployment. Now one setting, shared with the art resolver.
const PLAYER_URL = PLAYER_ORIGIN;

/**
 * The player is a separate origin with its own session, so embedding it is a
 * dead end (spec §10.19). This page links out and explains the pass-key flow.
 */
export default function SimPreviewPage() {
  return (
    <>
      <PageHeader
        title="Player preview"
        subtitle="The notebook pixel sim is the player-facing app. It runs on its own origin with its own session."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card hero className="lg:col-span-2">
          <CardHeader
            onDark
            eyebrow="Player app"
            title="Notebook Business Sim"
            subtitle="A 90-day pixel entrepreneurship simulation. Teams sign in with a pass key and submit one decision per round."
          />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="onDark" asChild>
              <a href={PLAYER_URL} target="_blank" rel="noreferrer">
                <ExternalLink /> Open player
              </a>
            </Button>
            <Button
              variant="onDark"
              onClick={() => {
                navigator.clipboard.writeText(PLAYER_URL);
                toast.success("Player URL copied");
              }}
            >
              <Copy /> Copy link
            </Button>
          </div>
          <p className="mt-4 text-[12px] text-hero-muted">{PLAYER_URL}</p>
        </Card>

        <Card>
          <CardHeader title="How teams sign in" />
          <ol className="mt-4 space-y-4">
            {[
              { icon: <KeyRound />, text: "Each team user carries a pass key — find it on the Users page." },
              { icon: <Eye />, text: "Hold the masked value to reveal it, then share it with that team only." },
              {
                icon: <ExternalLink />,
                text: "Teams open the player, enter the pass key, and play the active round.",
              },
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <IconTile icon={step.icon} tone="peri" size="sm" />
                <p className="flex-1 text-[13px] leading-5 text-body">{step.text}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
