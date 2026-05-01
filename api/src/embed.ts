import { config } from './config.js';

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { total_tokens: number };
}

// Voyage embeddings — used for live query embedding inside the agent.
// Indexing (offline, document-side) lives in scripts/seed-attractions.mjs.
export async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.voyageApiKey}`,
    },
    body: JSON.stringify({
      model: config.voyageModel,
      input: [text],
      input_type: 'query',
    }),
  });
  if (!res.ok) {
    throw new Error(`Voyage HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as VoyageResponse;
  const v = json.data[0]?.embedding;
  if (!v) throw new Error('Voyage returned no embedding');
  return v;
}
