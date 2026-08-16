---
name: multimodal-tool
description: 多模态工具（豆包 ARK 视觉 + Volink 生图/语音 + 视频分析）。当用户要求分析/解读/识别本地图片（含截图、OCR 文字识别、图表解读）、生成/绘制/创作图片、把文字转成语音、分析视频内容时，必须使用本技能——当前模型本身不具备多模态能力，无法直接"看"图片或视频，必须调用本技能封装的脚本完成。脚本随本预设附带（skills/multimodal-tool），API 密钥需在技能目录 .env 中自行填写（安装脚本已生成并引导配置）。
---

# multimodal-tool 技能（图片解读 / 文生图 / 语音合成 / 视频分析）

## 总览

本技能封装一个零依赖 Node 脚本（Node ≥ 18，内置 fetch），为不具备多模态能力的模型提供四项能力。**脚本随本预设附带**，位于本技能目录的 `scripts\multimodal_tool.js`（安装后即 `@@MM_DIR@@\scripts\multimodal_tool.js`）；**API 密钥在同目录的 `.env` 文件里**。安装脚本已经生成 `.env` 并引导填写密钥；若还没填，先请用户配置（见下文「配置 API 密钥」），**不要臆造路径或密钥**。

- 脚本：`@@MM_DIR@@\scripts\multimodal_tool.js`（若该路径未替换，按本技能 base 目录下的 `scripts\multimodal_tool.js` 解析）
- 配置与密钥：`@@MM_DIR@@\.env`（勿打印、勿外泄密钥）
- 详细文档：`@@MM_DIR@@\docs\multimodal_readme.md`（不确定参数时先读它）

## 四个能力与调用方式

所有命令都通过 `node @@MM_DIR@@\scripts\multimodal_tool.js <命令> ...` 调用（下文用 `node <脚本> ...` 简写），产物/结果从 **stdout** 读取；失败时退出码非 0，错误在 stderr。

### 1. 图片解读（豆包 ARK 视觉）—— 用户要求"看/分析/描述/识别"图片时
```
node <脚本> describe <图片路径> [-q "具体问题"] [--thinking] [--model 模型ID] [--max-tokens N]
```
- 支持 jpg/png/webp/gif/bmp，单张 ≤ 10MB（超限先压缩再调）
- `-q` 缺省为"详细描述图片"；识别截图文字、解读图表、判断照片内容都用它
- 结果直接打印文本到 stdout

### 2. 文生图（Volink，模型后缀带 -by）—— 用户要求"画/生成/创作一张图"时
```
node <脚本> generate "<详细描述>" [-o 输出路径.png] [--size 1024x1024] [--provider volink|ark] [--count N] [--quality 档位]
```
- 描述写具体：主体 / 风格 / 构图 / 光线，中文即可
- 默认 `--size 1024x1024`；竖版 `768x1344`，横版 `1344x768`
- 默认保存为当前目录 `generated_<时间戳>.png`；指定 `-o` 更可控
- stdout 打印保存的文件路径，**调用后验证文件确实存在**
- `--provider ark` 可切豆包 Seedream（一般不需要）

### 3. 语音合成（Volink TTS）—— 用户要求"把文字变成语音/音频"时
```
node <脚本> speak "<文本>" [-o 输出.mp3] [--voice 音色ID] [--format mp3|wav|pcm|ogg] [--speed 倍速]
```
- stdout 打印保存的音频路径；默认音色为中文女声（minimax），够用
- 需要换音色时先 `voices` 查可用音色

### 4. 视频分析（ffmpeg 抽帧 + 豆包逐帧解读）—— 用户要求"分析/总结视频"时
```
node <脚本> video <视频路径> [--frames N] [--no-summary] [--keep-frames] [--thinking]
```
- 默认抽 6 帧逐帧解读并输出综合总结；`--frames` 上限 30（帧越多越细、越贵）
- 只分析画面内容；**不含音频转写**（如用户要"视频里说了什么"，如实说明暂不支持）
- 依赖 ffmpeg/ffprobe 在 PATH（不在则提示用户安装并加入 PATH）

### 辅助命令
```
node <脚本> voices          # 列出可用音色
node <脚本> image-models    # 列出生图模型（-by 后缀为第三方托管）
node <脚本> tts-models      # 列出语音模型
node <脚本> doctor          # 配置自检（排查密钥/模型问题）
```

## 工作流程要求

1. **先确认输入文件存在**：图片/视频路径要先用 glob/read 确认，不存在先告知用户而不是报 API 错。
2. **解析 stdout**：图片解读取文本；生图/语音取文件路径并验证文件生成成功。
3. **失败排查顺序**：`doctor` 查配置 → 看 stderr 错误码：
   - 401/403：密钥问题（检查 `.env` 是否填写正确）
   - 404：模型名不对 → 用 `image-models` / `tts-models` 查真实 ID
   - 429：限流，稍等重试
   - `执行 ffmpeg 失败`：ffmpeg 不在 PATH
   - `该文件中没有视频流`：文件是纯音频
4. **成本意识**：每次调用都计费。视频默认 6 帧即可；除非用户要求更细，不要擅自加大 `--frames`。
5. **密钥保密**：绝不打印 `.env` 内容或 API Key。
6. 用户说"直接看/直接分析"时：**直接调用脚本**，不要要求用户粘贴脚本路径——路径已由安装脚本固定，任何工作目录都能用绝对路径调用，产物默认保存到当前工作目录。

## 配置 API 密钥（首次使用）

密钥在 `@@MM_DIR@@\.env`（安装脚本已生成，若未生成则复制同目录的 `.env.template` 为 `.env`）。需要填三个 Key：

| 用途 | 环境变量 | 获取方式 |
| --- | --- | --- |
| 豆包 ARK（图片/视频解读） | `ARK_API_KEY` | 火山方舟控制台 https://console.volcengine.com/ark |
| Volink 生图 | `VOLINK_IMAGE_API_KEY` | Volink 平台 |
| Volink 语音 | `VOLINK_TTS_API_KEY` | Volink 平台 |

其余项（Base URL / 模型 / 音色 / 格式）脚本有内置默认值，一般不用改。填完用 `node <脚本> doctor` 自检。

## 典型示例

```bash
# 分析图片（截图 OCR）
node <脚本> describe D:\截图\error.png -q "识别图中文字并解释报错原因"
# 画图
node <脚本> generate "赛博朋克雨夜街道，霓虹灯，电影感" -o D:\out\city.png --size 1344x768
# 语音
node <脚本> speak "欢迎使用多模态助手" -o D:\out\welcome.mp3
# 视频分析
node <脚本> video D:\videos\demo.mp4 --frames 8
```

## 兼容性

- 需要 Node.js ≥ 18
- 需要 ffmpeg/ffprobe 在 PATH（`video` 命令需要）
- API Key 在技能目录 `.env`，脚本从自身目录自动读取，任何工作目录可用
