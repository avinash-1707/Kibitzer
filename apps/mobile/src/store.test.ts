import { expect, test, describe, beforeEach } from "bun:test";
import { useFeedStore, selectDramaScore, selectOrder } from "./store.ts";
import type { FeedItem } from "@kibitzer/shared";

function feedItem(id: string, over: Partial<FeedItem> = {}): FeedItem {
  return {
    event: {
      id,
      sessionId: "s1",
      source: "opencode",
      type: "tool_call",
      timestamp: "2026-08-30T00:00:00.000Z",
      detail: {},
    },
    dramaScore: 0,
    narration: null,
    audioUrl: null,
    ...over,
  };
}

const s = () => useFeedStore.getState();

describe("feed store frame merge", () => {
  beforeEach(() => s().reset());

  test("score before narration: meter reacts, no fake feed item", () => {
    s().setScore("e1", 70);
    expect(selectDramaScore(s())).toBe(70);
    expect(selectOrder(s())).toEqual([]); // no placeholder item created

    s().upsertItem(feedItem("e1", { narration: "boom" }));
    expect(selectOrder(s())).toEqual(["e1"]);
    expect(s().items["e1"].dramaScore).toBe(70); // score carried onto the item
    expect(s().items["e1"].narration).toBe("boom");
  });

  test("narration then audio attaches, unknown audio is ignored", () => {
    s().upsertItem(feedItem("e1", { narration: "hi" }));
    s().attachAudio("e1", "/api/tts?eventId=e1");
    expect(s().items["e1"].audioUrl).toBe("/api/tts?eventId=e1");

    s().attachAudio("ghost", "/api/tts?eventId=ghost");
    expect(s().items["ghost"]).toBeUndefined();
    expect(selectOrder(s())).toEqual(["e1"]);
  });

  test("a real drama score of 0 is not overwritten by a later frame", () => {
    s().setScore("e1", 0);
    s().upsertItem(feedItem("e1", { dramaScore: 42, narration: "x" }));
    expect(s().items["e1"].dramaScore).toBe(0); // explicit score wins via ??
  });

  test("replay dedupes and never clears live narration", () => {
    s().upsertItem(feedItem("e1", { narration: "live" }));
    s().upsertItem(feedItem("e1", { narration: null })); // stray replay
    expect(selectOrder(s())).toEqual(["e1"]);
    expect(s().items["e1"].narration).toBe("live");
  });

  test("resetFeed keeps session/persona; reset clears all", () => {
    s().setSession("sess-1");
    s().setPersona("sports");
    s().upsertItem(feedItem("e1"));
    s().resetFeed();
    expect(selectOrder(s())).toEqual([]);
    expect(s().sessionId).toBe("sess-1");
    expect(s().persona).toBe("sports");

    s().reset();
    expect(s().sessionId).toBeNull();
    expect(s().persona).toBeNull();
  });
});
