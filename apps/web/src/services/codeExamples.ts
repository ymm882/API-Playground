type ExampleInput = {
  baseUrl: string;
  apiKey: string;
  model: string;
  payload: Record<string, unknown>;
  taskId?: string;
  prompt?: string;
};

const hiddenKey = "{{API_KEY}}";

export function buildExamples(kind: "chat" | "image" | "video" | "video-task", input: ExampleInput) {
  const endpoint = endpointFor(kind, input.taskId);
  const url = `${input.baseUrl || "{{BASE_URL}}"}${endpoint}`;
  const apiKey = input.apiKey ? hiddenKey : hiddenKey;
  const payload = { model: input.model || "{{MODEL}}", ...input.payload };
  const body = kind === "video-task" ? null : JSON.stringify(payload, null, 2);

  return {
    curl: buildCurl(url, apiKey, body),
    javascript: buildJavaScript(url, apiKey, body),
    python: buildPython(url, apiKey, kind === "video-task" ? null : toPythonLiteral(payload)),
    geminiNative: buildGeminiNative(input.model, input.prompt ?? extractPrompt(input.payload)),
    claudeNative: buildClaudeNative(input.model, input.prompt ?? extractPrompt(input.payload))
  };
}

function endpointFor(kind: "chat" | "image" | "video" | "video-task", taskId?: string) {
  if (kind === "chat") return "/v1/chat/completions";
  if (kind === "image") return "/v1/images/generations";
  if (kind === "video") return "/v1/images/generations?async=true";
  return `/v1/images/tasks/${taskId || "{{TASK_ID}}"}`;
}

function buildCurl(url: string, apiKey: string, body: string | null) {
  const base = `curl --location '${url}' \\\n  --header 'Authorization: Bearer ${apiKey}'`;

  if (!body) {
    return base;
  }

  return `${base} \\\n  --header 'Content-Type: application/json' \\\n  --data '${body}'`;
}

function buildJavaScript(url: string, apiKey: string, body: string | null) {
  const options = body
    ? `{
  method: "POST",
  headers: {
    Authorization: "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(${body})
}`
    : `{
  method: "GET",
  headers: {
    Authorization: "Bearer ${apiKey}"
  }
}`;

  return `const response = await fetch("${url}", ${options});
const data = await response.json();
console.log(data);`;
}

function buildPython(url: string, apiKey: string, body: string | null) {
  if (!body) {
    return `import requests

response = requests.get(
    "${url}",
    headers={"Authorization": "Bearer ${apiKey}"}
)
print(response.json())`;
  }

  return `import requests

payload = ${body}

response = requests.post(
    "${url}",
    headers={
        "Authorization": "Bearer ${apiKey}",
        "Content-Type": "application/json"
    },
    json=payload
)
print(response.json())`;
}

function toPythonLiteral(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(toPythonLiteral).join(", ")}]`;
  if (typeof value === "object" && value) {
    const entries = Object.entries(value)
      .map(([key, entryValue]) => `${JSON.stringify(key)}: ${toPythonLiteral(entryValue)}`)
      .join(",\n    ");
    return `{\n    ${entries}\n}`;
  }

  return "None";
}

function extractPrompt(payload: Record<string, unknown>) {
  const messages = payload.messages as Array<Record<string, unknown>> | undefined;
  const last = messages?.[messages.length - 1];
  return String(last?.content ?? payload.prompt ?? "{{PROMPT}}");
}

function buildGeminiNative(model: string, prompt: string) {
  return `POST /v1beta/models/${model || "{{MODEL}}"}:generateContent
Content-Type: application/json

{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": ${JSON.stringify(prompt)} }
      ]
    }
  ]
}`;
}

function buildClaudeNative(model: string, prompt: string) {
  return `POST /v1/messages
Content-Type: application/json

{
  "model": "${model || "{{MODEL}}"}",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": ${JSON.stringify(prompt)}
    }
  ]
}`;
}
