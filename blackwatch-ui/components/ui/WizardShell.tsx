"use client";

import { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Box, Button, Paper, Stack, Step, StepButton, StepLabel, Stepper, Typography } from "@mui/material";

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
    <Box sx={{ maxWidth: 960, mx: "auto" }}>
      <Box sx={{ mb: 2 }}><Typography component={Link} href={backHref} sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: "text.secondary", fontSize: 12, textDecoration: "none" }}><ArrowLeft size={12} /> {backLabel}</Typography></Box>

      <Box sx={{ mb: 4 }}><Typography component="h1" variant="h1">{title}</Typography>{subtitle && <Typography variant="body2" sx={{ mt: 0.5 }}>{subtitle}</Typography>}</Box>

      <WizardStepper
        steps={steps}
        current={current}
        completed={completed}
        onJump={onJump}
      />

      <Paper sx={{ border: 1, borderColor: "divider", p: { xs: 2, sm: 4 }, overflow: "hidden" }}>{children}</Paper>

      <Stack direction="row" sx={{ mt: 2, justifyContent: "space-between", alignItems: "center" }}>
        <Button
          type="button"
          size="small"
          variant="text"
          color="inherit"
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
            size="small"
            variant="contained"
            color="primary"
            disabled={!canAdvance}
            onClick={onNext}
          >
            Next <ArrowRight size={12} />
          </Button>
        )}
      </Stack>
    </Box>
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
    <Box sx={{ mb: 2.5 }}><Typography component="h2" variant="h3">{title}</Typography>{subtitle && <Typography variant="body2" sx={{ mt: 0.5 }}>{subtitle}</Typography>}</Box>
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
    <Stepper activeStep={Math.max(0, steps.findIndex((step) => step.n === current))} alternativeLabel sx={{ mb: 4 }}>
        {steps.map((s) => {
          const active = current === s.n;
          const done = !!completed[s.n] && !active;
          return <Step key={s.n} completed={done}><StepButton onClick={() => onJump(s.n)} color="inherit"><StepLabel>{s.label}</StepLabel></StepButton></Step>;
        })}
    </Stepper>
  );
}
