"use client";

import { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "./Button";

export type WizardStepDef = { n: number; label: string };

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
  isFinal: boolean;
  finalNode: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[960px]">
      <div className="mb-4"><Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-muted"><ArrowLeft size={12} /> {backLabel}</Link></div>

      <div className="mb-8"><h1 className="font-display text-2xl font-bold">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>

      <WizardStepper
        steps={steps}
        current={current}
        completed={completed}
        onJump={onJump}
      />

      <div className="overflow-hidden border border-line p-4 sm:p-8">{children}</div>

      <div className="mt-4 flex items-center justify-between">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={current === steps[0].n}
          onClick={onBack}
        >
          <ArrowLeft size={12} /> Back
        </Button>

        {isFinal ? (
          finalNode
        ) : (
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={!canAdvance}
            onClick={onNext}
          >
            Next <ArrowRight size={12} />
          </Button>
        )}
      </div>
    </div>
  );
}

export function WizardStepHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6"><h2 className="text-lg font-semibold">{title}</h2>{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>
  );
}

function WizardStepper({
  steps,
  current,
  completed,
  onJump,
}: {
  steps: WizardStepDef[];
  current: number;
  completed: Record<number, boolean>;
  onJump: (n: number) => void;
}) {
  return (
    <div className="mb-8 flex items-start">
        {steps.map((s) => {
          const active = current === s.n;
          const done = !!completed[s.n] && !active;
          return <button type="button" key={s.n} onClick={() => onJump(s.n)} className="flex min-h-11 flex-1 cursor-pointer flex-col items-center gap-2 text-xs text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-8"><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${active ? "border-signal text-signal" : done ? "border-sev-resolved text-sev-resolved" : "border-line"}`}>{done ? <Check size={13} /> : s.n}</span><span>{s.label}</span></button>;
        })}
    </div>
  );
}
