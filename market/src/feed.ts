/** Channels whose inbound frames use this name (subscribe still uses `level2`). */
export const LEVEL2_FEED_CHANNELS = new Set(["l2_data", "level2"]);

export type SequenceGap = {
  kind: "sequence" | "heartbeat";
  channel: string;
  expected: number;
  received: number;
};

export type HeartbeatTick = {
  counter: number;
  currentTime: string;
};

export type ObserveResult = {
  gaps: SequenceGap[];
  resubscribeLevel2: boolean;
  heartbeat: HeartbeatTick | null;
};

function asCounter(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Track `sequence_num` per inbound channel and `heartbeat_counter`.
 * A gap means frames were missed. For level2, the local book may be stale.
 */
export function createFeedTracker() {
  const lastSequence = new Map<string, number>();
  let lastHeartbeatCounter: number | null = null;

  return {
    observe(payload: {
      channel?: string;
      sequence_num?: number;
      timestamp?: string;
      events?: Array<{ heartbeat_counter?: unknown; current_time?: string }>;
    }): ObserveResult {
      const gaps: SequenceGap[] = [];
      let resubscribeLevel2 = false;
      let heartbeat: HeartbeatTick | null = null;

      if (payload && typeof payload.sequence_num === "number" && payload.channel) {
        const last = lastSequence.get(payload.channel);
        if (last !== undefined && payload.sequence_num !== last + 1) {
          gaps.push({
            kind: "sequence",
            channel: payload.channel,
            expected: last + 1,
            received: payload.sequence_num,
          });
          if (LEVEL2_FEED_CHANNELS.has(payload.channel)) resubscribeLevel2 = true;
        }
        lastSequence.set(payload.channel, payload.sequence_num);
      }

      if (payload?.channel === "heartbeats") {
        for (const event of payload.events || []) {
          const counter = asCounter(event.heartbeat_counter);
          if (counter === null) continue;
          if (lastHeartbeatCounter !== null && counter !== lastHeartbeatCounter + 1) {
            gaps.push({
              kind: "heartbeat",
              channel: "heartbeats",
              expected: lastHeartbeatCounter + 1,
              received: counter,
            });
          }
          lastHeartbeatCounter = counter;
          heartbeat = {
            counter,
            currentTime: event.current_time || payload.timestamp || "",
          };
        }
      }

      return { gaps, resubscribeLevel2, heartbeat };
    },
    reset(channel?: string) {
      if (channel) {
        lastSequence.delete(channel);
        if (channel === "level2" || LEVEL2_FEED_CHANNELS.has(channel)) {
          for (const name of LEVEL2_FEED_CHANNELS) lastSequence.delete(name);
        }
      } else {
        lastSequence.clear();
      }
    },
    resetHeartbeat() {
      lastHeartbeatCounter = null;
    },
    snapshot() {
      return {
        sequences: Object.fromEntries(lastSequence),
        heartbeatCounter: lastHeartbeatCounter,
      };
    },
  };
}

export function formatGap(gap: SequenceGap) {
  return `${gap.kind} gap on ${gap.channel}: expected ${gap.expected}, received ${gap.received}`;
}
