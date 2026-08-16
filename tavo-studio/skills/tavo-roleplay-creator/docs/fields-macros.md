# Tavo 字段与宏参考(基于 Tavo 0.93.0 MCP schema + 官方文档)

## 角色卡(`character`)字段

来源:`tavo_character_create` / `tavo_character_update` 的 inputSchema。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | ✅ | 角色名(minLength 1) |
| `description` | string | ✅ | 角色设定(身份/外貌/性格/关系) |
| `first_mes` | string | ✅ | 首次开场白 |
| `nickname` | string | | 昵称 |
| `personality` | string | | 性格特点 |
| `scenario` | string | | 场景描述 |
| `mes_example` | string | | 对话示例(用 `<START>`...`<END>` 包裹) |
| `creator_notes` | string | | 附加信息/备注 |
| `system_prompt` | string | | 系统指令 Main Prompt |
| `post_history_instructions` | string | | 系统指令 Post-History |
| `alternate_greetings` | string[] | | 备用开场白数组 |
| `tags` | string[] | | 标签数组 |
| `creator` | string | | 作者 |
| `character_version` | string | | 角色版本 |
| `character_book` | object | | 内嵌世界书(一般不用,单独建世界书) |
| `extensions` | object | | 扩展字段,`extensions.world`=世界书名字 |

真实存储结构中还有:`avatar`、`creator_notes_multilingual`、`source`、`group_only_greetings`、`creation_date`、`modification_date`(写入时不必提供,由服务端维护)。

## 世界书(`lorebook`)字段

来源:`tavo_lorebook_create` / `tavo_lorebook_update` / `tavo_lorebook_entry_upsert`。

### lorebook 顶层
- `name`(必填)
- `entries`: 条目数组

### entry 字段
| 字段 | 类型 | 必填 | 枚举/说明 |
|---|---|---|---|
| `identifier` | string | ✅ | 条目唯一ID |
| `name` | string | ✅ | 条目名 |
| `content` | string | ✅ | 条目正文 |
| `strategy` | string | ✅ | `constant`(常驻) \| `keyword`(关键词触发) |
| `injectionPosition` | string | | `lorebookBefore` \| `lorebookAfter` \| `topOfExampleMessages` \| `bottomOfExampleMessages` \| `atDepth` |
| `injectionDepth` | int | | 注入深度(与 atDepth 配合,0-6 常用) |
| `injectionRole` | string | | `system` \| `user` \| `assistant`(默认 system) |
| `keywords` | string[] | | 触发关键词 |
| `secondaryKeywords` | string[] | | 次级关键词 |
| `secondaryKeywordStrategy` | string | | `none` \| `andAny` \| `andAll` \| `notAny` \| `notAll` |
| `scanDepth` | int | | 扫描深度(默认2) |
| `caseSensitive` | bool | | 是否区分大小写 |
| `matchWholeWord` | bool | | 是否整词匹配 |
| `probability` | int | | 触发概率 0-100 |
| `sticky` | int | | 粘性(命中后保持轮数) |
| `cooldown` | int | | 冷却 |
| `delay` | int | | 延迟 |
| `enabled` | bool | | 是否启用 |

## 宏(Macros)全表

来源:Tavo 官方文档「宏(Macros)」页面。宏写法 `{{宏名称}}`,带参数用 `::` 分隔。

### 角色与用户
- `{{user}}` — 用户身份名字
- `{{char}}` — 角色名字
- `{{group}}` / `{{charIfNotGroup}}` — 群聊所有角色(逗号分隔)
- `{{groupNotMuted}}` — 群聊中未禁言的角色

### 角色卡内容
- `{{charDescription}}` / `{{description}}` — 角色设定
- `{{charPersonality}}` / `{{personality}}` — 性格
- `{{charScenario}}` — 角色卡场景;`{{scenario}}` 对话级优先
- `{{persona}}` — 用户身份描述
- `{{charPrompt}}` — Main Prompt
- `{{charInstruction}}` / `{{charJailbreak}}` — Post-History
- `{{mesExamples}}` — 对话示例(已渲染);`{{mesExamplesRaw}}` 原文
- `{{charVersion}}` — 角色版本;`{{charCreatorNotes}}` / `{{creatorNotes}}` 备注

### 消息
- `{{lastMessage}}` — 最后一条消息
- `{{input}}` — 用户输入
- `{{lastUserMessage}}` / `{{lastCharMessage}}`

### 日期时间
- `{{time}}` / `{{date}}` / `{{weekday}}`
- `{{isotime}}`(时:分) / `{{isodate}}`(年-月-日)
- `{{idleDuration}}` / `{{idle_duration}}`
- `{{time::UTC+9}}` — 指定时区时间

### 随机
- `{{random::1::3::5}}` / `{{random::1,3,5}}` — 随机取一
- `{{roll::3d6}}` — 骰子

### 格式化
- `{{newline}}` / `{{newline::3}}` — 换行
- `{{space}}` / `{{space::3}}` — 空格
- `{{trim}}` — 去首尾空白
- `{{noop}}` — 空
- `{{//注释}}` — 注释,渲染为空
- `\{\{char\}\}` — 转义,输出字面 `{{char}}`

### 聊天变量(仅当前聊天)
- `{{setvar::名::值}}` — 设置(支持数字/文字/JSON列表)
- `{{addvar::名::值}}` — 追加(数字加/文字拼/列表尾插)
- `{{incvar::名}}` / `{{decvar::名}}` — +1 / -1
- `{{getvar::名}}` — 读取

### 全局变量(跨聊天)
- `{{setglobalvar::名::值}}` / `{{addglobalvar::名::值}}` / `{{incglobalvar::名}}` / `{{decglobalvar::名}}` / `{{getglobalvar::名}}`

### 已过时(Legacy)
- `<USER>` / `<CHAR>` / `<BOT>` / `<GROUP>` / `<CHARIFNOTGROUP>`

## 应用示例

- 角色定义:「{{char}} 是宋氏集团的总裁。{{user}} 是 {{char}} 的秘书。」
- 世界书条目(触发关键词"治疗术"):「{{user}} 使用了治疗术,生命值回满,魔法值 -10。{{setvar::hp::100}} {{addvar::mp::-10}}」
- 正则尾部状态栏:「{{user}} 当前状态:生命值:{{getvar::hp}} 魔法值:{{getvar::mp}}」
