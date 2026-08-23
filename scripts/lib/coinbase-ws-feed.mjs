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
  const lastSequence = new Map();
  let lastHeartbeatCounter = null;

  return {
    observe(payload) {
      const gaps = [];
      let resubscribeLevel2 = false;
      let heartbeat = null;

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
    reset(channel) {
      if (channel) {
        lastSequence.delete(channel);
        for (const name of LEVEL2_FEED_CHANNELS) {
          if (channel === name || channel === "level2") lastSequence.delete(name);
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

export function formatGap(gap) {
  return `${gap.kind} gap on ${gap.channel}: expected ${gap.expected}, received ${gap.received}`;
}
