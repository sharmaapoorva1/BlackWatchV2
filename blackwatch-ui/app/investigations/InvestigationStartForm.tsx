"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { investigationDetailHref } from "@/lib/investigation-flow";

export function InvestigationStartForm({
  initialIp = "",
}: {
  initialIp?: string;
}) {
  const [ip, setIp] = useState(initialIp);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = ip.trim();
    if (!value) {
      setError("Enter an IPv4 or IPv6 address to start an investigation.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/investigations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip: value }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          id?: string;
          detail?: string;
        };
        if (!response.ok || !body.id) {
          setError(body.detail ?? "Could not start the investigation.");
          return;
        }
        window.location.assign(investigationDetailHref(body.id));
      } catch {
        setError("Could not reach BlackWatch. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-3 sm:flex-row sm:items-start" noValidate>
      <Field
        label="IP address"
        hint="IPv4 or IPv6. BlackWatch searches events and read models for it."
        error={error ?? undefined}
        className="w-full sm:w-80"
      >
        <Input
          name="ip"
          value={ip}
          onChange={(event) => setIp(event.target.value)}
          placeholder="203.0.113.9"
          mono
          disabled={busy}
          required
          autoComplete="off"
        />
      </Field>
      <Button type="submit" variant="primary" disabled={busy} className="sm:mt-[1.625rem]">
        {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <ArrowRight size={13} aria-hidden />}
        {busy ? "Starting…" : "Investigate IP"}
      </Button>
    </form>
  );
}
