# @ssk_dev/pi-plan-mode-lean

<!-- token-benchmark:summary:start -->
> **Token 基准：Lean 227，上游 `@narumitw/pi-plan-mode@0.59.4` 480，减少 52.7%。**
<!-- token-benchmark:summary:end -->
> 更多 lean 扩展见 [my-lean-pi-setup 单体仓库](https://github.com/loxoron218/my-lean-pi-setup)

[English](./README.md)

[`@narumitw/pi-plan-mode`](https://github.com/narumiruna/pi-plan-mode) 的轻量 Pi 封装。完整保留 Plan-mode 引擎，同时大幅减少启动 token 开销：上游的两个工具（`plan_mode_question`、`plan_mode_complete`）被合并为单个 `plan` 工具，通过 `op` `question` | `complete` | `help` 调用。

## 上下文占用基准测试

<!-- token-benchmark:benchmark:start -->
单独启用本扩展时，模型可见的常驻初始化上下文如下：

| 版本 | 工具与 Prompt 构成 | 合计 |
| --- | --- | ---: |
| Lean `pi-plan-mode-lean@0.59.4` | `plan` (227) | **227** |
| 上游 `@narumitw/pi-plan-mode@0.59.4` | `plan_mode_question` (343) + `plan_mode_complete` (137) | **480** |

节省 **253 tokens（52.7%）**。
测量环境为 Pi 1.3.0 的独立临时进程、空白工作目录与空白配置。排除内置工具、Skills、上下文文件、会话历史、用户消息、无关扩展、运行时 UI 与 Slash Commands；计入扩展的 `before_agent_start` 注入。Token 是按 `ceil(字符数 / 4)` 计算的固定字符代理估算，并非模型 tokenizer 实际计费值。
<!-- token-benchmark:benchmark:end -->

## 核心特性

* 相同的 Plan-mode 引擎：上游扩展在 facade 之后原样运行——`/plan` 命令、菜单、UI 流程、校验与完成渲染均保持不变。
* 两个工具合而为一：`op: question` 提出 1–3 个结构化问题，`op: complete` 单独作为最后一个动作提交可直接执行的计划。当载荷无歧义时可自动推断 `op`。
* 按需获取完整 schema：`op: help` 返回两个上游工具的完整描述与参数 schema。
* 工具列表保持稳定：上游工具永远不会被注册，也不会更改 active 工具集，因此 prompt 缓存不受影响。

## 安装

```bash
pi install npm:@ssk_dev/pi-plan-mode-lean
```

不要与另一个 `pi-plan-mode` 封装同时加载，以免注册重复工具。

## 用法

模型只与一个工具交互：

```text
plan
```

用 `op: question` 加 `questions` 数组提出结构化问题，或用 `op: complete` 加 `plan`（Markdown，1–50,000 字符）提交可直接执行的计划——完全依照上游工具的要求，单独作为最后一个动作。两个 op 都只在 Plan contract 声明 `/plan` 模式激活时适用。

## 版本

- Lean 封装：`0.59.4`
- 上游依赖锁定为 `@narumitw/pi-plan-mode@0.59.4`。

## 开发

```bash
npm install
npm run check
```

## 许可证

MIT。本项目封装 MIT 许可的 [`@narumitw/pi-plan-mode`](https://github.com/narumiruna/pi-plan-mode)。
