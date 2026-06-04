import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "../config.js";
import { initialAppConfig, initialModels } from "../models/initialModels.js";
import { initialTemplates } from "../models/initialTemplates.js";
import type { ApiTemplate, AppConfig, ModelConfig } from "../types.js";

export type ModelRow = {
  id: string;
  name: string;
  provider: string;
  category: string;
  invoke_mode: string;
  endpoint_type: string;
  supports_stream: number;
  supports_native_example: number;
  response_mode: string | null;
  default_params: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
  template_id: string | null;
  description: string | null;
  tags: string | null;
  sort_order: number | null;
  default_params_override: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
  category: string;
  protocol: string;
  method: string;
  path: string;
  is_async: number;
  task_query_path: string | null;
  headers_template: string | null;
  body_template: string | null;
  params_schema: string | null;
  default_params: string | null;
  response_example: string | null;
  response_parser: string | null;
  code_templates: string | null;
  enabled: number;
};

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });
    db = new Database(env.databasePath);
    db.pragma("journal_mode = WAL");
  }

  return db;
}

export function initDatabase() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      category TEXT NOT NULL,
      invoke_mode TEXT NOT NULL,
      endpoint_type TEXT NOT NULL,
      supports_stream INTEGER DEFAULT 0,
      supports_native_example INTEGER DEFAULT 0,
      response_mode TEXT,
      default_params TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      protocol TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      is_async INTEGER DEFAULT 0,
      task_query_path TEXT,
      headers_template TEXT,
      body_template TEXT,
      params_schema TEXT,
      default_params TEXT,
      response_example TEXT,
      response_parser TEXT,
      code_templates TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureModelColumns(database);
  seedTemplates(database);
  seedModels(database);
  bindInitialModels(database);
  seedAppConfig(database);
}

export function listEnabledModels(): ModelConfig[] {
  const rows = getDb()
    .prepare("SELECT * FROM models WHERE enabled = 1 ORDER BY sort_order, category, provider, name")
    .all() as ModelRow[];

  return rows.map(mapModelRow);
}

export function listAllModels(): ModelConfig[] {
  const rows = getDb()
    .prepare("SELECT * FROM models ORDER BY category, provider, name")
    .all() as ModelRow[];

  return rows.map(mapModelRow);
}

export function getAppConfig(): AppConfig {
  const row = getDb().prepare("SELECT value FROM app_config WHERE key = ?").get("global") as { value: string } | undefined;

  if (!row) {
    return initialAppConfig;
  }

  return JSON.parse(row.value) as AppConfig;
}

export function saveAppConfig(config: AppConfig) {
  getDb()
    .prepare(
      `INSERT INTO app_config (key, value, updated_at)
       VALUES ('global', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    )
    .run(JSON.stringify(config, null, 2));

  return getAppConfig();
}

export function createModel(model: ModelConfig) {
  getDb()
    .prepare(
      `INSERT INTO models (
        id, name, provider, category, invoke_mode, endpoint_type,
        supports_stream, supports_native_example, response_mode, default_params, enabled
      ) VALUES (
        @id, @name, @provider, @category, @invoke_mode, @endpoint_type,
        @supports_stream, @supports_native_example, @response_mode, @default_params, @enabled
      )`
    )
    .run(toModelDbParams(model));

  return model;
}

export function updateModel(id: string, model: ModelConfig) {
  const result = getDb()
    .prepare(
      `UPDATE models SET
        id = @id,
        name = @name,
        provider = @provider,
        category = @category,
        invoke_mode = @invoke_mode,
        endpoint_type = @endpoint_type,
        supports_stream = @supports_stream,
        supports_native_example = @supports_native_example,
        response_mode = @response_mode,
        default_params = @default_params,
        enabled = @enabled,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @old_id`
    )
    .run({
      ...toModelDbParams(model),
      old_id: id
    });

  return result.changes > 0;
}

export function deleteModel(id: string) {
  const result = getDb().prepare("DELETE FROM models WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getModelById(id: string): ModelConfig | undefined {
  const row = getDb().prepare("SELECT * FROM models WHERE id = ?").get(id) as ModelRow | undefined;
  return row ? mapModelRow(row) : undefined;
}

export function listTemplates(includeDisabled = false): ApiTemplate[] {
  const rows = getDb()
    .prepare(`SELECT * FROM api_templates ${includeDisabled ? "" : "WHERE enabled = 1"} ORDER BY category, name`)
    .all() as TemplateRow[];

  return rows.map(mapTemplateRow);
}

export function getTemplateById(id: string): ApiTemplate | undefined {
  const row = getDb().prepare("SELECT * FROM api_templates WHERE id = ?").get(id) as TemplateRow | undefined;
  return row ? mapTemplateRow(row) : undefined;
}

export function createTemplate(template: ApiTemplate) {
  getDb()
    .prepare(
      `INSERT INTO api_templates (
        id, name, category, protocol, method, path, is_async, task_query_path,
        headers_template, body_template, params_schema, default_params,
        response_example, response_parser, code_templates, enabled
      ) VALUES (
        @id, @name, @category, @protocol, @method, @path, @is_async, @task_query_path,
        @headers_template, @body_template, @params_schema, @default_params,
        @response_example, @response_parser, @code_templates, @enabled
      )`
    )
    .run(toTemplateDbParams(template));

  return template;
}

export function updateTemplate(id: string, template: ApiTemplate) {
  const result = getDb()
    .prepare(
      `UPDATE api_templates SET
        id = @id, name = @name, category = @category, protocol = @protocol,
        method = @method, path = @path, is_async = @is_async,
        task_query_path = @task_query_path, headers_template = @headers_template,
        body_template = @body_template, params_schema = @params_schema,
        default_params = @default_params, response_example = @response_example,
        response_parser = @response_parser, code_templates = @code_templates,
        enabled = @enabled, updated_at = CURRENT_TIMESTAMP
      WHERE id = @old_id`
    )
    .run({ ...toTemplateDbParams(template), old_id: id });

  return result.changes > 0;
}

export function deleteTemplate(id: string) {
  const usingCount = (getDb().prepare("SELECT COUNT(*) AS count FROM models WHERE template_id = ?").get(id) as { count: number }).count;

  if (usingCount > 0) {
    return { ok: false, reason: "模板正在被模型使用，请先解绑模型" };
  }

  const result = getDb().prepare("DELETE FROM api_templates WHERE id = ?").run(id);
  return { ok: result.changes > 0 };
}

function seedModels(database: Database.Database) {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO models (
      id,
      name,
      provider,
      category,
      invoke_mode,
      endpoint_type,
      supports_stream,
      supports_native_example,
      response_mode,
      default_params,
      template_id,
      description,
      tags,
      sort_order,
      default_params_override,
      enabled
    ) VALUES (
      @id,
      @name,
      @provider,
      @category,
      @invoke_mode,
      @endpoint_type,
      @supports_stream,
      @supports_native_example,
      @response_mode,
      @default_params,
      @template_id,
      @description,
      @tags,
      @sort_order,
      @default_params_override,
      @enabled
    )
  `);

  const transaction = database.transaction((models: ModelConfig[]) => {
    for (const model of models) {
      insert.run(toModelDbParams(withTemplateDefaults(model)));
    }
  });

  transaction(initialModels);
}

function ensureModelColumns(database: Database.Database) {
  const columns = (database.prepare("PRAGMA table_info(models)").all() as Array<{ name: string }>).map((column) => column.name);
  const addColumn = (name: string, sql: string) => {
    if (!columns.includes(name)) database.exec(sql);
  };

  addColumn("template_id", "ALTER TABLE models ADD COLUMN template_id TEXT");
  addColumn("description", "ALTER TABLE models ADD COLUMN description TEXT");
  addColumn("tags", "ALTER TABLE models ADD COLUMN tags TEXT");
  addColumn("sort_order", "ALTER TABLE models ADD COLUMN sort_order INTEGER DEFAULT 0");
  addColumn("default_params_override", "ALTER TABLE models ADD COLUMN default_params_override TEXT");
}

function seedTemplates(database: Database.Database) {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO api_templates (
      id, name, category, protocol, method, path, is_async, task_query_path,
      headers_template, body_template, params_schema, default_params,
      response_example, response_parser, code_templates, enabled
    ) VALUES (
      @id, @name, @category, @protocol, @method, @path, @is_async, @task_query_path,
      @headers_template, @body_template, @params_schema, @default_params,
      @response_example, @response_parser, @code_templates, @enabled
    )
  `);

  const transaction = database.transaction((templates: ApiTemplate[]) => {
    for (const template of templates) insert.run(toTemplateDbParams(template));
  });

  transaction(initialTemplates);
}

function bindInitialModels(database: Database.Database) {
  for (const model of initialModels.map(withTemplateDefaults)) {
    database
      .prepare("UPDATE models SET template_id = COALESCE(template_id, ?), description = COALESCE(description, ?), tags = COALESCE(tags, ?) WHERE id = ?")
      .run(model.template_id ?? null, model.description ?? "", JSON.stringify(model.tags ?? []), model.id);
  }
}

function seedAppConfig(database: Database.Database) {
  database
    .prepare("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)")
    .run("global", JSON.stringify(initialAppConfig, null, 2));
}

function toModelDbParams(model: ModelConfig) {
  return {
    ...model,
    supports_stream: model.supports_stream ? 1 : 0,
    supports_native_example: model.supports_native_example ? 1 : 0,
    response_mode: model.response_mode ?? null,
    default_params: model.default_params ? JSON.stringify(model.default_params) : null,
    template_id: model.template_id ?? defaultTemplateId(model),
    description: model.description ?? "",
    tags: JSON.stringify(model.tags ?? []),
    sort_order: model.sort_order ?? 0,
    default_params_override: model.default_params_override ? JSON.stringify(model.default_params_override) : null,
    enabled: model.enabled ? 1 : 0
  };
}

function toTemplateDbParams(template: ApiTemplate) {
  return {
    ...template,
    is_async: template.is_async ? 1 : 0,
    task_query_path: template.task_query_path ?? null,
    headers_template: stringifyNullable(template.headers_template),
    body_template: stringifyNullable(template.body_template),
    params_schema: stringifyNullable(template.params_schema),
    default_params: stringifyNullable(template.default_params),
    response_example: stringifyNullable(template.response_example),
    response_parser: stringifyNullable(template.response_parser),
    code_templates: stringifyNullable(template.code_templates),
    enabled: template.enabled ? 1 : 0
  };
}

function stringifyNullable(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

function parseJson<T>(value: string | null, fallback: T): T {
  return value ? (JSON.parse(value) as T) : fallback;
}

function defaultTemplateId(model: ModelConfig) {
  if (model.category === "image") return "tpl_image_generation";
  if (model.category === "video") return "tpl_video_async";
  return "tpl_openai_chat";
}

function withTemplateDefaults(model: ModelConfig): ModelConfig {
  return {
    ...model,
    template_id: model.template_id ?? defaultTemplateId(model),
    description: model.description ?? `${model.name} 模型测试入口`,
    tags: model.tags ?? [model.provider, model.category],
    sort_order: model.sort_order ?? 0
  };
}

function mapModelRow(row: ModelRow): ModelConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as ModelConfig["provider"],
    category: row.category as ModelConfig["category"],
    invoke_mode: row.invoke_mode as ModelConfig["invoke_mode"],
    endpoint_type: row.endpoint_type as ModelConfig["endpoint_type"],
    supports_stream: Boolean(row.supports_stream),
    supports_native_example: Boolean(row.supports_native_example),
    response_mode: row.response_mode as ModelConfig["response_mode"],
    default_params: row.default_params ? JSON.parse(row.default_params) : undefined,
    template_id: row.template_id ?? undefined,
    description: row.description ?? "",
    tags: parseJson<string[]>(row.tags, []),
    sort_order: row.sort_order ?? 0,
    default_params_override: parseJson<Record<string, unknown> | undefined>(row.default_params_override, undefined),
    enabled: Boolean(row.enabled)
  };
}

function mapTemplateRow(row: TemplateRow): ApiTemplate {
  return {
    id: row.id,
    name: row.name,
    category: row.category as ApiTemplate["category"],
    protocol: row.protocol as ApiTemplate["protocol"],
    method: row.method as ApiTemplate["method"],
    path: row.path,
    is_async: Boolean(row.is_async),
    task_query_path: row.task_query_path ?? undefined,
    headers_template: parseJson(row.headers_template, undefined),
    body_template: parseJson(row.body_template, undefined),
    params_schema: parseJson(row.params_schema, undefined),
    default_params: parseJson(row.default_params, undefined),
    response_example: parseJson(row.response_example, undefined),
    response_parser: parseJson(row.response_parser, undefined),
    code_templates: parseJson(row.code_templates, undefined),
    enabled: Boolean(row.enabled)
  };
}
