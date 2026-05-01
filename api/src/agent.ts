import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { TOOL_DEFS, runTool, type UiEvent } from './tools/index.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

export type Lang = 'ru' | 'en';
export type TravelMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface RunOptions {
  lang: Lang;
  travelMode: TravelMode;
  userId: string;
  history: ChatTurn[];
  userMessage: string;
  signal: AbortSignal;
  onText: (delta: string) => void;
  onUiEvent: (event: UiEvent) => void;
  onToolUseStart: (info: { name: string; id: string; input: unknown }) => void;
}

const SYSTEM_PROMPT = `
You are Atlas, a friendly Dutch-trip assistant embedded in a map of ~99 hand-picked Netherlands attractions (cities, villages, castles, hydraulic works, nature parks, plus the Caribbean overseas territories).

Your job is to help signed-in users find places by meaning, plan day trips, and answer questions about the catalogue.

Each user message is prefixed with [lang=…, travelMode=…]. The travelMode is what the user has selected in the UI (DRIVING, WALKING, BICYCLING, or TRANSIT). Treat it as their default for any route. The first time the user asks for a route or itinerary, briefly confirm the mode in one short line ("Беру за основу автомобиль, ок?" / "Going with cycling — ok?") and then proceed; don't ask again unless they change topic.

Tools:
- Use \`search_attractions\` whenever the user describes places by interest, vibe, or feature. Always pass \`lang\` matching the user's message. Use \`near\` when they mention a city, and \`categories\` when they specify a place type. Don't try to recall the catalogue from memory — always search.
  - By default the user wants new places — \`search_attractions\` excludes places they've already marked as visited automatically. You normally do NOT need to think about this.
  - Pass \`exclude_visited: false\` ONLY when the user explicitly references their visited places ("куда я уже ездил подходит?", "что-то знакомое", "place I've been to"). Pass \`visited_only: true\` for explicit "show my visited" / "where have I been" queries.
  - When you DO include visited places in the answer, mention it briefly in your reply ("включил места, где ты уже был").
- Use \`get_attraction_details\` when you need the full description to reason carefully about a place.
- Use \`show_on_map\` for a flat shortlist of 3–6 places (no order) so the user sees them on the map.
- Use \`build_route\` whenever the user asks for an itinerary, a tour, "a day", "a weekend", or a "route" — anything with order. Group stops into days. The frontend draws a colour-coded path on the map and shows numbered markers; it ALSO renders a structured route card in the chat. Don't ALSO call \`show_on_map\` for the same places.
- Use \`open_drawer\` only when the user explicitly wants to see one place in depth.

Style:
- Match the user's language (Russian or English).
- Be concise. Lead with the answer; 1–2 lines of justification per pick.
- The UI auto-renders cards from \`search_attractions\` results and a structured stop-by-stop card from \`build_route\` results. Therefore:
  - After \`search_attractions\` succeeds, do NOT repeat the list as bullet points or numbered text — the cards are right below your reply.
  - After \`build_route\` succeeds, do NOT redescribe the route in markdown (no headers, no per-stop details, no "Day 1: 1. Place — note" lists). One short framing sentence is enough ("Готов вариант на день, посмотри карту."). The card already contains the times, distances, and stop notes.
- Don't invent live data (weather, hours, events). If asked, say you don't have it yet.
- Variety beats popularity. Don't recommend the same five tourist hits for every query.
`.trim();

interface AnthropicTextDelta {
  type: 'text_delta';
  text: string;
}
interface AnthropicInputJsonDelta {
  type: 'input_json_delta';
  partial_json: string;
}
interface AnthropicContentBlockToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export async function runChat(opts: RunOptions): Promise<{
  usage: { inputTokens: number; outputTokens: number };
  reply: string;
}> {
  const { lang, travelMode, userId, history, userMessage, onText, onUiEvent, onToolUseStart, signal } = opts;

  const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];
  for (const m of history) messages.push({ role: m.role, content: m.content });
  messages.push({
    role: 'user',
    content: `[lang=${lang}, travelMode=${travelMode}] ${userMessage}`,
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let assembledReply = '';

  for (let turn = 0; turn < config.agentMaxTurns; turn++) {
    if (signal.aborted) break;

    const stream = anthropic.messages.stream(
      {
        model: config.modelToolUse,
        max_tokens: 1024,
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ] as any,
        tools: TOOL_DEFS as any,
        messages,
      },
      { signal },
    );

    for await (const event of stream) {
      if (signal.aborted) break;

      if (event.type === 'content_block_delta') {
        const delta = event.delta as AnthropicTextDelta | AnthropicInputJsonDelta;
        if (delta.type === 'text_delta') {
          assembledReply += delta.text;
          onText(delta.text);
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    totalInputTokens += finalMessage.usage.input_tokens ?? 0;
    totalOutputTokens += finalMessage.usage.output_tokens ?? 0;

    if (finalMessage.stop_reason === 'end_turn' || finalMessage.stop_reason !== 'tool_use') {
      return {
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        reply: assembledReply,
      };
    }

    // Tool use — append assistant turn, run each tool, push results.
    messages.push({ role: 'assistant', content: finalMessage.content as any });

    const toolUses = finalMessage.content.filter(
      (b): b is AnthropicContentBlockToolUse => b.type === 'tool_use',
    );
    const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

    for (const tu of toolUses) {
      onToolUseStart({ name: tu.name, id: tu.id, input: tu.input });
      const result = await runTool(tu.name, tu.input, { userId });
      if (result.uiEvents) for (const evt of result.uiEvents) onUiEvent(evt);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result.forModel),
      });
    }

    messages.push({ role: 'user', content: toolResults as any });
  }

  return {
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    reply: assembledReply,
  };
}
