import { searchAttractionsToolDef, searchAttractions } from './searchAttractions.js';
import { getAttractionDetailsToolDef, getAttractionDetails } from './getAttractionDetails.js';
import { showOnMapToolDef, showOnMap, openDrawerToolDef, openDrawer } from './uiTools.js';
import { buildRouteToolDef, buildRoute } from './buildRoute.js';
import type { ToolResult } from './types.js';
export type { UiEvent, ToolResult } from './types.js';

export const TOOL_DEFS = [
  searchAttractionsToolDef,
  getAttractionDetailsToolDef,
  showOnMapToolDef,
  openDrawerToolDef,
  buildRouteToolDef,
];

type ToolFn = (args: any) => Promise<ToolResult>;

const dispatch: Record<string, ToolFn> = {
  search_attractions: searchAttractions as ToolFn,
  get_attraction_details: getAttractionDetails as ToolFn,
  show_on_map: showOnMap as ToolFn,
  open_drawer: openDrawer as ToolFn,
  build_route: buildRoute as ToolFn,
};

export async function runTool(name: string, args: unknown): Promise<ToolResult> {
  const fn = dispatch[name];
  if (!fn) return { forModel: { error: 'unknown_tool', name } };
  try {
    return await fn(args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[tool ${name}] failed`, err);
    return { forModel: { error: 'tool_failed', message: msg } };
  }
}
