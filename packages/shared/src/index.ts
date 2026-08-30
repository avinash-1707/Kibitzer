// @kibitzer/shared — the frozen contract. Import types + pure fns from here.
export type {
  EventSource,
  EventType,
  Outcome,
  KibitzerEventDetail,
  KibitzerEvent,
  FeedItem,
  Analytics,
  Devpost,
  PersonaKey,
  HelloFrame,
  ScoreFrame,
  AudioFrame,
  PersonaFrame,
  SseFrameKind,
} from "./event.ts";
export { eventSchema, eventDetailSchema, parseEvent } from "./event.ts";
export { isDestructive } from "./classify.ts";
export { dramaScore, shouldNarrate } from "./drama.ts";
export { describeEvent, templatedFallback } from "./describe.ts";
