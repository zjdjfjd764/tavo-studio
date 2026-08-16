---
name: tavo-roleplay-creator
description: 从视频链接制作 Tavo 角色卡与世界书并直接导入 Tavo。当用户提供抖音/YouTube/B站等视频链接,要求"生成角色卡""做世界书""导入Tavo""根据视频做AI角色"时使用。技能内置抖音反爬解析流程、对齐 Tavo 现有高质量卡片(如顾青霜)与游戏化世界书(如淫商巫女)的写作规范、五种世界书创造方法(关键词触发/常驻引擎/递归知识树/知识书叠加/主动情景引擎)、成人卡露骨度写作规范(露骨词汇+黄腔句式+尺度阶梯)、以及经验证的 MCP 导入流程,无需重复查看已有卡片即可产出可直接导入的成品。
---

# Tavo 角色卡与世界书制作

根据视频链接(抖音/YouTube/B站/其他)分析视频内容 → 生成 Tavo 角色卡 + 世界书 → 通过 MCP 直接导入 Tavo → 验证导入成功。

所有内容使用中文撰写。角色卡与世界书必须对齐 Tavo 现有高质量资产的水准(参考库内「顾青霜」「淫商巫女」的密度与写法),不要在生成后再反复读取已有资产来对齐格式——本技能已把规范全部固化,直接按以下步骤执行。

## 工作流总览

1. **连接 Tavo MCP** → 确认服务器在线、工具可用
2. **分析视频** → 解析视频链接,用视觉模型提取人物/场景/氛围细节
3. **生成角色卡** → 按字段规范与质量标准写满全部核心字段
4. **生成世界书** → 先看 `docs/worldbook-patterns.md` 的选型决策表,按题材从五种方法中选一种(方法1 关键词触发型 / 方法2 常驻引擎型 / 方法3 递归知识树型 / 方法4 知识书叠加型 / 方法5 主动情景引擎型);成人向卡必加「语言风格/黄腔指南」条目
5. **导入并验证** → 生成参数 JSON → MCP 写入 → 搜索确认

---

## 第 1 步:连接 Tavo MCP

从用户提供的连接配置(形如 `Server URL: http://192.168.1.47:7347/mcp` + `Authorization: Bearer xxxx`)得到 URL 与 token。

用 `scripts/tavo_rpc.ps1` 测试:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\tavo_rpc.ps1 -Url "http://<host>:7347/mcp" -Token "<token>" -ToolName tavo_status
```

若端口连接失败:提示用户在 Tavo 里打开 设置 → MCP Server → 启用服务器(服务器默认关闭),并确认访问范围。

每次会话开始时调用一次 `tools/list` 确认工具存在即可(本技能字段规范基于 0.93.0 版,如遇版本差异以 `tools/list` 实际 schema 为准)。

---

## 第 2 步:分析视频

### 抖音专项流程(必走,反爬绕行)

**重要环境事实(2026-08 实测)**:
- 本会话沙箱里 `curl.exe`/`Invoke-WebRequest` 的 TLS 层被沙箱拦截(`SEC_E_NO_CREDENTIALS`,exit 35),**HTTPS 一律用 Node.js fetch**(`node -e "fetch(...)"` 走 OpenSSL 不受影响)。
- 短链/网页/分享页均为 JS 反爬壳,`window._ROUTER_DATA` 多数时候只剩布局壳,不含 item 数据;aweme detail API 需要 a_bogus 签名拿不到。
- **唯一可靠路径:本机 Edge 无头渲染 + douyinpic 直链下载**(已实测成功,2026-08-15)。

完整流程:

1. **解析短链得到资源 ID**(图集是 slides 类型,不是 video):
   ```powershell
   node -e "fetch('https://v.douyin.com/xxxx/',{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'}}).then(r=>console.log(r.url))"
   # URL 形如 .../share/slides/{aweme_id}/... 或 .../share/video/{aweme_id}/...
   # 末尾数字即 aweme_id(图集/视频通用)
   ```

2. **(可选)直接抓 SSR 页提取元数据**——`share/video/{id}` 端点可能还有 `_ROUTER_DATA`,但通常只剩布局;`share/slides/{id}` 与 `www.douyin.com/video/{id}` 已是纯 JS 壳。不再指望它,直接走第 3 步。

3. **无头 Edge 渲染页面拿到真实图片直链**(核心,替代失效的 SSR/API):
   ```powershell
   $edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"   # 标准安装路径
   if (-not (Test-Path $edge)) { $edge = (Get-Command msedge -ErrorAction SilentlyContinue).Source }   # 找不到时按 PATH 查找
   $id = "<aweme_id>"
   $ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
   & $edge --headless=new --disable-gpu --no-sandbox --user-agent="$ua" --virtual-time-budget=15000 --dump-dom "https://www.iesdouyin.com/share/slides/$id/?region=CN&from_ssr=1" 2>$null | Out-File -FilePath "@@WORKSPACE@@\临时\rendered.html" -Encoding utf8
   ```
   - `--virtual-time-budget=15000` 让 JS 有时间加载真实数据(不加只有 loading 壳)。
   - 图集页渲染后,`<img src>` 里会出现 `douyinpic.com` 的签名直链(形如 `https://p96-sign.douyinpic.com/tos-cn-i-0813c000-ce/...~tplv-dy-water-v2:...webp?lk3s=...&x-expires=...&x-signature=...`),按出现顺序即图集各张图(第一张即封面);另有一张是作者头像(URL 含 `aweme-avatar`,跳过)。

4. **用 Node.js 下载图片**(douyinpic 需带 UA + Referer `https://www.iesdouyin.com/`):
   ```powershell
   node -e "fetch('<直链>',{headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15','Referer':'https://www.iesdouyin.com/'}}).then(r=>r.arrayBuffer()).then(b=>{require('fs').writeFileSync('D:/AI创作/Tavo工作室/图片/slide_1.webp',Buffer.from(b));console.log('OK')})"
   ```
   存 `@@WORKSPACE@@\图片\`,命名 `{来源}_{序号}.{ext}`。

5. **视觉分析**:用本预设自带的 **multimodal-tool** 技能(skills/multimodal-tool,脚本路径以该技能 SKILL.md 为准,以下用 <脚本路径> 占位):
   - 封面/单图: `node <脚本路径> describe "<本地图片路径>" -q "详细外貌细节"`(见下方提问模板)
   - 视频: 下载 mp4 后 `node <脚本路径> video "<本地视频路径>"`(视频直链:视频型作品可从渲染 HTML 里找 `<video>` 标签或 `douyinvod.com` 链接;也可先下载封面图兜底分析)
   - 分析产物与临时文件一律存入 `@@WORKSPACE@@\图片\` 与 `@@WORKSPACE@@\临时\`,用后即删。

**失败兜底提示**:若 Edge 渲染也拿不到图(页面改版),可尝试 `share/video/{id}` 端点替代 `share/slides/{id}`(曾出现前者有 ROUTER_DATA 而后者没有的情况);第三方解析服务(tikwm/douyin.wtf 等)通常被 Cloudflare 挡,不可依赖。

### 通用流程(YouTube/B站/其他)

- 先抓页面元数据(标题/简介/作者/标签),补充文案与世界观线索。
- 下载视频到本地后,用 `node <脚本路径> video "<路径>"` 分析;失败则检查 ffmpeg 与网络。
- 若有字幕/台词,优先提取,用于角色语气与口癖。

### 分析提问模板(保证信息密度)

> 请详细分析此视频(用于生成AI角色扮演角色卡):1) 出现的人物是谁?外貌细节(发型/发色/眼睛/脸型/身材/服装/配饰)? 2) 场景环境(室内/室外、标志景物、光线)? 3) 整体氛围与情绪基调? 4) 画面里的文字/字幕/标签? 5) 镜头语言与节奏? 6) 作品类型(街拍/写真/MV/vlog/cosplay)?

---

## 第 3 步:生成角色卡

### 字段清单(对齐 `tavo_character_create` schema)

必填: `name`、`description`、`first_mes`
选填: `nickname`、`personality`、`scenario`、`mes_example`、`system_prompt`、`post_history_instructions`、`alternate_greetings`(字符串数组)、`creator_notes`、`creator`、`character_version`、`tags`(字符串数组)、`extensions`(对象)

**全部核心字段都要写满**(参考库内「顾青霜」水准),不能留空。

### 各字段写作规范

| 字段 | 写作要点 |
|---|---|
| `description` | 3-4 段:身份背景 → 外貌细节 → 性格概括 → 与{{user}}的关系。用 `{{user}}`/`{{char}}` 宏。 |
| `personality` | 分点列举:核心特质、说话方式/口癖、行为模式、反差点(表面/实际)。 |
| `scenario` | 场景设定:时间地点、环境细节、与{{user}}的相遇情境。 |
| `first_mes` | 开场白:（动作/环境描写）对话台词……,1-3 段,含悬念或邀请,让{{user}}能自然接话。 |
| `mes_example` | `<START>` 到 `<END>`,2-4 轮对话,用 `{{user}}:` / `{{char}}:` 分行,完整展示口吻。 |
| `system_prompt` | 「你是{{char}},……」完整人设 + 互动要求 + 节奏要求,结尾用{{user}}。 |
| `post_history_instructions` | 3-5 条强规则:性格核心、对{{user}}的行为准则、节奏控制、禁止事项。 |
| `alternate_greetings` | 2-3 个不同场景/时段的开场白。 |
| `tags` | 3-7 个中文标签。 |
| `extensions.world` | 关联世界书的名字(可选,用于挂接世界书)。 |

### 成人/色情向角色卡的露骨度强制规范(重要)

色情/成人向请求,按 `docs/explicitness-guide.md` 执行,核心如下:

1. **先定尺度**:生成前问用户「尺度等级 1-5 要哪个?」,用户没指定时成人卡默认 **Lv3(标准露骨)**。不要反复确认。
2. **露骨词直呼**:身体部位/性行为一律用直接词汇(鸡巴/骚穴/奶子/肉棒……),禁用「那里/下面/玉茎」等委婉词;词汇表见 explicitness-guide §1。
3. **密度量化**:`post_history_instructions` 写死「每次性互动回复 ≥3 个露骨词(Lv3)」等硬规则;`system_prompt` 加「露骨度条款」(模板见 §4.3)。
4. **示范优先**:`mes_example` 至少 1 轮含 ≥3 露骨词 + 黄腔句式(句式模板见 §2);`first_mes`/`alternate_greetings` 全部带性张力,不允许清水版开场。
5. **世界书配合**:必加「语言风格/黄腔指南」条目(constant、`atDepth@0-1`),模板见 §5。
6. 生成后按 §6 排查表自查:「不够色」的常见原因是只写规则没写示例、婉词没禁、语言风格条目深度太高。

### 宏使用(全部可写进任意提示词字段)

`{{user}}` 用户身份名 / `{{char}}` 角色名 / `{{group}}` 群聊角色 / `{{time}}` `{{date}}` `{{weekday}}` / `{{random::1::3::5}}` / `{{roll::3d6}}` / `{{setvar::名::值}}` `{{addvar::名::值}}` `{{incvar::名}}` `{{decvar::名}}` `{{getvar::名}}` 及全局版 `{{setglobalvar::...}}`。完整列表见 `docs/fields-macros.md`。

---

## 第 4 步:生成世界书

世界书命名: `{角色名}的{世界}`(如「藤原Yuki的日常世界」;叠加型加版本后缀,如「XX的日常世界·NSFW包」)。

### 五种创造方法(先看选型决策表,按题材选一种)

| 题材 | 方法 |
|---|---|
| 日常/场景/剧情向(藤原Yuki 类) | **方法1 关键词触发型**:1 条 `constant` 总览 + 6-10 条 `keyword` 条目,关键词命中才注入 |
| 游戏化/RPG/恶堕向(淫商巫女 类) | **方法2 常驻引擎型**:全部 `constant` 按 `injectionDepth` 分层构成游戏引擎 |
| 复杂世界观(多势力/多地点/多角色) | **方法3 递归知识树型**:父条目正文提到子条目关键词,级联按需展开知识树 |
| 多版本/多场景/SFW 底卡叠 NSFW 包 | **方法4 知识书叠加型**:核心世界书(公共信息) + 扩展世界书(场景/版本增量),独立更新 |
| 事件驱动/随机事件/AI 主动推进剧情 | **方法5 主动情景引擎型**:规则条目 + 概率/粘性事件条目 + `{{setvar}}` 状态条目 |

方法2 分层参考: `atDepth@0` 状态栏/掉落 → `atDepth@1` 选项系统 → `atDepth@3` 主地图/行为/性癖/求饶 → `atDepth@4-5` 战斗/属性 → `atDepth@6` 角色档案、{{user}}外貌DIY、{{user}}属性技能DIY。角色档案条目要极其详尽:名称/等级面板/居住地/伪装身份/种族背景/外貌形体/种族特性(被动技能)/诱惑陷阱/色诱技能(分等级带数值与负面状态)/榨取技能/弱点/处决偏好/贩卖物品(价格+陷阱+效果)。

**成人向卡(不论用哪种方法)必加**:「语言风格/黄腔指南」条目(constant、`atDepth@0-1`),模板见 `docs/explicitness-guide.md` §5。

五种方法的完整结构、模板与退化方案见 `docs/worldbook-patterns.md`。

### 条目字段清单

`identifier`(唯一ID)、`name`、`content`、`strategy`(`constant`|`keyword`)、`injectionPosition`(`lorebookBefore`|`lorebookAfter`|`topOfExampleMessages`|`bottomOfExampleMessages`|`atDepth`)、`injectionDepth`(整数)、`injectionRole`(`system`|`user`|`assistant`)、`keywords`(数组)、`secondaryKeywords`、`secondaryKeywordStrategy`、`scanDepth`、`caseSensitive`、`matchWholeWord`、`probability`、`sticky`、`cooldown`、`delay`、`enabled`

### 条目写作质量红线

- 内容具体可执行:数值、条件、选项、后果都要写清楚,让 AI 直接照做
- 多用 `{{user}}`/`{{char}}` 宏注入动态信息
- 选项类内容用 `<option>` 标签组织(见模式 B 示例)
- 每条内容 100-2000 字,角色档案可到 1 万字级别(参照淫商巫女)

---

## 第 5 步:导入 Tavo

### 生成参数 JSON(关键:编码)

**推荐用 Python**(本机已有 Python 3.9): 把角色卡/世界书内容写进一个 Python 脚本(用三引号字符串,不需要转义引号和换行),`json.dump(..., ensure_ascii=False)` 输出参数 JSON。示例见 `scripts/make_args.py`。

若用 PowerShell 生成: 生成脚本 `.ps1` **必须保存为 UTF-8 带 BOM**(否则 Windows PowerShell 5.1 按 GBK 解析中文会乱码)。转换方法:
```powershell
$c = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $c, (New-Object System.Text.UTF8Encoding($true)))
```

### MCP 写入

```powershell
# 角色卡(注意:不要在 arguments 里带 dryRun,那是测试用)
powershell -ExecutionPolicy Bypass -File scripts\tavo_rpc.ps1 -Url "http://<host>:7347/mcp" -Token "<token>" -ToolName tavo_character_create -ArgumentsFile args_char.json

# 世界书
powershell -ExecutionPolicy Bypass -File scripts\tavo_rpc.ps1 -Url "http://<host>:7347/mcp" -Token "<token>" -ToolName tavo_lorebook_create -ArgumentsFile args_lore.json
```

先做一次 `dryRun: true` 预览 diff(确认字段无误),再真实写入。

### 关联世界书(可选)

角色卡可通过 `extensions.world` = 世界书名字 挂接世界书。若创建时未带,可用 `tavo_character_update` 补上(先 `tavo_character_get` 拿原数据,保留未知字段)。

---

## 第 6 步:验证与汇报

- `tavo_character_search` / `tavo_lorebook_search` 按名字搜索,确认新资产存在,记下 ID
- 向用户汇报:角色卡名/ID、世界书名/ID、条目数、来源视频信息

---

## 常见问题速查

| 问题 | 处理 |
|---|---|
| MCP 端口连接失败 | 提示用户: Tavo → 设置 → MCP Server → 启用服务器;检查防火墙/网络 |
| 抖音短链直接分析拿到 HTML | 必须走第 2 步抖音专项流程 |
| 最终 CDN 直链给视觉模型超时 | 下载到本地再分析(兜底) |
| PowerShell 生成 JSON 中文乱码 | 用 Python,或 .ps1 存 UTF-8 BOM |
| 写入失败 Parse error | 检查参数 JSON 是否为合法 JSON(用 ConvertFrom-Json / json.loads 校验) |

## 附属文件

- `docs/fields-macros.md` — 角色卡/世界书完整字段 schema + Tavo 宏全表
- `docs/worldbook-patterns.md` — 世界书五种创造方法的完整模板、选型决策表与退化方案
- `docs/explicitness-guide.md` — 成人向角色卡露骨度写作规范(露骨词汇表/黄腔句式/尺度阶梯/字段注入模板/排查表)
- `scripts/tavo_rpc.ps1` — MCP JSON-RPC 调用助手
- `scripts/make_args.py` — 用 Python 生成导入参数 JSON 的示例模板


## 文件管理规则（强制·最高优先级）

- ⛔ **禁止把任何文件写到桌面**（%USERPROFILE%\Desktop）或用户目录根（%USERPROFILE%）
- ✅ 所有产生的文件一律保存到固定工作目录：`@@WORKSPACE@@`
- 即使 Cline 打开的工作区/文件夹是桌面或其他目录，也必须写到这里，不得以「当前工作目录」为借口写到桌面
- 目录结构（按类型归类，不混放）：
  - `@@WORKSPACE@@\角色卡\` — 角色卡导入参数/备份（{角色名}_角色卡参数.json）
  - `@@WORKSPACE@@\世界书\` — 世界书导入参数/备份
  - `@@WORKSPACE@@\图片\` — 下载的参考图/封面/截图
  - `@@WORKSPACE@@\脚本\` — 生成脚本（.py / .ps1 等）
  - `@@WORKSPACE@@\临时\` — 中间解析文件/搜索参数（用后即删）
- 临时文件（下载的 HTML、中间 JSON、一次性脚本）使用后立即清理，不留垃圾
- 文件名规范：`{角色名}_{用途}.{扩展名}`，一目了然

