import { ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { DUR, EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** O3 PageHeader — title/subtitle/actions cascade in once per route mount. */
export function PageHeader({
  title,
  subtitle,
  count,
  actions,
  breadcrumbs,
  icon,
  status,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  count?: number;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; to?: string }[];
  icon?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
}) {
  const step = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: DUR.base, ease: EASE.out, delay: i * 0.06 },
  });

  return (
    <header className={cn("mb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <motion.nav
          {...step(0)}
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1 text-[12px] text-muted-foreground"
        >
          {breadcrumbs.map((c, i) => (
            <React.Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 opacity-60" />}
              {c.to ? (
                <Link to={c.to} className="transition-colors hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{c.label}</span>
              )}
            </React.Fragment>
          ))}
        </motion.nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <motion.div {...step(1)} className="flex items-center gap-3">
            {icon}
            <h1
              tabIndex={-1}
              className="font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-foreground outline-none"
            >
              {title}
            </h1>
            {count != null && (
              <Badge tone="count" className="mt-1 tnum">
                {count}
              </Badge>
            )}
            {status}
          </motion.div>
          {subtitle && (
            <motion.p {...step(2)} className="mt-1.5 max-w-[65ch] text-[14px] leading-5 text-muted-foreground">
              {subtitle}
            </motion.p>
          )}
        </div>

        {actions && (
          <motion.div {...step(3)} className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </motion.div>
        )}
      </div>
    </header>
  );
}
