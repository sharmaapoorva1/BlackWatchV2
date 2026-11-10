"use client";

import { Fragment, ReactNode, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "./Button";
import { LiveRegion } from "./LiveRegion";
import { cn } from "@/lib/utils";

export type WizardStepDef = { n: number; label: string };

/**
 * Multi-step form shell. Steps are rendered by the caller (kept mounted but
 * `hidden`, so every field still submits). The shell adds:
 *
 * - a stepper that is a real ordered list with `aria-current="step"`, and
 *   steps the user cannot reach yet are disabled instead of silently ignoring
 *   clicks (`canJump`);
 * - an explanation next to a disabled Next button (`blockedReason`) so the
 *   user knows what is missing;
 * - focus moved to the new step's heading, and "Step 2 of 5: Trigger"
 *   announced, whenever the step changes.
 */
export function Wizard({
  backHref,
  backLabel,
  title,
  subtitle,
  steps,
  current,
  completed,
  onJump,
  onBack,
  onNext,
  canAdvance,
  canJump,
  blockedReason,
  isFinal,
  finalNode,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  steps: WizardStepDef[];
  current: number;
  completed: Record<number, boolean>;
  onJump: (n: number) => void;
  onBack: () => void;
  onNext: () => void;
  canAdvance: boolean;
  /** Whether a step can be opened right now. Defaults to every step. */
  canJump?: (n: number) => boolean;
  /** Why Next is disabled, in plain words. Shown beside the button. */
  blockedReason?: string;
  isFinal: boolean;
  finalNode: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const [announcement, setAnnouncement] = useState("");
  const reasonId = useId();
  const active = steps.find((step) => step.n === current);

  useEffect(() => {
    // Do not steal focus when the wizard first appears (or opens on a step).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setAnnouncement(`Step ${steps.findIndex((s) => s.n === current) + 1} of ${steps.length}: ${active?.label ?? ""}`);
    const headings = panelRef.current?.querySelectorAll<HTMLElement>("[data-wizard-step-title]");
    const visible = headings && Array.from(headings).find((heading) => heading.offsetParent !== null);
    visible?.focus({ preventScroll: false });
  }, [current, steps, active?.label]);

  const showReason = !isFinal && !canAdvance && Boolean(blockedReason);

  return (
    <div className="mx-auto max-w-[960px]">
      <LiveRegion message={announcement} />
      <Breadcrumbs
        items={[
          { label: backLabel.replace(/^back to /i, ""), href: backHref },
          { label: title },
        ]}
      />

      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>

      <WizardStepper steps={steps} current={current} completed={completed} onJump={onJump} canJump={canJump} />

      <div ref={panelRef} className="overflow-hidden rounded-md border border-line-soft bg-surface-1 p-4 sm:p-8">
        {children}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" size="sm" variant="ghost" disabled={current === steps[0].n} onClick={onBack}>
          <ArrowLeft size={12} /> Back
        </Button>

        {isFinal ? (
          finalNode
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {showReason && (
              <p id={reasonId} className="text-xs text-fg-muted">
                {blockedReason}
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={!canAdvance}
              aria-describedby={showReason ? reasonId : undefined}
              onClick={onNext}
            >
              Next <ArrowRight size={12} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function WizardStepHeader({
  title,
  subtitle,
  id,
}: {
  title: string;
  subtitle?: string;
  id?: string;
}) {
  return (
    <div className="mb-6">
      <h2
        id={id}
        data-wizard-step-title
        tabIndex={-1}
        className="text-lg font-semibold focus-visible:outline-none"
      >
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

function WizardStepper({
  steps,
  current,
  completed,
  onJump,
  canJump,
}: {
  steps: WizardStepDef[];
  current: number;
  completed: Record<number, boolean>;
  onJump: (n: number) => void;
  canJump?: (n: number) => boolean;
}) {
  const position = steps.findIndex((s) => s.n === current) + 1;
  const active = steps.find((s) => s.n === current);

  return (
    <nav aria-label="Progress" className="mb-8">
      {/* Narrow screens: five labels do not fit, so say where you are in words. */}
      <p className="mb-2 text-xs text-fg-muted sm:hidden">
        Step {position} of {steps.length}: <span className="text-fg">{active?.label}</span>
      </p>
      <ol className="flex items-start">
        {steps.map((s, index) => {
          const isActive = current === s.n;
          const done = !!completed[s.n] && !isActive;
          const reachable = canJump ? canJump(s.n) : true;
          return (
            <Fragment key={s.n}>
              {index > 0 && (
                <li
                  aria-hidden="true"
                  className={cn("mt-3 h-px flex-1", completed[steps[index - 1].n] ? "bg-sev-resolved/60" : "bg-line")}
                />
              )}
              <li className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onJump(s.n)}
                  disabled={!reachable && !isActive}
                  aria-current={isActive ? "step" : undefined}
                  className="flex min-h-11 cursor-pointer flex-col items-center gap-2 px-1 text-xs text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted sm:min-h-8 sm:px-2"
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border",
                      isActive ? "border-signal text-signal" : done ? "border-sev-resolved text-sev-resolved" : "border-line",
                    )}
                  >
                    {done ? <Check size={13} aria-hidden="true" /> : s.n}
                    {done && <span className="sr-only">completed</span>}
                  </span>
                  <span className={cn("hidden sm:inline", isActive && "text-fg")}>{s.label}</span>
                  <span className="sr-only sm:hidden">{s.label}</span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
