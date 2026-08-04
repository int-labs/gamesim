import { Hammer } from "lucide-react";
import { useLocation } from "react-router-dom";
import { EmptyState } from "@/components/app/feedback";
import { Card } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { navEntryFor } from "@/lib/nav";

/** Honest interim surface for pages not yet rebuilt on the new system. */
export default function PlaceholderPage() {
  const { pathname } = useLocation();
  const entry = navEntryFor(pathname);

  return (
    <>
      <PageHeader
        title={entry?.label ?? "Page"}
        subtitle="This page is queued for the console rebuild."
      />
      <Card padded={false}>
        <EmptyState
          icon={<Hammer />}
          title="Not rebuilt yet"
          hint="The design system and shell are live; this screen is still on the build list."
        />
      </Card>
    </>
  );
}
