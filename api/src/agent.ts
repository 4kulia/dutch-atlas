import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { TOOL_DEFS, runTool, type UiEvent } from './tools/index.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

export type Lang = 'ru' | 'en';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface RunOptions {
  lang: Lang;
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

Tools:
- Use \`search_attractions\` whenever the user describes places by interest, vibe, or feature. Always pass \`lang\` matching the language of the user's message. Use \`near\` when they mention a city or current location, and \`categories\` when they specify a place type. Don't try to recall the catalogue from memory — always search.
- Use \`get_attraction_details\` when you need the full description to reason carefully about a place.
- Use \`show_on_map\` once you have a final shortlist (3–6 places) so the user sees them on the map.
- Use \`open_drawer\` only when the user explicitly wants to see one place in depth.

Style:
- Match the user's language (Russian or English).
- Be concise. Lead with the answer, then 1–2 lines of justification per pick.
- Don't dump JSON or repeat the full description — the UI renders cards from the search results automatically.
- Don't invent places, hours, or events. If the user asks about something time-sensitive (weather, opening hours), tell them you don't have live data yet.
- Variety beats popularity — don't recommend the same five tourist hits for every query.
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
  const { lang, history, userMessage, onText, onUiEvent, onToolUseStart, signal } = opts;

  const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];
  for (const m of history) messages.push({ role: m.role, content: m.content });
  messages.push({ role: 'user', content: `[lang=${lang}] ${userMessage}` });

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
      const result = await runTool(tu.name, tu.input);
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
