# multimodal_tool —— 多模态工具（豆包 ARK 视觉 / Volink 生图与语音）

零依赖 Node.js 脚本（Node ≥ 18，内置 fetch），为不具备多模态能力的 AI 助手提供四项能力：

| 能力 | 命令 | 底层 API |
| --- | --- | --- |
| **图片解读** | `describe` | 豆包（火山方舟 ARK）视觉模型 |
| **文生图** | `generate` | Volink 生图 API（模型后缀带 `-by`） |
| **语音合成** | `speak` | Volink TTS API（`/v1/tts/speech`） |
| **视频分析** | `video` | ffmpeg 抽帧 + 豆包逐帧解读 + 综合总结 |

辅助命令：`voices`（列音色）、`image-models`（列生图模型）、`tts-models`（列语音模型）、`doctor`（配置自检）。

## 文件位置与配置

- 脚本：`@@MM_DIR@@\scripts\multimodal_tool.js`
- 配置：`@@MM_DIR@@\.env`（安装脚本已生成；复制 `.env.template` 为 `.env` 亦可）
- 详细技能说明：本技能目录的 `SKILL.md`

脚本从**自身目录**与**当前工作目录**自动读取 `.env`（`KEY=VALUE`，支持 `#` 注释与引号值），并优先使用真实环境变量。

## 需要自行填写的密钥（存于 .env，勿泄露）

| 用途 | 环境变量 | 获取方式 |
| --- | --- | --- |
| 豆包 ARK（图片/视频解读） | `ARK_API_KEY` | 火山方舟控制台 https://console.volcengine.com/ark |
| Volink 生图 | `VOLINK_IMAGE_API_KEY` | Volink 平台 |
| Volink 语音 | `VOLINK_TTS_API_KEY` | Volink 平台 |

其余均有脚本内置默认值（Base URL、视觉模型 `doubao-seed-1-6-250615`、生图模型 `gpt-image-2-by-openai`、语音模型 `minimax/speech-02-turbo`、默认音色、格式 `mp3`），一般无需修改；如需覆盖，在 `.env` 里加对应键即可。

---

## 一、图片解读（豆包 ARK 视觉）

```
node <脚本> describe <图片路径> [-q "问题"] [--thinking] [--model 模型ID] [--max-tokens N]
```

- 支持 jpg / png / webp / gif / bmp，单张 ≤ 10MB
- 默认关闭思考模式（更快更省）；`--thinking` 开启深度推理
- 结果打印到 stdout，供脚本/Agent 解析

**示例：**

```bash
node <脚本> describe D:\photos\chart.png -q "这张图展示什么趋势？给出结论"
node <脚本> describe C:\shots\code.png -q "识别图中文字并解释含义"
```

---

## 二、文生图（Volink，默认）

```
node <脚本> generate "<图像描述>" [-o 输出.png] [--size 1024x1024] [--provider volink|ark] [--model 模型ID] [--count N] [--quality 档位]
```

- 默认走 Volink `POST /v1/images/generations`；模型后缀带 `-by`（如 `gpt-image-2-by-openai`、`flux-2-klein-9b-by-superimage` 等，用 `image-models` 查看全部）
- `--provider ark`：改用豆包 Seedream（如 `doubao-seedream-4-0-250828`）
- `--size`：`1024x1024`（默认）/ `768x1344`（竖）/ `1344x768`（横），具体受模型支持范围限制
- 成功时 stdout 打印保存的文件路径

**示例：**

```bash
node <脚本> generate "一只戴宇航员头盔的橘猫站在月球表面，插画风格" -o D:\images\cat.png
node <脚本> generate "赛博朋克雨夜街道，霓虹灯，电影感" --size 1344x768 -o D:\images\cyber.png
node <脚本> image-models
```

---

## 三、语音合成（Volink TTS）

```
node <脚本> speak "<文本>" [-o 输出.mp3] [--model 模型ID] [--voice 音色ID] [--format mp3|wav|pcm|ogg] [--speed 倍速]
```

- 调用 `POST /v1/tts/speech`（OpenAI 兼容格式：`model` / `input` / `voice`）
- 可用模型（`tts-models` 查看）：`minimax/speech-02-turbo`（默认，语言支持最广）、`cosyvoice/CosyVoice2-0.5B`、`bytedance/openspeech-tts-v3`、`sensetime/sensenova-tts-v1`
- 音色用 `voices` 命令查看，`--voice` 指定
- 成功时 stdout 打印保存的音频路径

**示例：**

```bash
node <脚本> speak "你好，这是一段语音合成测试。"
node <脚本> speak "今天天气不错" --model cosyvoice/CosyVoice2-0.5B --voice 68f05ee2fa7d57c78f362dfa
node <脚本> voices
```

---

## 四、视频分析（ffmpeg 抽帧 + 豆包视觉）

```
node <脚本> video <视频路径> [-q "问题"] [--frames N] [--no-summary] [--keep-frames] [--thinking]
```

- **原理**：ffprobe 读取时长/分辨率/帧率等元信息 → ffmpeg 按时间均匀抽取 N 帧（默认 6，上限 30）→ 逐帧交给豆包视觉分析 → 最后再调用一次豆包生成整段视频的综合总结（主题、人物/物体、动作事件、画面风格、不确定项）
- **依赖**：需要 ffmpeg/ffprobe 在 PATH（未安装可到 https://ffmpeg.org 下载并加入 PATH）
- `-q "问题"`：自定义逐帧提问，`%d` 表示帧序号（默认带详细画面描述模板）
- `--frames N`：抽帧数量；`--no-summary`：跳过综合总结（省钱省时）；`--keep-frames`：保留抽取帧（打印目录）
- 帧会缩放到最长边 1280px 以控制体积；临时帧目录分析后自动清理
- 报告（视频信息 + 各帧分析 + 综合总结）打印到 stdout

**示例：**

```bash
node <脚本> video D:\videos\demo.mp4
node <脚本> video D:\videos\demo.mp4 --frames 12
node <脚本> video D:\videos\demo.mp4 -q "这一帧里的人在做什么？%d"
```

> 说明：这是"关键帧视觉分析"——对画面内容做理解；不含音频转写（视频里"说了什么"）。如需要可后续扩展。

---

## 五、故障排查

| 现象 | 原因与处理 |
| --- | --- |
| `缺少 ARK_API_KEY` 等 | .env 未生效；确认脚本目录或当前目录有 .env 且键名正确 |
| ARK `model ... does not exist` | 模型 ID 与账号不匹配，用 ARK 控制台开通或换模型 |
| Volink `404`（生图） | 模型名不是生图模型，用 `image-models` 查真实 ID |
| Volink `402`（语音） | 账户余额不足（/v1/tts/speech 专用错误码） |
| `429` | 限流，稍后重试 |
| 图片过大 | 视觉模型单张 ≤ 10MB，先压缩 |
| `执行 ffmpeg 失败` | ffmpeg 未安装或不在 PATH |
| `该文件中没有视频流` | 文件是纯音频，视频分析需要画面帧 |

## 备注

- 生图模型后缀带 `-by`（如 `-by-openai`、`-by-superimage`）是 Volink 第三方托管模型的命名规则；Gemini 图像模型（如 `gemini-3.1-flash-image`）无此前缀。
- 脚本不依赖 npm 包；迁移到其他机器时需同时迁移脚本与 `.env`（密钥），并安装 ffmpeg。
