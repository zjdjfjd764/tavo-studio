# 世界书（worldbook）创造方法总览（共 5 种）

从 Tavo 库内实际资产蒸馏（方法1 参照「藤原Yuki的日常世界」、方法2 参照「淫商巫女」），并吸收 SillyTavern 社区先进方法（官方 World Info 文档、[《World Info Encyclopedia》](https://blog.qzink.me/posts/SillyTavern-%E4%B8%96%E7%95%8C%E4%BF%A1%E6%81%AF%E7%99%BE%E7%A7%91%E5%85%A8%E4%B9%A6/) 中文版、[Lorebooks as ACTIVE scenario and character guidance tool](https://huggingface.co/sphiratrioth666/Lorebooks_as_ACTIVE_scenario_and_character_guidance_tool) 的主动引擎思路）。

> **Tavo 特性注意**：以下方法用到 `probability`（概率）、`sticky`（粘性）、`cooldown`（冷却）、递归级联等高级能力时，若目标 Tavo 版本不支持（以 `tools/list` 实际 schema 为准），使用各节给出的**退化方案**，不要硬塞不存在的字段。

## 选型决策表（先看这张表再动笔）

| 题材类型 | 推荐方法 |
|---|---|
| 日常/场景/剧情向（藤原Yuki 类） | **方法1 关键词触发型** |
| 游戏化/RPG/数值向（淫商巫女 类） | **方法2 常驻引擎型** |
| 复杂世界观：多势力/多地点/多角色，资料互相引用 | **方法3 递归知识树型** |
| 同一角色多版本/多场景切换/SFW 底卡叠加 NSFW 扩展 | **方法4 知识书叠加型** |
| 剧情事件驱动/随机事件/需要 AI 主动推进剧情 | **方法5 主动情景引擎型** |
| 成人向角色卡 | 任意方法 **+ 必加**「语言风格/黄腔指南」条目（见 `docs/explicitness-guide.md` §5） |

---

## 方法1：关键词触发型（原「模式A」，日常/场景/剧情向）

结构：1 条 `constant` 世界总览 + 6-10 条 `keyword` 条目。关键词命中才注入，省 token、按需呈现。

### 推荐条目清单

| identifier | 条目名 | strategy | 关键词示例 |
|---|---|---|---|
| world_overview | 世界总览 | constant | (无，常驻) |
| {char}_profile | {角色}人物档案 | keyword | 角色名、昵称 |
| {char}_outfit | 服装装扮 | keyword | 服装相关词 |
| main_scene | 主要场景 | keyword | 场景/地点词 |
| daily_routine | 日常作息 | keyword | 日常/起床/晚安 |
| food_taste | 饮食口味 | keyword | 茶/咖啡/点心 |
| relationship | 人物关系 | keyword | 主人/朋友/想你 |
| {char}_secret | 小秘密 | keyword | 秘密/心事/月亮 |
| {char}_speech_style | 说话风格/黄腔指南 | constant | (成人卡必加，见 explicitness-guide §5) |

### 条目 JSON 模板

```json
{
  "identifier": "yuki_profile",
  "name": "Yuki的人物档案",
  "strategy": "keyword",
  "injectionPosition": "lorebookBefore",
  "injectionDepth": 4,
  "injectionRole": "system",
  "keywords": ["藤原Yuki", "yuki", "雪酱"],
  "content": "……正文，用 {{char}} / {{user}} 宏……"
}
```

### 写法要点
- 世界总览：交代世界观一句话内核 + 与{{user}}的关系，2-4 句
- 人物档案：外貌 + 性格 + 与{{user}}相处方式，150-300 字
- 场景条目：把场景写成「可被 AI 随时取用的环境档案」
- 每条都要能让 AI「直接照着演」，而不是抽象描述
- 关键词要覆盖「用户可能说的话」：昵称、爱称、地点别名都挂上

---

## 方法2：常驻引擎型（原「模式B」，游戏化/RPG/恶堕向）

结构：全部 `constant`，按 `injectionDepth` 分层，共同构成一套「游戏引擎」。参照「淫商巫女」的 15 条结构。

### 分层参考（淫商巫女实例）

| depth | 条目 | 作用 |
|---|---|---|
| 0 | 【状态栏】【掉落学说】 | 每次回复携带的数值面板与掉落规则 |
| 1 | 【选项学说】 | `<option>` 四选一交互系统 |
| 3 | 【主地图】【求饶学说】【性癖学说】【色诱学说】【行为学说】 | 世界观地图 + 战斗中的行为规则 |
| 4 | 【战斗学说】【吸能学说】 | 战斗结算机制 |
| 5 | 【属性学说】 | 属性面板规则 |
| 6 | {角色}档案 / {{user}}外貌DIY / {{user}}属性技能DIY | 角色完整档案 + 用户自定义 |

### 选项系统模板（模式 B 必配）

```text
<option tickbubble>
系统创造性设计四个选项卡放在结尾，分别是交互选项，探索选项，犯贱选项，白给选项。玩家不一定要选择选项卡中内容，玩家也可以自行选择主角执行的内容。
```
请选择你的下一步行动：
 ##
 ##
 ##
 ##
```
并在四个选项卡中使用恰当的emoji表情。
</option tickbubble>
```

### 角色档案条目模板（方法2核心，可上万字）

```text
名称:{角色名}
LV: X | HP: xxx/xxx
ATK: x | DEF: x | MAG: x
居住地:……
日常伪装身份:……
种族背景:……(身世、立场、动机，带戏剧冲突)
外貌形体:……(发/眼/脸/身/服装/鞋袜/配饰，写满细节)
种族特性:
【被动1】……(名称+机制+数值)
【被动2】……
诱惑陷阱:{陷阱名}
（分类 | 使用条件 | 触发后的行为流程，写清步骤与话术)
色诱技能1:{技能名}
（分类 | 数值 | 造成的负面状态 | 概率附加永久负面性癖，分LV1-LV5)
榨取技能:{技能名}
（触发条件 | 流程 | 收益)
弱点:……(写清可被攻破的方式)
处决偏好:……(阶段化流程)
贩卖物品:{物品名}
（外观 | 售价/试用价 | 购买说明 | 试用陷阱 | 效果)
```

### 玩法机制条目模板（战斗/属性/掉落）

```text
【机制名】
规则:……(判定方式，伤害公式，命中率)
生效条件:……(什么时候启用)
结算:……(每回合/每次触发时 AI 要做什么)
特殊状态:[状态名](持续N回合/触发概率N%/效果……)
```

### 写法要点（方法2质量红线）
- 一切都要**数值化、可判定**：AI 不是「感受到」规则，而是「读到」规则后执行
- 角色行为要有**动机与伪装**：表面身份 vs 真实目的（如淫商巫女的「内恶外圣」）
- 技能/物品要有**分级与后果**：LV1→LV5 递进、使用陷阱、失败代价
- 善用 `{{user}}` 宏把玩家嵌进规则；条件分支用「若……则……」写清
- 成人向：按 `docs/explicitness-guide.md` 补语言风格条目与露骨度条款

---

## 方法3：递归知识树型（Recursive Lore Tree，复杂世界观向）

**概念**：条目之间互相引用——父条目在正文里**提到子条目的关键词**，命中父条目时自动级联把子条目也拉进上下文，形成一棵「按需展开」的知识树。只展开被聊到的分支，省 token 且资料不会互相打架。

来源：《世界信息百科全书》递归扫描章节——例：提到 `monsters` 注入 `[Farlandia的怪物: slimes]`，而正文含 `slimes` 又触发 `[slime: …]` 细节条目。

### 结构

```
世界总览 (constant) ──► 分类索引条目 (constant 或 keyword，正文列下级关键词)
                              ├──► 叶子条目A (keyword，正文含下级关键词)
                              ├──► 叶子条目B (keyword)
                              └──► 叶子条目C 的正文又提到「幼体/巢穴」→ 二级叶子
```

- 顶层：1 条世界总览，交代世界观内核（constant）
- 中层：分类索引条目，2-4 行摘要 + 末尾「相关关键词：X Y Z」
- 叶子：具体条目，正文结尾列出再下级关键词形成级联

### 示例（怪物体系）

```text
【Farlandia的怪物】constant
  这片大陆的怪物分三类：史莱姆、龙、兽人。相关关键词：史莱姆 龙 兽人

【史莱姆】keyword (keywords: 史莱姆 slime)
  [slime: enemy, slimeball, made of gelatin, bounces to move, annoyance]
  相关关键词：史莱姆王 史莱姆粘液

【史莱姆王】keyword (keywords: 史莱姆王 boss)
  精英史莱姆，体型是普通的三倍……掉落：史莱姆王核
```

### 写作规则
- 叶子条目正文**末尾固定写「相关关键词：……」**，这是级联的钩子
- 上层条目只写摘要（2-4 行），细节放叶子，避免重复
- 防止循环引用（A→B→A）；防止链太深（建议 ≤3 层）
- **退化方案**（Tavo 不支持递归时）：父条目正文直接内联子条目 1-2 行摘要；或把子条目关键词合并挂到父条目上，让父条目正文写全

---

## 方法4：知识书叠加型（Lorebook Stacking，多版本/多场景向）

**概念**：一套「核心世界书」装公共信息（世界总览 + 角色公共档案 + 公共地点），再叠「扩展世界书」装特定场景/版本的增量（日常包、学院包、异世界包、NSFW 包）。核心与扩展**独立更新、按需挂接**，一个角色 N 个版本不用复制整本。

来源：《世界信息百科全书》「知识书叠加」——SFW 底卡 + NSFW 扩展卡共用核心 lorebook。

### 结构

```
核心世界书（constant 为主）
  ├── 世界总览 / 角色公共档案 / 公共地点 / 公共人物关系
扩展世界书A：日常场景包（keyword：日常/上学/家务……）
扩展世界书B：色情场景包（constant 浅层：语言风格条目 + 性癖 + 床戏场景）
扩展世界书C：异世界/时间线包（keyword：异世界/穿越……）
```

### 适用场景
- 同一角色多版本（日常版/学院版/异世界版）切换
- **SFW 底卡 → NSFW 扩展**：核心保持清水，色情包单独一本，想开就挂、不想开就摘
- 多角色共享同一世界观：核心世界书一个，每个角色只挂自己需要的扩展

### Tavo 实现方式（二选一）
1. **多本世界书**：核心 + 扩展分开建，通过角色卡 `extensions.world` 或世界书挂接功能组合（推荐，更新互不影响）
2. **单本世界书内分层模拟**：核心条目 `injectionDepth` 高（如 5-6），扩展条目深度低（如 0-2）常驻，用「常驻层 = 核心 + 扩展」拼出叠加效果；适合不想维护多本书的情况

### 写法要点
- 核心条目只放**多版本通用**的信息，版本特有内容一律进扩展
- 扩展条目的正文开头写清适用范围（「仅当处于学院场景时生效」），防止串味
- NSFW 扩展包必含「语言风格/黄腔指南」条目（`docs/explicitness-guide.md` §5）

---

## 方法5：主动情景引擎型（Active Scenario Engine，事件驱动向）

**概念**：世界书不只是「资料库」，还是「规则引擎」——条目直接注入「现在该发生什么、角色该怎么做」的指令，配合 `probability`（随机事件）、`sticky`（事件持续 N 轮）、`cooldown`（冷却）制造事件节奏，让 AI 主动推进剧情而不是被动等{{user}}。

### 结构（三类条目）

```
规则条目（constant，短而强制）
  └── 场景推进规则：每 N 轮推进一个阶段、当前阶段该发生什么
事件条目（probability 低概率 / 关键词触发 + sticky 持续 N 轮）
  └── 随机事件：2-3 个 <option> 分支 + 后果
状态条目（{{setvar}} / {{getvar}} 维护进度）
  └── 剧情阶段变量、好感度、任务进度
```

### 示例

```text
【场景推进规则】constant (atDepth@1)
  当前剧情阶段：{{getvar::stage}}。
  阶段1：相识（1-3轮）→ 阶段2：暧昧（4-8轮）→ 阶段3：表白（9轮后）。
  每轮回复末尾，若对话轮数满足升级条件，自动推进 {{incvar::stage}} 并演出对应事件。

【夜晚敲门事件】keyword (keywords: 敲门 深夜 睡不着，sticky: 3，probability: 40)
  深夜{{user}}敲门。事件持续3轮，期间{{char}}必须：
  1) 开门时的表情与台词（带性张力）
  2) <option> 邀请进门 / 追问原因 / 假装没听见
  3) 第3轮结束事件，按选择给出后果

【好感度】constant (atDepth@0)
  当前好感：{{getvar::affection}}。好感 ≥60 时{{char}}主动牵手，≥80 主动索吻，≥100 主动求欢。
```

### 写作规则
- 规则条目要**可执行、带触发条件与后果**，让 AI 直接照做
- 事件条目给出 2-3 个 `<option>` 分支，避免 AI 一条路走到黑
- 用 `probability` 做惊喜（随机事件 20-50%），用 `sticky` 让事件延续，用 `cooldown` 防刷屏
- 用变量宏（`{{setvar}}`/`{{getvar}}`/`{{incvar}}`）维护跨轮状态，这是「长期运行」的关键
- **退化方案**（Tavo 不支持 probability/sticky 时）：把「概率」写进条目正文让 AI 自己掷 `{{roll::1d100}}`，把「持续 N 轮」写成「事件开始后，直到{{user}}做出明确选择前一直生效」

---

## 通用命名
- 世界书名：`{角色名}的{世界}`（如「藤原Yuki的日常世界」「淫商巫女's Lorebook」）；叠加型用 `{角色名}的{世界}·{版本/场景}`
- 条目 identifier：小写下划线，全局唯一

## 参考来源
- [SillyTavern 官方 World Info 文档](https://docs.sillytavern.app/usage/worldinfo.md)（递归扫描/Timed Effects/策略）
- [《World Info Encyclopedia》中文版（kingbri/Alicat/Trappu 著，Qzink 译）](https://blog.qzink.me/posts/SillyTavern-%E4%B8%96%E7%95%8C%E4%BF%A1%E6%81%AF%E7%99%BE%E7%A7%91%E5%85%A8%E4%B9%A6/)（知识书叠加/PList 基础/递归扩展性算法）
- [Lorebooks as ACTIVE scenario and character guidance tool](https://huggingface.co/sphiratrioth666/Lorebooks_as_ACTIVE_scenario_and_character_guidance_tool)（主动引擎思路）
