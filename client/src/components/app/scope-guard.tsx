import { MonitorPlay } from "lucide-react";
import { Card } from "@/components/app/card";
import { EmptyState } from "@/components/app/feedback";
import { useScope } from "@/lib/scope-store";

/**
 * Rounds/Teams/Decisions/Results/Projections are meaningless without an active
 * simulation. Rather than render an empty table, say so and point at the picker.
 */
export function ScopeGuard({ children }: { children: React.ReactNode }) {
  const { simulationId } = useScope();
  if (simulationId) return <>{children}</>;
  return (
    <Card padded={false}>
      <EmptyState
        icon={<MonitorPlay />}
        title="Pick a simulation first"
        hint="This page is scoped to one simulation. Choose one from the picker in the top bar."
      />
    </Card>
  );
}
