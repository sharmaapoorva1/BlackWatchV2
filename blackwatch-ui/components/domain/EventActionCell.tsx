import { summarizeAction } from "@/lib/event-summary";
import { EventLink } from "./EventPeek";

/** Plain-language event name that opens the quick-look drawer, with the raw
 *  action id underneath for operators who search or write rules on it. */
export function EventActionCell({ eventId, action }: { eventId: string; action: string }) {
  return (
    <div className="min-w-0 max-w-lg">
      <EventLink
        eventId={eventId}
        className="block truncate text-sm text-fg transition-colors hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
      >
        {summarizeAction(action)}
      </EventLink>
      <span className="block truncate font-mono text-xs text-fg-subtle" title={action}>
        {action}
      </span>
    </div>
  );
}
