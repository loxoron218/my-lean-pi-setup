# pi-deep-research-lean（简体中文）

<!-- token-benchmark:summary:start -->
> **Token 基准：Lean 0，上游 `pi-deep-research@0.4.1` 776，减少 100.0%。**
<!-- token-benchmark:summary:end -->
> 更多精简扩展见 [my-lean-pi-setup 单体仓库](https://github.com/loxoron218/my-lean-pi-setup)

[English](./README.md)

[`pi-deep-research`](https://github.com/fank/pi-deep-research) 的轻量 Pi 封装。完整保留上游深度研究引擎，同时大幅降低启动 token 开销：上游的三个工具（`web_search`、`web_extract`、`research_checkpoint`）合并为一个 `research` 工具，`op` 为 `search` | `extract` | `checkpoint` | `help`。

## 上下文占用基准

<!-- token-benchmark:benchmark:start -->
单独启用本扩展时，模型可见的常驻初始化上下文如下：

| 版本 | 工具与 Prompt 构成 | 合计 |
| --- | --- | ---: |
| Lean `pi-deep-research-lean@0.4.1` | 无常驻注入 | **0** |
| 上游 `pi-deep-research@0.4.1` | `web_search` (234) + `web_extract` (104) + `research_checkpoint` (438) | **776** |

节省 **776 tokens（100.0%）**。
测量环境为 Pi 1.3.0 的独立临时进程、空白工作目录与空白配置。排除内置工具、Skills、上下文文件、会话历史、用户消息、无关扩展、运行时 UI 与 Slash Commands；计入扩展的 `before_agent_start` 注入。Token 是按 `ceil(字符数 / 4)` 计算的固定字符代理估算，并非模型 tokenizer 实际计费值。
<!-- token-benchmark:benchmark:end -->

## 核心特性

* 同样的研究引擎：上游扩展在 facade 之后原样运行—— provider 链（Tavily / Brave）、正文抽取、CONTINUE/PROCEED 检查点门控都不变。
* 三工具合一：`op: search` 找来源，`op: extract` 全文读取页面，`op: checkpoint` 提交进度换取继续/放行 verdict。payload 无歧义时自动推断 `op`。
* 完整 schema 按需获取：`op: help` 返回三个上游工具的完整描述与参数 schema。
* 罕用选项仍然可用：`search_depth` / 域名过滤（search）、`contradictions` / `gaps`（checkpoint）通过 JSON 字符串 `options` 字段传递，常用字段保持类型化。
* 工具列表稳定：上游工具永不注册，active 工具集永不改动，prompt 缓存不受影响。
* 同样的工作流资产：`pi-deep-research` skill、`/research` 命令与报告模板一并提供，仅适配了工具名引用（`research_checkpoint` → `research` op `checkpoint`）。

## 安装

```bash
pi install npm:pi-deep-research-lean
```

不要与其它 `pi-deep-research` 封装同时加载，以免重复注册工具。

## 用法

模型只与一个工具交互：

```text
research
```

用 `op: search` 加 `query`/`queries` 搜索，用 `op: extract` 加 `url` 读全文，每轮搜索后用 `op: checkpoint` 提交进度——与上游工具要求一致，必须服从 CONTINUE/PROCEED verdict 才能写报告。

## 版本

- 精简封装：`0.4.1`
- 上游依赖锁定为 `pi-deep-research@0.4.1`。

## 开发

```bash
npm install
npm run check
```

## 许可证

MIT。本项目封装 MIT 许可证的 [`pi-deep-research`](https://github.com/fank/pi-deep-research)。
