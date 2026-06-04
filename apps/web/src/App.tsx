import { useEffect, useMemo, useRef, useState } from "react";
import { AdminPage } from "./AdminPage";
import { fetchModels, fetchTemplates, queryTaskTemplate, runTemplate, validateBaseUrl } from "./services/api";
import type { ApiTemplate, ModelConfig, ParamSchemaItem, TemplateRunData } from "./types";

const savedBaseUrlKey = "api-playground:last-base-url";
const savedMotionKey = "api-playground:reduce-motion";
const savedHistoryKey = "api-playground:recent-history";

function App() {
  if (window.location.pathname === "/admin") return <AdminPage />;
  if (window.location.pathname.startsWith("/model/")) return <ModelTestPage modelId={decodeURIComponent(window.location.pathname.replace("/model/", ""))} />;
  return <ModelGallery />;
}

function ModelGallery() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [provider, setProvider] = useState("all");
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem(savedMotionKey) === "1");

  useEffect(() => {
    void Promise.all([fetchModels(), fetchTemplates()]).then(([nextModels, nextTemplates]) => {
      setModels(nextModels);
      setTemplates(nextTemplates);
    });
  }, []);

  useEffect(() => localStorage.setItem(savedMotionKey, reduceMotion ? "1" : "0"), [reduceMotion]);

  const filtered = models.filter((model) => {
    const haystack = `${model.id} ${model.name} ${model.description ?? ""} ${(model.tags ?? []).join(" ")}`.toLowerCase();
    return (
      haystack.includes(query.toLowerCase()) &&
      (category === "all" || model.category === category) &&
      (provider === "all" || model.provider === provider)
    );
  });

  return (
    <Shell reduceMotion={reduceMotion} setReduceMotion={setReduceMotion}>
      <section className="mx-auto max-w-7xl px-5 py-6">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-white">模型广场</h2>
          <p className="mt-1 text-sm text-slate-400">选择模型后进入参数化测试页，表单由管理员配置的接口模板生成。</p>
        </div>
        <div className="grid gap-3 rounded-lg border border-white/10 bg-panel p-4 backdrop-blur md:grid-cols-[1fr_160px_160px]">
          <input className={inputClass} placeholder="搜索模型、标签或简介" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">全部类型</option>
            <option value="text">文本</option>
            <option value="image">图片</option>
            <option value="video">视频</option>
          </select>
          <select className={inputClass} value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="all">全部厂商</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="claude">Claude</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((model) => {
            const template = templates.find((item) => item.id === model.template_id);
            return (
              <article key={model.id} className="min-w-0 rounded-lg border border-white/10 bg-panel p-5 backdrop-blur transition hover:border-aurora/40 hover:shadow-glow">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{model.name}</h3>
                    <p className="mt-1 break-all text-xs text-slate-500">{model.id}</p>
                  </div>
                  <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300">{model.category}</span>
                </div>
                <p className="mt-3 min-h-10 text-sm text-slate-400">{model.description || "模型测试入口"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{model.provider}</Badge>
                  <Badge>{template?.name ?? "未绑定模板"}</Badge>
                  {(model.tags ?? []).map((tag) => <Badge key={tag}>{tag}</Badge>)}
                </div>
                <a className={primaryLinkClass} href={`/model/${encodeURIComponent(model.id)}`}>进入测试</a>
              </article>
            );
          })}
        </div>
      </section>
    </Shell>
  );
}

function ModelTestPage({ modelId }: { modelId: string }) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem(savedBaseUrlKey) ?? "");
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("api-playground:api-key") ?? "");
  const [rememberSession, setRememberSession] = useState(() => Boolean(sessionStorage.getItem("api-playground:api-key")));
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<TemplateRunData | null>(null);
  const [requestPreview, setRequestPreview] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [taskId, setTaskId] = useState("");
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem(savedMotionKey) === "1");
  const cancelPolling = useRef(false);

  useEffect(() => {
    void Promise.all([fetchModels(), fetchTemplates()]).then(([nextModels, nextTemplates]) => {
      setModels(nextModels);
      setTemplates(nextTemplates);
      const model = nextModels.find((item) => item.id === modelId);
      const template = nextTemplates.find((item) => item.id === model?.template_id);
      setParams(defaultParams(template, model));
    });
  }, [modelId]);

  useEffect(() => {
    if (baseUrl.trim()) localStorage.setItem(savedBaseUrlKey, baseUrl.trim());
  }, [baseUrl]);

  useEffect(() => {
    if (rememberSession && apiKey) sessionStorage.setItem("api-playground:api-key", apiKey);
    else sessionStorage.removeItem("api-playground:api-key");
  }, [apiKey, rememberSession]);

  const model = models.find((item) => item.id === modelId);
  const template = templates.find((item) => item.id === model?.template_id);
  const examples = template && model ? buildTemplateExamples(baseUrl, template, model, params) : null;

  async function testBaseUrl() {
    try {
      const response = await validateBaseUrl(baseUrl);
      if (response.origin) setBaseUrl(response.origin);
      setError(response.message);
    } catch (baseError) {
      setError(getErrorMessage(baseError));
    }
  }

  async function run() {
    setState("loading");
    setError("");
    setResult(null);
    cancelPolling.current = false;
    try {
      const response = await runTemplate({ baseUrl, apiKey, modelId, params });
      setRequestPreview(response.request);
      setResult(response.data ?? null);
      saveHistory({ type: model?.category, model: modelId, params, createdAt: new Date().toISOString() });
      if (response.data?.task_id && template?.is_async) {
        setTaskId(response.data.task_id);
        await poll(response.data.task_id);
      }
    } catch (runError) {
      setError(getErrorMessage(runError));
    } finally {
      setState("idle");
    }
  }

  async function poll(nextTaskId: string) {
    const startedAt = Date.now();
    while (!cancelPolling.current && Date.now() - startedAt < 10 * 60 * 1000) {
      await wait(2500);
      const response = await queryTaskTemplate({ baseUrl, apiKey, modelId, taskId: nextTaskId });
      setRequestPreview(response.request);
      setResult(response.data ?? null);
      const status = response.data?.status.toLowerCase() ?? "";
      if (["success", "succeeded", "completed", "done"].includes(status) || (response.data?.video_urls.length ?? 0) > 0) return;
      if (["failed", "error", "cancelled", "canceled"].includes(status)) throw new Error("视频生成失败，请查看错误信息");
    }
  }

  if (!model || !template) {
    return <Shell reduceMotion={reduceMotion} setReduceMotion={setReduceMotion}><div className="mx-auto max-w-4xl px-5 py-10 text-slate-300">模型或模板不存在</div></Shell>;
  }

  return (
    <Shell reduceMotion={reduceMotion} setReduceMotion={setReduceMotion}>
      <section className="mx-auto max-w-7xl px-5 py-6">
        <a className="text-sm text-slate-400 hover:text-white" href="/">返回模型广场</a>
        <div className="mt-4 rounded-lg border border-white/10 bg-panel p-5 backdrop-blur">
          <h2 className="text-2xl font-semibold text-white">{model.name}</h2>
          <p className="mt-2 text-sm text-slate-400">{model.description}</p>
          <div className="mt-3 flex flex-wrap gap-2"><Badge>{model.provider}</Badge><Badge>{model.category}</Badge><Badge>{template.name}</Badge></div>
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[320px_1fr_420px]">
          <aside className="h-fit rounded-lg border border-white/10 bg-panel p-5 backdrop-blur">
            <h3 className="font-semibold text-white">连接配置</h3>
            <Field label="Base URL"><input className={inputClass} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://abc.ai-wx.cn" /></Field>
            <Field label="API Key"><input className={inputClass} value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" placeholder="仅用于本次请求" /></Field>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-300"><input className="accent-aurora" type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} />记住本次会话</label>
            <button className={secondaryButtonClass} onClick={testBaseUrl}>测试连接</button>
          </aside>
          <section className="rounded-lg border border-white/10 bg-panel p-5 backdrop-blur">
            <h3 className="font-semibold text-white">参数表单</h3>
            {(template.params_schema ?? []).map((item) => <DynamicField key={item.key} item={item} value={params[item.key]} onChange={(value) => setParams({ ...params, [item.key]: value })} />)}
            <div className="flex gap-3">
              <button className={primaryButtonClass} disabled={state === "loading"} onClick={run}>{state === "loading" ? "正在请求模型，请稍候..." : "运行模板"}</button>
              {state === "loading" && template.is_async && <button className={secondaryButtonClass} onClick={() => { cancelPolling.current = true; setState("idle"); }}>取消轮询</button>}
            </div>
            {taskId && <p className="mt-3 break-all text-xs text-slate-400">task_id: {taskId}</p>}
            {error && <div className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}
          </section>
          <aside className="min-w-0 rounded-lg border border-white/10 bg-panel p-5 backdrop-blur">
            <h3 className="font-semibold text-white">请求与代码示例</h3>
            <Details title="请求示例" open value={JSON.stringify(requestPreview ?? examples?.request, null, 2)} />
            <Details title="返回示例" value={JSON.stringify(template.response_example ?? template.response_parser ?? {}, null, 2)} />
            {examples && <><Details title="curl" value={examples.curl} /><Details title="JavaScript fetch" value={examples.javascript} /><Details title="Python requests" value={examples.python} /></>}
          </aside>
        </div>
        <Result result={result} />
      </section>
    </Shell>
  );
}

function DynamicField({ item, value, onChange }: { item: ParamSchemaItem; value: unknown; onChange: (value: unknown) => void }) {
  if (item.type === "textarea") return <Field label={item.label}><textarea className={`${inputClass} min-h-28`} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} /></Field>;
  if (item.type === "boolean") return <label className="mt-4 flex items-center gap-2 text-sm text-slate-300"><input className="accent-aurora" type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />{item.label}</label>;
  if (item.type === "select") return <Field label={item.label}><select className={inputClass} value={String(value ?? "")} onChange={(event) => onChange(coerceOption(event.target.value, item.options ?? []))}>{(item.options ?? []).map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select></Field>;
  if (item.type === "number") return <Field label={item.label}><input className={inputClass} type="number" min={item.min} max={item.max} step={item.step} value={Number(value ?? 0)} onChange={(event) => onChange(Number(event.target.value))} /></Field>;
  return <Field label={item.label}><input className={inputClass} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} /></Field>;
}

function Result({ result }: { result: TemplateRunData | null }) {
  if (!result) return null;
  return (
    <section className="mt-5 rounded-lg border border-white/10 bg-panel p-5 backdrop-blur">
      <h3 className="font-semibold text-white">测试结果</h3>
      {result.content && <pre className={preClass}>{result.content}</pre>}
      {result.image_urls.length > 0 && <MediaGrid urls={result.image_urls} type="image" />}
      {result.video_urls.length > 0 && <MediaGrid urls={result.video_urls} type="video" />}
      <Details title="Usage" open value={JSON.stringify(result.usage ?? {}, null, 2)} />
      <Details title="原始 JSON" value={JSON.stringify(result.raw ?? {}, null, 2)} />
    </section>
  );
}

function Shell({ children, reduceMotion, setReduceMotion }: { children: React.ReactNode; reduceMotion: boolean; setReduceMotion: (value: boolean) => void }) {
  return (
    <main className="star-field relative min-h-screen overflow-hidden text-slate-100">
      {!reduceMotion && <ParticleLayer />}
      <div className="relative z-10 min-h-screen">
        <header className="border-b border-white/10 bg-void/55 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div><h1 className="text-xl font-semibold text-white">多元探索 API Playground</h1><p className="mt-1 text-sm text-slate-400">模板驱动模型调用测试台</p></div>
            <nav className="flex items-center gap-2 text-sm text-slate-300"><a className="rounded-md px-3 py-2 hover:bg-white/10" href="/">模型广场</a><a className="rounded-md px-3 py-2 hover:bg-white/10" href="/admin">管理员入口</a><label className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2"><input className="accent-aurora" type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} />降噪模式</label></nav>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mt-4 block"><span className="text-sm text-slate-300">{label}</span>{children}</label>;
}

function Details({ title, value, open = false }: { title: string; value: string; open?: boolean }) {
  return <details className={detailsClass} open={open}><summary>{title}</summary><pre className={preClass}>{value}</pre></details>;
}

function MediaGrid({ urls, type }: { urls: string[]; type: "image" | "video" }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2">{urls.map((url) => <div className="rounded-md border border-white/10 bg-black/20 p-3" key={url}>{type === "image" ? <img className="aspect-square w-full rounded-md object-cover" src={url} /> : <video className="aspect-video w-full rounded-md bg-black" src={url} controls />}<div className="mt-3 flex flex-wrap gap-2"><button className={smallButtonClass} onClick={() => copyText(url)}>复制 URL</button><a className={smallLinkClass} href={url} target="_blank" rel="noreferrer">新窗口打开</a><a className={smallLinkClass} href={url} download>下载</a></div></div>)}</div>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-300">{children}</span>;
}

function defaultParams(template?: ApiTemplate, model?: ModelConfig) {
  const schemaDefaults = Object.fromEntries((template?.params_schema ?? []).map((item) => [item.key, item.default]));
  return { ...schemaDefaults, ...(template?.default_params ?? {}), ...(model?.default_params ?? {}), ...(model?.default_params_override ?? {}) };
}

function buildTemplateExamples(baseUrl: string, template: ApiTemplate, model: ModelConfig, params: Record<string, unknown>) {
  const body = renderPreview(template.body_template ?? {}, { ...defaultParams(template, model), ...params, model: model.id, api_key: "{{API_KEY}}" });
  const url = `${baseUrl || "{{BASE_URL}}"}${template.path}`;
  const request = { method: template.method, url, headers: template.headers_template, body };
  const bodyJson = JSON.stringify(body, null, 2);
  return {
    request,
    curl: `curl --location '${url}' \\\n  --header 'Authorization: Bearer {{API_KEY}}' \\\n  --header 'Content-Type: application/json'${template.method === "POST" ? ` \\\n  --data '${bodyJson}'` : ""}`,
    javascript: `const response = await fetch("${url}", {\n  method: "${template.method}",\n  headers: { Authorization: "Bearer {{API_KEY}}", "Content-Type": "application/json" },${template.method === "POST" ? `\n  body: JSON.stringify(${bodyJson})` : ""}\n});\nconsole.log(await response.json());`,
    python: `import requests\n\nresponse = requests.${template.method === "POST" ? "post" : "get"}(\n    "${url}",\n    headers={"Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json"}${template.method === "POST" ? `,\n    json=${toPythonLiteral(body)}` : ""}\n)\nprint(response.json())`
  };
}

function renderPreview(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const whole = value.match(/^\{\{([\w.]+)\}\}$/);
    if (whole) return vars[whole[1]] ?? "";
    return value.replace(/\{\{([\w.]+)\}\}/g, (_match, key) => String(vars[key] ?? ""));
  }
  if (Array.isArray(value)) return value.map((item) => renderPreview(item, vars)).filter((item) => !(typeof item === "object" && item && (item as Record<string, unknown>).role === "system" && (item as Record<string, unknown>).content === ""));
  if (typeof value === "object" && value) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, renderPreview(entry, vars)]));
  return value;
}

function toPythonLiteral(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(toPythonLiteral).join(", ")}]`;
  if (typeof value === "object" && value) return `{${Object.entries(value).map(([key, entry]) => `${JSON.stringify(key)}: ${toPythonLiteral(entry)}`).join(", ")}}`;
  return "None";
}

function coerceOption(value: string, options: unknown[]) {
  const found = options.find((option) => String(option) === value);
  return found ?? value;
}

function ParticleLayer() {
  const particles = Array.from({ length: 30 }, (_, index) => ({ left: `${(index * 37) % 100}%`, top: `${(index * 53) % 100}%`, opacity: 0.16 + (index % 6) * 0.07 }));
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">{particles.map((particle, index) => <span className="particle" key={index} style={particle} />)}</div>;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) return String((error as { message: unknown }).message);
  return "操作失败，请稍后重试";
}

function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

function saveHistory(record: Record<string, unknown>) {
  const current = JSON.parse(localStorage.getItem(savedHistoryKey) ?? "[]") as Array<Record<string, unknown>>;
  localStorage.setItem(savedHistoryKey, JSON.stringify([record, ...current].slice(0, 10)));
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const inputClass = "mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-aurora/50 placeholder:text-slate-600 focus:ring-2";
const primaryButtonClass = "mt-5 rounded-md bg-aurora px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-aurora/90 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass = "mt-5 rounded-md border border-white/10 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10";
const primaryLinkClass = "mt-5 inline-flex rounded-md bg-aurora px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-aurora/90";
const smallButtonClass = "rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10";
const smallLinkClass = "rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10";
const preClass = "mt-3 max-h-80 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black/30 p-3 text-xs text-slate-200";
const detailsClass = "mt-4 min-w-0 overflow-hidden rounded-md border border-white/10 bg-black/20 p-3 text-sm text-slate-300";

export default App;
