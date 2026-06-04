import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ApiTemplate, AppConfig, ModelConfig } from "./types";
import {
  createAdminModel,
  createAdminTemplate,
  deleteAdminModel,
  deleteAdminTemplate,
  fetchAdminConfig,
  fetchAdminModels,
  fetchAdminTemplates,
  saveAdminConfig,
  updateAdminModel,
  updateAdminTemplate
} from "./services/api";

const adminTokenKey = "api-playground:admin-token";

const emptyModel: ModelConfig = {
  id: "",
  name: "",
  provider: "openai",
  category: "text",
  invoke_mode: "openai_chat",
  endpoint_type: "chat",
  supports_stream: true,
  supports_native_example: false,
  response_mode: "text",
  default_params: {},
  template_id: "tpl_openai_chat",
  description: "",
  tags: [],
  sort_order: 0,
  default_params_override: {},
  enabled: true
};

const emptyTemplate: ApiTemplate = {
  id: "",
  name: "",
  category: "text",
  protocol: "openai_chat",
  method: "POST",
  path: "/v1/chat/completions",
  is_async: false,
  headers_template: { Authorization: "Bearer {{api_key}}", "Content-Type": "application/json" },
  body_template: {},
  params_schema: [],
  default_params: {},
  response_example: {},
  response_parser: {},
  code_templates: {},
  enabled: true
};

export function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(adminTokenKey) ?? "");
  const [authed, setAuthed] = useState(Boolean(token));
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [editing, setEditing] = useState<ModelConfig>(emptyModel);
  const [editingTemplate, setEditingTemplate] = useState<ApiTemplate>(emptyTemplate);
  const [defaultParamsText, setDefaultParamsText] = useState("{}");
  const [overrideText, setOverrideText] = useState("{}");
  const [tagsText, setTagsText] = useState("[]");
  const [templateText, setTemplateText] = useState(JSON.stringify(emptyTemplate, null, 2));
  const [configText, setConfigText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (authed) void load();
  }, [authed]);

  async function load() {
    setError("");
    try {
      const [nextModels, nextTemplates, config] = await Promise.all([fetchAdminModels(token), fetchAdminTemplates(token), fetchAdminConfig(token)]);
      setModels(nextModels);
      setTemplates(nextTemplates);
      setConfigText(JSON.stringify(config, null, 2));
      sessionStorage.setItem(adminTokenKey, token);
    } catch (loadError) {
      setAuthed(false);
      setError(getErrorMessage(loadError));
    }
  }

  function login() {
    setAuthed(true);
    sessionStorage.setItem(adminTokenKey, token);
  }

  function editModel(model: ModelConfig) {
    setEditing(model);
    setDefaultParamsText(JSON.stringify(model.default_params ?? {}, null, 2));
    setOverrideText(JSON.stringify(model.default_params_override ?? {}, null, 2));
    setTagsText(JSON.stringify(model.tags ?? [], null, 2));
    setMessage("");
    setError("");
  }

  async function saveModel() {
    setMessage("");
    setError("");

    try {
      const defaultParams = JSON.parse(defaultParamsText || "{}") as Record<string, unknown>;
      const defaultParamsOverride = JSON.parse(overrideText || "{}") as Record<string, unknown>;
      const tags = JSON.parse(tagsText || "[]") as string[];
      const payload = { ...editing, default_params: defaultParams, default_params_override: defaultParamsOverride, tags };

      if (models.some((model) => model.id === editing.id)) {
        await updateAdminModel(token, editing.id, payload);
        setMessage("模型已更新");
      } else {
        await createAdminModel(token, payload);
        setMessage("模型已新增");
      }

      await load();
    } catch (saveError) {
      setError(saveError instanceof SyntaxError ? "模型 JSON 字段格式错误" : getErrorMessage(saveError));
    }
  }

  function editTemplate(template: ApiTemplate) {
    setEditingTemplate(template);
    setTemplateText(JSON.stringify(template, null, 2));
    setMessage("");
    setError("");
  }

  async function saveTemplate() {
    setMessage("");
    setError("");
    try {
      const payload = parseJsonEditor<ApiTemplate>(templateText, "模板 JSON");
      if (!payload.id || !payload.name || !payload.path) {
        setError("模板 id、名称和 path 为必填");
        return;
      }
      if (templates.some((template) => template.id === editingTemplate.id || template.id === payload.id)) {
        await updateAdminTemplate(token, editingTemplate.id || payload.id, payload);
        setMessage("模板已更新");
      } else {
        await createAdminTemplate(token, payload);
        setMessage("模板已新增");
      }
      await load();
      editTemplate(payload);
    } catch (templateError) {
      setError(getErrorMessage(templateError));
    }
  }

  function formatTemplate() {
    setMessage("");
    setError("");
    try {
      const payload = parseJsonEditor<ApiTemplate>(templateText, "模板 JSON");
      setTemplateText(JSON.stringify(payload, null, 2));
      setMessage("模板 JSON 格式正常，已格式化");
    } catch (formatError) {
      setError(getErrorMessage(formatError));
    }
  }

  async function removeTemplate(id: string) {
    if (!window.confirm(`确认删除模板 ${id}？如果模板被模型使用，需要先解绑模型。`)) return;
    try {
      await deleteAdminTemplate(token, id);
      setMessage("模板已删除");
      await load();
    } catch (templateError) {
      setError(getErrorMessage(templateError));
    }
  }

  async function removeModel(id: string) {
    if (!window.confirm(`确认删除模型 ${id}？`)) return;
    await deleteAdminModel(token, id);
    setMessage("模型已删除");
    await load();
  }

  async function saveConfig() {
    setMessage("");
    setError("");

    try {
      const config = JSON.parse(configText) as AppConfig;
      await saveAdminConfig(token, config);
      setMessage("全局配置已保存");
      await load();
    } catch (configError) {
      setError(configError instanceof SyntaxError ? "全局配置 JSON 格式错误" : getErrorMessage(configError));
    }
  }

  if (!authed) {
    return (
      <main className="star-field min-h-screen px-5 py-10 text-slate-100">
        <section className="mx-auto max-w-md rounded-lg border border-white/10 bg-panel p-6 shadow-glow backdrop-blur">
          <h1 className="text-xl font-semibold text-white">管理员入口</h1>
          <p className="mt-2 text-sm text-slate-400">输入 Admin Token 后进入后台，Token 仅保存在当前会话。</p>
          <input className={inputClass} type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="ADMIN_TOKEN" />
          <button className={primaryButtonClass} onClick={login}>进入后台</button>
          {error && <p className="mt-4 text-sm text-red-200">{error}</p>}
          <a className="mt-4 inline-block text-sm text-slate-400 hover:text-white" href="/">返回测试台</a>
        </section>
      </main>
    );
  }

  return (
    <main className="star-field min-h-screen px-5 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">管理员后台</h1>
            <p className="mt-1 text-sm text-slate-400">模型管理与全局配置</p>
          </div>
          <div className="flex gap-2">
            <a className={secondaryLinkClass} href="/">返回测试台</a>
            <button className={secondaryButtonClass} onClick={() => { sessionStorage.removeItem(adminTokenKey); setAuthed(false); }}>退出</button>
          </div>
        </header>

        {(message || error) && <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${error ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-aurora/30 bg-aurora/10 text-emerald-100"}`}>{error || message}</div>}

        <section className="mb-5 grid gap-5 xl:grid-cols-[320px_1fr]">
          <div className="rounded-lg border border-white/10 bg-panel p-5 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">接口模板库</h2>
              <button className={secondaryButtonClass} onClick={() => editTemplate(emptyTemplate)}>新增模板</button>
            </div>
            {(["text", "image", "video"] as const).map((category) => (
              <div className="mt-4" key={category}>
                <h3 className="text-sm font-semibold text-slate-300">{category === "text" ? "文本模型" : category === "image" ? "图片模型" : "视频模型"}</h3>
                <div className="mt-2 space-y-2">
                  {templates.filter((template) => template.category === category).map((template) => (
                    <button className="block w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10" key={template.id} onClick={() => editTemplate(template)}>
                      {template.name}
                      <span className="ml-2 text-xs text-slate-500">{template.protocol}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-white/10 bg-panel p-5 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">模板编辑器</h2>
              <div className="flex gap-2">
                <button className={smallButtonClass} onClick={formatTemplate}>格式化 JSON</button>
                {editingTemplate.id && <button className={smallButtonClass} onClick={() => removeTemplate(editingTemplate.id)}>删除模板</button>}
              </div>
            </div>
            <textarea
              className={`${inputClass} min-h-[520px] font-mono`}
              spellCheck={false}
              value={templateText}
              onChange={(event) => setTemplateText(event.target.value)}
            />
            <button className={primaryButtonClass} onClick={saveTemplate}>保存模板</button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="rounded-lg border border-white/10 bg-panel p-5 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">模型列表</h2>
              <button className={secondaryButtonClass} onClick={() => editModel(emptyModel)}>新增模型</button>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="p-2">id</th>
                    <th className="p-2">名称</th>
                    <th className="p-2">类型</th>
                    <th className="p-2">调用</th>
                    <th className="p-2">状态</th>
                    <th className="p-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr className="border-t border-white/10" key={model.id}>
                      <td className="p-2 text-slate-300">{model.id}</td>
                      <td className="p-2 text-white">{model.name}</td>
                      <td className="p-2 text-slate-300">{model.provider} / {model.category}</td>
                      <td className="p-2 text-slate-300">{model.invoke_mode}</td>
                      <td className="p-2">{model.enabled ? "启用" : "禁用"}</td>
                      <td className="flex gap-2 p-2">
                        <button className={smallButtonClass} onClick={() => editModel(model)}>编辑</button>
                        <button className={smallButtonClass} onClick={() => updateAdminModel(token, model.id, { ...model, enabled: !model.enabled }).then(load)}>{model.enabled ? "禁用" : "启用"}</button>
                        <button className={smallButtonClass} onClick={() => removeModel(model.id)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ModelEditor
            model={editing}
            setModel={setEditing}
            templates={templates}
            defaultParamsText={defaultParamsText}
            setDefaultParamsText={setDefaultParamsText}
            overrideText={overrideText}
            setOverrideText={setOverrideText}
            tagsText={tagsText}
            setTagsText={setTagsText}
            onSave={saveModel}
          />
        </section>

        <section className="mt-5 rounded-lg border border-white/10 bg-panel p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">全局配置</h2>
          <textarea className={`${inputClass} min-h-80 font-mono`} value={configText} onChange={(event) => setConfigText(event.target.value)} />
          <button className={primaryButtonClass} onClick={saveConfig}>保存配置</button>
        </section>
      </div>
    </main>
  );
}

function ModelEditor({
  model,
  setModel,
  templates,
  defaultParamsText,
  setDefaultParamsText,
  overrideText,
  setOverrideText,
  tagsText,
  setTagsText,
  onSave
}: {
  model: ModelConfig;
  setModel: (model: ModelConfig) => void;
  templates: ApiTemplate[];
  defaultParamsText: string;
  setDefaultParamsText: (value: string) => void;
  overrideText: string;
  setOverrideText: (value: string) => void;
  tagsText: string;
  setTagsText: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <aside className="rounded-lg border border-white/10 bg-panel p-5 backdrop-blur">
      <h2 className="text-lg font-semibold text-white">模型编辑</h2>
      <AdminField label="id"><input className={inputClass} value={model.id} onChange={(event) => setModel({ ...model, id: event.target.value })} /></AdminField>
      <AdminField label="name"><input className={inputClass} value={model.name} onChange={(event) => setModel({ ...model, name: event.target.value })} /></AdminField>
      <AdminField label="provider"><EnumSelect value={model.provider} values={["openai", "gemini", "claude", "other"]} onChange={(value) => setModel({ ...model, provider: value as ModelConfig["provider"] })} /></AdminField>
      <AdminField label="category"><EnumSelect value={model.category} values={["text", "image", "video"]} onChange={(value) => setModel({ ...model, category: value as ModelConfig["category"] })} /></AdminField>
      <AdminField label="template_id">
        <select className={inputClass} value={model.template_id ?? ""} onChange={(event) => setModel({ ...model, template_id: event.target.value })}>
          <option value="">未绑定模板</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name} ({template.id})</option>)}
        </select>
      </AdminField>
      <AdminField label="description"><textarea className={`${inputClass} min-h-20`} value={model.description ?? ""} onChange={(event) => setModel({ ...model, description: event.target.value })} /></AdminField>
      <AdminField label="sort_order"><input className={inputClass} type="number" value={model.sort_order ?? 0} onChange={(event) => setModel({ ...model, sort_order: Number(event.target.value) })} /></AdminField>
      <AdminField label="invoke_mode"><EnumSelect value={model.invoke_mode} values={["openai_chat", "image_generation", "video_async", "gemini_native_example", "claude_native_example"]} onChange={(value) => setModel({ ...model, invoke_mode: value as ModelConfig["invoke_mode"] })} /></AdminField>
      <AdminField label="endpoint_type"><EnumSelect value={model.endpoint_type} values={["chat", "image_generation", "video_generation_async"]} onChange={(value) => setModel({ ...model, endpoint_type: value as ModelConfig["endpoint_type"] })} /></AdminField>
      <AdminField label="response_mode"><EnumSelect value={model.response_mode ?? "text"} values={["text", "image_url_array", "video_task"]} onChange={(value) => setModel({ ...model, response_mode: value as ModelConfig["response_mode"] })} /></AdminField>
      <label className="mt-4 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-aurora" checked={Boolean(model.supports_stream)} onChange={(event) => setModel({ ...model, supports_stream: event.target.checked })} />supports_stream</label>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-aurora" checked={Boolean(model.supports_native_example)} onChange={(event) => setModel({ ...model, supports_native_example: event.target.checked })} />supports_native_example</label>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-aurora" checked={model.enabled} onChange={(event) => setModel({ ...model, enabled: event.target.checked })} />enabled</label>
      <AdminField label="tags JSON"><textarea className={`${inputClass} min-h-20 font-mono`} value={tagsText} onChange={(event) => setTagsText(event.target.value)} /></AdminField>
      <AdminField label="default_params JSON"><textarea className={`${inputClass} min-h-28 font-mono`} value={defaultParamsText} onChange={(event) => setDefaultParamsText(event.target.value)} /></AdminField>
      <AdminField label="default_params_override JSON"><textarea className={`${inputClass} min-h-28 font-mono`} value={overrideText} onChange={(event) => setOverrideText(event.target.value)} /></AdminField>
      <button className={primaryButtonClass} onClick={onSave}>保存模型</button>
    </aside>
  );
}

function AdminField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="mt-4 block"><span className="text-sm text-slate-300">{label}</span>{children}</label>;
}

function EnumSelect({ value, values, onChange }: { value: string; values: string[]; onChange: (value: string) => void }) {
  return <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option key={item} value={item}>{item}</option>)}</select>;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error) {
    const record = error as { message?: unknown; debug?: unknown };
    const details = formatDebug(record.debug);
    if (record.message && details) return `${String(record.message)}：${details}`;
    if (record.message) return String(record.message);
  }
  return "操作失败，请稍后重试";
}

function formatDebug(debug: unknown) {
  if (!debug || typeof debug !== "object") return "";
  const fieldErrors = (debug as { fieldErrors?: Record<string, string[]> }).fieldErrors;
  if (!fieldErrors) return "";

  return Object.entries(fieldErrors)
    .filter(([, messages]) => messages.length > 0)
    .map(([field, messages]) => `${field}: ${messages.join("，")}`)
    .join("；");
}

function parseJsonEditor<T>(text: string, label: string): T {
  const normalized = stripJsonEditorNoise(text);

  try {
    return JSON.parse(normalized) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} 格式错误：${formatJsonSyntaxError(error, normalized)}`);
    }

    throw error;
  }
}

function stripJsonEditorNoise(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,\s*([}\]])/g, "$1");
}

function formatJsonSyntaxError(error: SyntaxError, text: string) {
  const match = error.message.match(/position (\d+)/i);

  if (!match) return error.message;

  const position = Number(match[1]);
  const before = text.slice(0, position);
  const line = before.split("\n").length;
  const column = before.length - before.lastIndexOf("\n");
  const preview = text.split("\n")[line - 1]?.trim();

  return `第 ${line} 行，第 ${column} 列附近有问题。${preview ? `附近内容：${preview}` : error.message}`;
}

const inputClass = "mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-aurora/50 placeholder:text-slate-600 focus:ring-2";
const primaryButtonClass = "mt-5 rounded-md bg-aurora px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-aurora/90";
const secondaryButtonClass = "rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10";
const secondaryLinkClass = "rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10";
const smallButtonClass = "rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10";
