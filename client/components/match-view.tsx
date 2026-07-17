"use client";

import { Eye } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { LiveMatchState, MatchEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { annotationsToTimelineEvents } from "@/services/annotation-mappers";

import {
  DesktopDetailsPanel,
  MobileDetailsDrawer,
} from "./match-view/details-drawer";
import {
  DesktopEventRail,
  MobileEventRail,
} from "./match-view/event-rail";
import type { EventButtonOrientation } from "./match-view/event-button";
import { MatchScoreHeader } from "./match-view/match-score-header";
import { MatchToolbar } from "./match-view/match-toolbar";
import { MobileCommentaryToast } from "./match-view/mobile-commentary-toast";
import { ProbabilityChart } from "./probability-chart";

export function MatchView({
  followLatest = true,
  state,
  selectedEvent,
  selectedEventId,
  onSelectEvent,
}: {
  followLatest?: boolean;
  state: LiveMatchState;
  selectedEvent: MatchEvent | null;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
}) {
  const { fixture, currentProbabilities, history, events, annotations, connectionState } = state;
  const timelineEvents =
    annotations.length > 0
      ? annotationsToTimelineEvents(annotations, fixture)
      : events;
  const selectedTimelineEvent =
    timelineEvents.find((event) => event.eventId === selectedEventId) ?? selectedEvent;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mobilePrioritizedEventId, setMobilePrioritizedEventId] = useState<string | null>(null);
  const [eventRailOpen, setEventRailOpen] = useState(true);
  const verticalEventButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const horizontalEventButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  function scrollEventButtonIntoView(eventId: string) {
    const verticalNode = verticalEventButtonRefs.current.get(eventId);
    const horizontalNode = horizontalEventButtonRefs.current.get(eventId);

    if (verticalNode?.offsetParent) {
      verticalNode.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      return;
    }

    if (horizontalNode?.offsetParent) {
      horizontalNode.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }

  function setEventButtonRef(
    eventId: string,
    node: HTMLButtonElement | null,
    orientation: EventButtonOrientation,
  ) {
    const refMap =
      orientation === "horizontal"
        ? horizontalEventButtonRefs.current
        : verticalEventButtonRefs.current;

    if (node) {
      refMap.set(eventId, node);
      if (eventId === selectedEventId) {
        window.requestAnimationFrame(() => scrollEventButtonIntoView(eventId));
      }
      return;
    }

    refMap.delete(eventId);
  }

  useEffect(() => {
    if (!selectedEventId) return;
    const frame = window.requestAnimationFrame(() => scrollEventButtonIntoView(selectedEventId));
    return () => window.cancelAnimationFrame(frame);
  }, [selectedEventId, events.length]);

  return (
    <div className="flex min-h-full flex-col bg-[var(--background)] text-[var(--terminal-text)] xl:h-full xl:overflow-hidden">
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22 }}
        className={cn(
          "grid min-h-full flex-1 grid-cols-1 overflow-y-auto bg-[linear-gradient(90deg,rgba(25,239,140,0.03)_1px,transparent_1px),linear-gradient(rgba(127,174,202,0.04)_1px,transparent_1px)] bg-[size:28px_28px] xl:min-h-0 xl:overflow-hidden",
          eventRailOpen ? "xl:grid-cols-[auto_1fr]" : "xl:grid-cols-1",
        )}
      >
        {eventRailOpen ? (
          <DesktopEventRail
            connectionState={connectionState}
            events={events}
            fixture={fixture}
            onSelectEvent={onSelectEvent}
            onToggle={() => setEventRailOpen(false)}
            selectedEventId={selectedEventId}
            setEventRef={setEventButtonRef}
          />
        ) : null}

        <section className="flex min-h-0 min-w-0 w-full flex-col overflow-visible xl:overflow-hidden">
          {eventRailOpen ? (
            <MobileEventRail
              connectionState={connectionState}
              events={events}
              fixture={fixture}
              onSelectEvent={(eventId) => {
                onSelectEvent(eventId);
                setMobilePrioritizedEventId(eventId);
                setDetailsOpen(true);
              }}
              onToggle={() => setEventRailOpen(false)}
              selectedEventId={selectedEventId}
              setEventRef={setEventButtonRef}
            />
          ) : null}

          {!eventRailOpen ? (
            <Button
              type="button"
              onClick={() => setEventRailOpen(true)}
              className="fixed left-3 top-16 z-30 hidden h-8 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-2 font-mono text-[0.68rem] uppercase text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)] xl:flex"
            >
              <Eye className="h-4 w-4" />
              Events
            </Button>
          ) : null}

          <MatchScoreHeader currentProbabilities={currentProbabilities} fixture={fixture} lastUpdatedAt={state.lastUpdatedAt} />
          <MatchToolbar
            detailsOpen={detailsOpen}
            eventRailOpen={eventRailOpen}
            onShowEvents={() => setEventRailOpen(true)}
            onToggleDetails={() => {
              setMobilePrioritizedEventId(null);
              setDetailsOpen((open) => !open);
            }}
          />

          <motion.section
            layout
            className={cn(
              "grid min-h-0 flex-1 gap-0 overflow-visible xl:overflow-hidden",
              detailsOpen ? "xl:grid-cols-[minmax(0,1fr)_20rem]" : "grid-cols-1",
            )}
          >
            <motion.div layout className="min-h-0 min-w-0 w-full overflow-visible p-2 sm:p-5 xl:overflow-hidden">
              <ProbabilityChart
                teamACode={fixture.teamACode}
                teamBCode={fixture.teamBCode}
                history={history}
                events={timelineEvents}
                selectedEvent={selectedTimelineEvent}
                connectionState={connectionState}
                analytics={state.analytics}
                followLatest={followLatest}
                showFeedStatus={followLatest}
                onSelectEvent={onSelectEvent}
              />
            </motion.div>
            <DesktopDetailsPanel
              annotations={annotations}
              open={detailsOpen}
              selectedEventId={selectedEventId}
            />
          </motion.section>
        </section>
      </motion.main>

      <MobileDetailsDrawer
        annotations={annotations}
        onClose={() => {
          setDetailsOpen(false);
          setMobilePrioritizedEventId(null);
        }}
        open={detailsOpen}
        prioritizeSelected={mobilePrioritizedEventId === selectedEventId}
        selectedEventId={selectedEventId}
      />
      <MobileCommentaryToast
        annotations={annotations}
        enabled={fixture.status === "live"}
      />
    </div>
  );
}
