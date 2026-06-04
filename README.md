# 多元探索 API Playground

面向 API 中转站客户的轻量化、模板驱动模型调用测试台。客户可以在浏览器里配置 Base URL 和 API Key，进入模型广场选择模型；管理员可以在后台维护类似 Apifox 的接口模板库，并让模型绑定模板后动态生成参数表单、请求示例、代码示例和响应解析逻辑。

项目不做完整 Apifox 替代品，也不做创作平台；目标是低门槛、低维护、低成本、可快速上线。

当前核心链路：

```txt
模型 -> 绑定 API 模板 -> 根据模板渲染请求 -> 代理执行 -> 根据模板解析返回
```

## 技术栈

- 前端：Vite、React、TypeScript、Tailwind CSS
- 后端：Node.js、Fastify、TypeScript
- 数据库：SQLite，用于保存管理员配置、模型注册表和接口模板库

## 目录结构

```txt
api-playground/
  apps/
    web/
      src/
      package.json
    server/
      src/
      package.json
  package.json
  README.md
  .env.example
```

## 安装依赖

```bash
cd api-playground
npm install
```

## 初始化数据库

```bash
npm run init:db
```

默认数据库路径：

```txt
./data/playground.sqlite
```

## 启动后端

```bash
npm run dev:server
```

默认后端地址：

```txt
http://localhost:8787
```

## 启动前端

```bash
npm run dev:web
```

默认前端地址：

```txt
http://localhost:5173
```

## 环境变量

复制 `.env.example` 为 `.env`：

```env
PORT=8787
HOST=0.0.0.0
ADMIN_TOKEN=change-me
DATABASE_PATH=./data/playground.sqlite
VITE_API_BASE_URL=http://localhost:8787
```

管理员请求必须携带：

```txt
Authorization: Bearer ${ADMIN_TOKEN}
```

## Base URL 白名单规则

服务端使用 `new URL()` 解析地址，不使用 `includes()` 模糊判断。

最终判断逻辑：

1. 必须是 HTTPS
2. hostname 命中 `blockedHosts` 时拒绝
3. hostname 命中 `extraAllowedHosts` 时允许
4. hostname 以任意 `allowedDomainSuffixes` 结尾时允许
5. 其他情况拒绝，并提示 `非多元探索旗下站点，不适用于本网站`

默认配置：

```json
{
  "allowedDomainSuffixes": [".ai-wx.cn"],
  "blockedHosts": [],
  "extraAllowedHosts": []
}
```

验收示例：

- `https://abc.ai-wx.cn`：通过
- `https://example.com`：拒绝
- `http://abc.ai-wx.cn`：提示 `请输入正确的 HTTPS API 地址`
- `https://abc.ai-wx.cn.evil.com`：拒绝

## 管理员后台

打开：

```txt
/admin
```

输入 `ADMIN_TOKEN` 后进入后台。Token 只保存在浏览器 `sessionStorage`。

后台支持：

- 查看模型列表
- 新增模型
- 编辑模型
- 删除模型，删除前二次确认
- 启用 / 禁用模型
- 编辑全局配置 JSON

## 如何新增模型

进入 `/admin`，点击“新增模型”，填写：

- `id`
- `name`
- `provider`
- `category`
- `invoke_mode`
- `endpoint_type`
- `response_mode`
- `default_params`
- `enabled`

`default_params` 使用 JSON 编辑框，格式错误会提示。

## 如何禁用模型

在 `/admin` 模型列表点击“禁用”。禁用后，普通用户前台的 `GET /api/models` 不再返回该模型。

## 如何配置 allowedDomainSuffixes

在 `/admin` 的全局配置中编辑：

```json
{
  "allowedDomainSuffixes": [".ai-wx.cn"]
}
```

## 如何配置 blockedHosts

用于封禁特定代理站：

```json
{
  "blockedHosts": ["old-agent.ai-wx.cn"]
}
```

## 如何配置 extraAllowedHosts

用于临时额外允许其他域名：

```json
{
  "extraAllowedHosts": ["zx1.deepwl.net"]
}
```

## 文本模型测试

1. 输入合法 Base URL
2. 输入 API Key
3. 选择文本模型，例如 `gpt-5.4`
4. 输入 User Prompt
5. 点击发送
6. 查看模型回复、Usage、原始 JSON、调用示例

Gemini / Claude 文本模型默认走 OpenAI Chat 兼容格式。如果模型开启 `supports_native_example`，调用示例区域会额外显示 Gemini / Claude 原生格式示例。

## 图片模型测试

1. 选择图片模型，例如 `gemini-3-pro-image-preview`
2. 输入图片 Prompt
3. 设置 `size` 和 `n`
4. 点击生成图片
5. 查看图片预览、复制 URL、新窗口打开、下载、Usage、原始 JSON

图片返回兼容解析：

```txt
data[].url
```

## 视频异步任务测试

1. 选择视频模型
2. 输入视频 Prompt
3. 设置 `duration`、`aspect_ratio`、`hd`
4. 点击生成视频
5. 后端提交异步任务
6. 前端获取 `task_id`
7. 前端自动轮询任务接口
8. 成功后展示视频预览、复制 URL、新窗口打开、下载

轮询支持手动取消，默认最长等待 10 分钟。

## API 路由

公开接口：

```txt
GET /api/health
POST /api/validate-base-url
GET /api/models
POST /api/proxy/chat
POST /api/proxy/image
POST /api/proxy/video
POST /api/proxy/video-task
POST /api/run-template
POST /api/query-task-template
```

管理员接口：

```txt
GET /api/admin/config
POST /api/admin/config
GET /api/admin/models
POST /api/admin/models
PUT /api/admin/models/:id
DELETE /api/admin/models/:id
GET /api/admin/templates
POST /api/admin/templates
PUT /api/admin/templates/:id
DELETE /api/admin/templates/:id
```

endpoint 映射：

```txt
chat -> /v1/chat/completions
image_generation -> /v1/images/generations
video_generation_async -> /v1/images/generations?async=true
video_task_query -> /v1/images/tasks/{task_id}
```

## 常见错误说明

- `API Key 错误、无权限或余额不足`：上游返回 401。
- `当前站点、模型或接口不可用`：上游返回 403，或站点安全检查未通过。
- `接口路径或模型名称错误`：上游返回 404。
- `请求过快或额度限制`：上游返回 429。
- `上游服务异常，请稍后重试`：上游返回 500 或服务异常。
- `请求超时，请稍后重试`：请求超过当前接口超时时间。
- `非多元探索旗下站点，不适用于本网站`：Base URL 不属于允许站点。
- `请输入正确的 HTTPS API 地址`：地址不是合法 URL，或不是 HTTPS。

## 安全设计说明

- 服务端不保存用户 API Key
- 服务端不保存用户对话历史
- 服务端不保存用户生成图片或视频
- 前端默认只在内存中保存 API Key
- 用户勾选“记住本次会话”后，API Key 仅保存到 `sessionStorage`
- Base URL 每次请求前都由服务端校验
- 代理接口不接受用户传入完整 URL
- 后端只根据固定 `endpointMap` 拼接上游路径
- 上游请求只转发必要请求头
- `Authorization` 使用用户输入的 API Key
- `Content-Type` 固定为 `application/json`
- 代理前会解析 hostname 并拦截内网 / localhost 地址
- 普通接口和管理员接口有基础 IP 限流
- 视频提交接口限流更严格

## 浏览器本地缓存

浏览器本地可能保存：

- 最近使用 Base URL
- 最近选择模型
- 最近 5-10 条测试记录
- 最近图片 / 视频 URL
- 是否关闭动效

不会保存到服务端。
