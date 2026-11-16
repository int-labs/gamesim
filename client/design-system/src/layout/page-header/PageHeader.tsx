import type { ReactNode } from "react";
import { Heading } from "../../foundations/text/Heading";
import { Text } from "../../foundations/text/Text";
import { cn } from "../../lib/cn";

export interface PageHeaderProps {
  /** The page title (Poppins 30): the page's one h1. */
  title: ReactNode;
  /** A line under the title ("Manage and monitor all simulation projects from a single dashboard."). */
  description?: ReactNode;
  /** Next to the title: a status badge. */
  addon?: ReactNode;
  /** A Breadcrumb above the title. */
  breadcrumb?: ReactNode;
  /** Buttons at the right ("New Simulation"). */
  actions?: ReactNode;
}

/**
 * The top of a page, as the Figma Admin screens build it: the breadcrumb in a 28 px row, 20 px
 * above the title; the 45 px title with its badge 16 px after it and the description right under
 * it; the actions at the right, level with the description's last line on list pages and centred
 * on a lone title.
 */
export function PageHeader({ title, description, addon, breadcrumb, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5">
      {breadcrumb ? <div className="pt-2">{breadcrumb}</div> : null}
      <div className={cn("flex flex-wrap justify-between gap-x-6 gap-y-4 pt-2", description ? "items-end" : "items-center")}>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Heading level={1}>{title}</Heading>
            {addon}
          </div>
          {/* Figma's gray 500 reads 4.4:1 on the page; gray 600 reads 6.9:1. */}
          {description ? <Text tone="muted">{description}</Text> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
