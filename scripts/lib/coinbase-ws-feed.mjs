/** Channels whose inbound frames use this name (subscribe still uses `level2`). */
export const LEVEL2_FEED_CHANNELS = new Set(["l2_data", "level2"]);

function asCounter(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Track `sequence_num` per inbound channel and `heartbeat_counter`.
 * A gap means frames were missed. For level2, the local book may be stale.
 */
export function createFeedTracker() {
  /** Connection-wide: Coinbase increments `sequence_num` across every channel. */
  let lastSequence = null;
  const lastByChannel = new Map();
  let lastHeartbeatCounter = null;

  return {
    observe(payload) {
      const gaps = [];
      let resubscribeLevel2 = false;
      let heartbeat = null;

      if (payload && typeof payload.sequence_num === "number") {
        if (lastSequence !== null && payload.sequence_num !== lastSequence + 1) {
          gaps.push({
            kind: "sequence",
            channel: payload.channel || "unknown",
            expected: lastSequence + 1,
            received: payload.sequence_num,
          });
          resubscribeLevel2 = true;
        }
        lastSequence = payload.sequence_num;
        if (payload.channel) lastByChannel.set(payload.channel, payload.sequence_num);
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
    reset(channel) {
      if (channel) {
        lastByChannel.delete(channel);
        for (const name of LEVEL2_FEED_CHANNELS) {
          if (channel === name || channel === "level2") lastByChannel.delete(name);
        }
      } else {
        lastSequence = null;
        lastByChannel.clear();
      }
    },
    resetHeartbeat() {
      lastHeartbeatCounter = null;
    },
    snapshot() {
      return {
        lastSequence,
        sequences: Object.fromEntries(lastByChannel),
        heartbeatCounter: lastHeartbeatCounter,
      };
    },
  };
}

export function formatGap(gap) {
  return `${gap.kind} gap on ${gap.channel}: expected ${gap.expected}, received ${gap.received}`;
}
