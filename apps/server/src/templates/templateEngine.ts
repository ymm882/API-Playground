import type { ApiTemplate, ModelConfig, ParsedTemplateResponse } from "../types.js";

type RenderedTemplate = {
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
  params: Record<string, unknown>;
};

export function renderTemplate(template: ApiTemplate, model: ModelConfig, userParams: Record<string, unknown>, apiKey: string, options: { skipRequired?: boolean } = {}): RenderedTemplate {
  const params = mergeParams(template, model, userParams);
  const variables = {
    ...params,
    api_key: apiKey,
    model: model.id
  };

  if (!options.skipRequired) validateRequiredParams(template, params);

  const renderedHeaders = renderValue(template.headers_template ?? {}, variables) as Record<string, unknown>;
  const renderedBody = template.method === "GET" ? undefined : (renderValue(template.body_template ?? {}, variables) as Record<string, unknown>);

  return {
    headers: Object.fromEntries(Object.entries(renderedHeaders).map(([key, value]) => [key, String(value)])),
    body: renderedBody,
    params
  };
}

export function renderPath(path: string, variables: Record<string, unknown>) {
  return path.replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => encodeURIComponent(String(variables[key] ?? "")));
}

export function parseResponseByTemplate(responseJson: unknown, responseParser: Record<string, unknown> | undefined): ParsedTemplateResponse {
  const parser = responseParser ?? {};

  return {
    content: String(getByPath(responseJson, String(parser.content_path ?? "")) ?? ""),
    image_urls: getArrayByPath(responseJson, String(parser.image_urls_path ?? "")),
    video_urls: getArrayByPath(responseJson, String(parser.video_urls_path ?? "")),
    task_id: firstPath(responseJson, (parser.task_id_paths as string[] | undefined) ?? ["task_id", "id", "data.task_id"]),
    status: String(getByPath(responseJson, String(parser.status_path ?? "status")) ?? ""),
    progress: Number(getByPath(responseJson, String(parser.progress_path ?? "progress")) ?? 0),
    usage: getByPath(responseJson, String(parser.usage_path ?? "usage")) ?? {},
    raw: responseJson
  };
}

function mergeParams(template: ApiTemplate, model: ModelConfig, userParams: Record<string, unknown>) {
  const schemaDefaults = Object.fromEntries((template.params_schema ?? []).map((item) => [String(item.key), item.default]));
  return {
    ...schemaDefaults,
    ...(template.default_params ?? {}),
    ...(model.default_params ?? {}),
    ...(model.default_params_override ?? {}),
    ...userParams
  };
}

function validateRequiredParams(template: ApiTemplate, params: Record<string, unknown>) {
  for (const item of template.params_schema ?? []) {
    const key = String(item.key);
    const value = params[key];

    if (item.required && (value === undefined || value === null || value === "")) {
      throw new Error(`缺少必填参数：${item.label ?? key}`);
    }
  }
}

function renderValue(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const wholeMatch = value.match(/^\{\{([\w.]+)\}\}$/);
    if (wholeMatch) return variables[wholeMatch[1]] ?? "";
    return value.replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => String(variables[key] ?? ""));
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => renderValue(item, variables))
      .filter((item) => !isEmptyMessage(item));
  }

  if (typeof value === "object" && value) {
    return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [key, renderValue(entryValue, variables)]));
  }

  return value;
}

function isEmptyMessage(value: unknown) {
  if (typeof value !== "object" || !value) return false;
  const record = value as Record<string, unknown>;
  return record.role === "system" && record.content === "";
}

function firstPath(source: unknown, paths: string[]) {
  for (const path of paths) {
    const value = getByPath(source, path);
    if (value !== undefined && value !== null && value !== "") return String(value);
  }

  return "";
}

function getArrayByPath(source: unknown, path: string) {
  if (!path) return [];

  if (path.includes("[].")) {
    const [arrayPath, childPath] = path.split("[].");
    const rows = getByPath(source, arrayPath);
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => getByPath(row, childPath)).filter((value): value is string => typeof value === "string");
  }

  const value = getByPath(source, path);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getByPath(source: unknown, path: string): unknown {
  if (!path) return undefined;
  const normalized = path.replace(/\[(\d+)\]/g, ".$1");
  return normalized.split(".").filter(Boolean).reduce<unknown>((current, part) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) return current[Number(part)];
    if (typeof current === "object") return (current as Record<string, unknown>)[part];
    return undefined;
  }, source);
}
