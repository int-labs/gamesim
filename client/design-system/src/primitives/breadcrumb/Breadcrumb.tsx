import { useRender } from "@base-ui/react/use-render";
import { ArrowLeft } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { SlashSeparator } from "../../foundations/icon/glyphs";
import { Icon } from "../../foundations/icon/Icon";
import { cn } from "../../lib/cn";

export interface BreadcrumbItem {
  label: ReactNode;
  /** A link to this level; or `render` with the router's link. The last item is the current page. */
  href?: string;
  render?: useRender.RenderProp;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** The Figma back arrow before the first level. Default true. */
  back?: boolean;
  /** Names the landmark. Default "Breadcrumb". */
  label?: string;
}

// Figma _breadcrumb: every level Source Sans SemiBold 14/20 in gray 600, the current one too; the
// current page is marked for screen readers, and only the levels above are links.
const levelClass = "type-body font-semibold text-fg-muted";

const linkClass = cn(
  "inline-flex items-center gap-(--breadcrumb-gap) rounded-sm",
  levelClass,
  "transition-colors duration-fast ease-standard hover:text-fg-primary",
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
);

function BreadcrumbLink({ item, back }: { item: BreadcrumbItem; back: boolean }) {
  return useRender({
    defaultTagName: "a",
    render: item.render,
    props: {
      href: item.href,
      className: linkClass,
      children: (
        <>
          {back ? <Icon icon={ArrowLeft} size="md" /> : null}
          {item.label}
        </>
      ),
    },
  });
}

/** Where the page sits: "← Simulations / Novabank Growth Simulation". */
export function Breadcrumb({ items, back = true, label = "Breadcrumb" }: BreadcrumbProps) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-(--breadcrumb-item-gap)">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <Fragment key={index}>
              {index > 0 ? (
                <li aria-hidden className="flex text-fg-muted">
                  <Icon icon={SlashSeparator} size="xs" />
                </li>
              ) : null}
              <li className="flex">
                {current ? (
                  <span aria-current="page" className={levelClass}>
                    {item.label}
                  </span>
                ) : (
                  <BreadcrumbLink item={item} back={back && index === 0} />
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
