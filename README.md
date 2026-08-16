# Tavo 角色卡工作室（DSH 代理预设）

> 把视频链接（抖音 / YouTube / B站 / 其他）变成可直接导入 **Tavo** 的 AI 角色卡 + 世界书。
> 面向 **DeepSeek Harness（DSH）** 用户的代理预设，自带完整技能，装好即用。

## 功能

- **抖音反爬专项流程**：短链解析 → 无头 Edge 渲染 → douyinpic 签名直链下载（已实测）
- **视觉分析**：图片/视频交给 `multimodal-tool` 技能分析，提取人物外貌、场景、氛围、台词
- **高质量角色卡**：对齐库内高质量卡片的写作规范，字段全写满 + Tavo 宏（`{{user}}`/`{{char}}`/`{{setvar::}}` 等）
- **世界书五种创造方法**：关键词触发型 / 常驻引擎型 / 递归知识树型 / 知识书叠加型 / 主动情景引擎型
- **成人向卡片露骨度规范**：Lv1-5 尺度阶梯、露骨词汇表、黄腔句式、字段注入模板
- **MCP 直连导入**：dryRun 预览 diff → 真实写入 → 搜索验证，全程中文

## 前置依赖

1. **DeepSeek Harness（DSH）** 已安装并可用
2. **`multimodal-tool` 技能**（视频/图片视觉分析，自带你自己的 API 密钥）——本预设通过它做视觉分析，路径以该技能文档为准
3. **Tavo 客户端**：设置 → MCP Server → 启用服务器（默认关闭），并记录 `Server URL` 与 `Authorization: Bearer xxx`

## 🚀 一键安装

打开 PowerShell，运行下面**任一条**（国内网络推荐 jsDelivr 通道）：

```powershell
# 国内 / CDN
iwr -useb https://cdn.jsdelivr.net/gh/zjdjfjd764/tavo-studio@main/install.ps1 | iex

# 国际 / raw
iwr -useb https://raw.githubusercontent.com/zjdjfjd764/tavo-studio/main/install.ps1 | iex
```

安装时脚本会：
1. 把预设装到 `%USERPROFILE%\.dsh\.agent-presets\tavo-studio\`（或 `$env:DSH_HOME\.agent-presets\`，已有副本自动备份）
2. 询问一次**工作目录**（角色卡/世界书/图片保存位置，默认 `%USERPROFILE%\Tavo工作室`）

装完重启 DSH 或刷新预设列表，新会话选择预设 **「Tavo 角色卡工作室」** 即可。

## 手动安装（不跑脚本）

```powershell
git clone https://github.com/zjdjfjd764/tavo-studio
# 把 tavo-studio/ 目录整个复制到：
#   %USERPROFILE%\.dsh\.agent-presets\tavo-studio\   （或 $env:DSH_HOME\.agent-presets\）
# 然后把以下文件里的 @@WORKSPACE@@ 替换成你自己的工作目录：
#   agent.cordis.yml / preset.yml / skills/tavo-roleplay-creator/SKILL.md
```

## 卸载

```powershell
iwr -useb https://cdn.jsdelivr.net/gh/zjdjfjd764/tavo-studio@main/restore.ps1 | iex
```

或直接删除 `%USERPROFILE%\.dsh\.agent-presets\tavo-studio\` 文件夹。

## 使用

1. 在 DSH 里用「Tavo 角色卡工作室」预设开新会话
2. 发一个视频链接（抖音短链 / YouTube / B站均可），可一次发多个
3. 代理会：解析视频 → 视觉分析 → 生成角色卡 + 世界书 → 向你索要 Tavo MCP 连接（URL + Bearer token）→ dryRun 预览 → 导入 → 验证并汇报

> 成人向内容会在生成前确认尺度等级（未指定默认 Lv3）。

## 更新 / 发布维护（维护者）

```powershell
# 改完推送后必须清 jsDelivr 缓存，否则别人拿到的还是旧文件：
# 打开 https://purge.jsdelivr.net/gh/zjdjfjd764/tavo-studio@main
# 验证发布：
powershell -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1 -Owner zjdjfjd764 -Repo tavo-studio -Branch main -LocalDir .
```

注意：**仓库必须保持公开**，raw / jsDelivr 才能匿名访问。

## 目录结构

```
tavo-studio/
├── agent.cordis.yml                  # DSH 预设组合（人格 + 工具 + 技能挂载）
├── preset.yml                        # 预设显示名与简介
└── skills/tavo-roleplay-creator/     # 自带技能
    ├── SKILL.md                      # 完整工作流（抖音反爬 / 字段规范 / MCP 导入）
    ├── docs/                         # 字段与宏、世界书五法、露骨度规范
    └── scripts/                      # tavo_rpc.ps1（MCP JSON-RPC 助手）、make_args.py
```

## 免责声明

- 请勿用于生成未经授权的真实人物形象，或制作违法、侵权内容
- 成人向内容仅用于符合当地法律与平台政策的创作场景
- 本项目与抖音 / YouTube / B站 / Tavo 均无关联，所有操作均为用户自备账号与工具
