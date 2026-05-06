import { searchAttractionsToolDef, searchAttractions } from './searchAttractions.js';
import { getAttractionDetailsToolDef, getAttractionDetails } from './getAttractionDetails.js';
import {
  showOnMapToolDef,
  showOnMap,
  openDrawerToolDef,
  openDrawer,
  pickLocationOnMapToolDef,
  pickLocationOnMap,
} from './uiTools.js';
import { buildRouteToolDef, buildRoute } from './buildRoute.js';
import { savePlaceDraftToolDef, savePlaceDraft } from './savePlaceDraft.js';
import type { ToolResult } from './types.js';
export type { UiEvent, ToolResult } from './types.js';

export interface ToolContext {
  userId: string;
}

export const TOOL_DEFS = [
  searchAttractionsToolDef,
  getAttractionDetailsToolDef,
  showOnMapToolDef,
  openDrawerToolDef,
  buildRouteToolDef,
  pickLocationOnMapToolDef,
  savePlaceDraftToolDef,
];

type ToolFn = (args: any, ctx: ToolContext) => Promise<ToolResult>;

const dispatch: Record<string, ToolFn> = {
  search_attractions: searchAttractions as ToolFn,
  get_attraction_details: getAttractionDetails as ToolFn,
  show_on_map: showOnMap as ToolFn,
  open_drawer: openDrawer as ToolFn,
  build_route: buildRoute as ToolFn,
  pick_location_on_map: pickLocationOnMap as ToolFn,
  save_place_draft: savePlaceDraft as ToolFn,
};

export async function runTool(name: string, args: unknown, ctx: ToolContext): Promise<ToolResult> {
  const fn = dispatch[name];
  if (!fn) return { forModel: { error: 'unknown_tool', name } };
  try {
    return await fn(args, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[tool ${name}] failed`, err);
    return { forModel: { error: 'tool_failed', message: msg } };
  }
}
