import { z } from "zod";

export const TurnSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string(),
});
export type Turn = z.infer<typeof TurnSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().nullish(),
  history: z.array(TurnSchema).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** Inbound /live text messages (binary frames are 24kHz PCM audio, handled separately). */
export const LiveMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({
    type: z.literal("card"),
    url: z.string(),
    title: z.string(),
    subtitle: z.string().optional(),
    brand: z.string().optional(),
  }),
  z.object({ type: z.literal("user"), text: z.string() }),
  z.object({ type: z.literal("bot"), text: z.string() }),
  z.object({ type: z.literal("interrupted") }),
  z.object({ type: z.literal("turn") }),
  z.object({ type: z.literal("guardrail"), text: z.string() }),
  z.object({ type: z.literal("info"), text: z.string() }),
  z.object({ type: z.literal("error"), text: z.string() }),
]);
export type LiveMessage = z.infer<typeof LiveMessageSchema>;
