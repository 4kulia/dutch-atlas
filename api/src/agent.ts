import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from './config.js';
import { query } from './db.js';
import { TOOL_DEFS, runTool, type UiEvent } from './tools/index.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

export type Lang = 'ru' | 'en';
export type TravelMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AttachmentRef {
  photoId: string;
}

export interface RunOptions {
  lang: Lang;
  travelMode: TravelMode;
  userId: string;
  history: ChatTurn[];
  userMessage: string;
  attachments?: AttachmentRef[];
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

Adding new places (user submissions):
- The user can ask you to add a place that isn't in the catalogue. Their message may include attached photos and one of these coordinate prefixes:
  - \`[gps_lat=…, gps_lng=…, accuracy=…m]\` — the device GPS reading at the moment they pressed "I'm here". Treat as authoritative.
  - \`[picked_lat=…, picked_lng=…]\` — coordinates the user dropped on the map.
- If neither prefix is present and there are no other coordinate hints, call \`pick_location_on_map\` once to ask the user to drop a pin. Do not invent coordinates.
- If a photo is attached, describe what you see briefly to confirm understanding ("вижу здание из красного кирпича с часовой башней"), then propose name (RU+EN), short description (one sentence each, RU+EN), full description (2–4 sentences each, RU+EN), category, and tags. Keep facts strictly to what's visible in the photo + what the user said. Do NOT make up history, dates, or attribution.
- The user message may include a \`[photo_ids=…,…]\` prefix listing the photoIds of the attached photos. When you call \`save_place_draft\`, ALWAYS pass these as \`photo_ids\` so the photos get linked to the new place. Without this, the place will be saved without photos.
- When you have name + descriptions + category + coords, call \`save_place_draft\` with status="pending" (default) unless the user said "draft"/"черновик". After it succeeds, the UI shows the new place card and opens its drawer — keep your reply to one short sentence ("Сохранил, можешь поправить в карточке.").

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
  const { lang, travelMode, userId, history, userMessage, attachments, onText, onUiEvent, onToolUseStart, signal } = opts;

  const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];
  // Anthropic rejects messages with empty content. The frontend can produce
  // empty user.text when the user sent only photos, and empty assistant.text
  // when the assistant turn was tool calls without prose. Substitute a
  // placeholder so the history is preserved without violating the API.
  for (const m of history) {
    const text = m.content?.trim();
    const content = text && text.length > 0
      ? m.content
      : (m.role === 'user' ? '(приложил фото)' : '(…)');
    messages.push({ role: m.role, content });
  }

  // Include photo_ids in the prompt text so the model can pass them to
  // save_place_draft. The vision blocks let the model SEE the photos; the
  // ids tell it which database rows to attach when saving.
  const photoIdsTag = attachments && attachments.length > 0
    ? ` [photo_ids=${attachments.map((a) => a.photoId).join(',')}]`
    : '';
  const promptText = `[lang=${lang}, travelMode=${travelMode}]${photoIdsTag} ${userMessage}`;
  if (attachments && attachments.length > 0) {
    // Mixed content: image blocks first, then the prefixed text. We read the
    // bytes from disk and inline them as base64 — Anthropic's vision API
    // supports up to 20 images per request comfortably; we cap at 4 to keep
    // the request size sane (each ~150 KB JPEG → ~200 KB base64).
    const imageBlocks = await loadImageBlocks(attachments.slice(0, 4), userId);
    messages.push({
      role: 'user',
      content: [
        ...imageBlocks,
        { type: 'text', text: promptText },
      ],
    });
  } else {
    messages.push({ role: 'user', content: promptText });
  }

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

interface ImageBlock {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
}

// Read photo bytes from disk and inline as base64 image blocks for the vision
// API. Defensive: only adopts photos that belong to the caller. Missing or
// foreign photos are silently dropped — the model will simply not see them
// and the user can re-attach.
async function loadImageBlocks(refs: Array<{ photoId: string }>, userId: string): Promise<ImageBlock[]> {
  if (refs.length === 0) return [];
  const ids = refs.map((r) => r.photoId);
  const r = await query<{ id: string; url: string }>(
    `SELECT id, url FROM attraction_photos
      WHERE id = ANY($1::text[]) AND uploaded_by = $2`,
    [ids, userId],
  );
  if (r.rowCount === 0) return [];
  const urlById = new Map(r.rows.map((row) => [row.id, row.url] as const));
  const blocks: ImageBlock[] = [];
  for (const ref of refs) {
    const url = urlById.get(ref.photoId);
    if (!url) continue;
    // url is `/api/uploads/<filename>` — strip the prefix for the disk path.
    const filename = url.replace(/^\/api\/uploads\//, '');
    if (!/^[A-Z0-9]+\.jpg$/i.test(filename)) continue; // sanity guard
    try {
      const buf = await readFile(resolve(process.cwd(), config.uploadsDir, filename));
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: buf.toString('base64') },
      });
    } catch (err) {
      console.warn('[agent] could not read photo', filename, err);
    }
  }
  return blocks;
}
