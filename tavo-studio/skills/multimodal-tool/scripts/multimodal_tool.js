#!/usr/bin/env node
/**
 * multimodal_tool.js —— 多模态工具（豆包 ARK + Volink）
 *
 * 封装三个能力：
 *   1. describe  调用豆包（火山方舟 ARK）视觉模型解读本地图片；
 *   2. generate  调用 Volink 文生图 API（模型后缀带 -by，默认 gpt-image-2-by-openai）生成图片并保存；
 *                也支持 --provider ark 走豆包 Seedream 生图。
 *   3. speak     调用 Volink 语音合成 API（/v1/tts/speech）把文本转语音并保存。
 *
 * 辅助命令：voices / image-models / tts-models / doctor / help
 *
 * 零第三方依赖，Node.js >= 18（内置 fetch）。
 * 配置读取：真实环境变量 > 当前目录 .env > 脚本所在目录 .env（密钥在 .env 中自行填写）。
 * 详细用法见同目录 multimodal_readme.md。
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// ======================= 配置 =======================

const SCRIPT_DIR = __dirname;

const DEFAULTS = Object.freeze({
  arkBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  arkVisionModel: 'doubao-seed-1-6-250615',
  volinkBaseUrl: 'https://api.volink.org/v1',
  volinkImageModel: 'gpt-image-2-by-openai',
  volinkTtsModel: 'minimax/speech-02-turbo',
  volinkTtsVoice: '693cf29a05b2018407fd1989',
  volinkTtsFormat: 'mp3',
  maxImageBytes: 10 * 1024 * 1024, // 视觉模型单图上限
  timeouts: { vision: 120000, image: 300000, tts: 120000, discovery: 30000 },
});

/** 读取 .env（KEY=VALUE，支持 # 注释与引号值）；不覆盖已存在的环境变量 */
function loadDotEnv(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(path.join(SCRIPT_DIR, '.env'));
loadDotEnv(path.join(process.cwd(), '.env'));

function env(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v : fallback;
}

function resolvedConfig() {
  return {
    arkBaseUrl: env('ARK_BASE_URL', DEFAULTS.arkBaseUrl),
    arkVisionModel: env('ARK_VISION_MODEL', DEFAULTS.arkVisionModel),
    volinkBaseUrl: env('VOLINK_BASE_URL', DEFAULTS.volinkBaseUrl),
    volinkImageModel: env('VOLINK_IMAGE_MODEL', DEFAULTS.volinkImageModel),
    volinkTtsModel: env('VOLINK_TTS_MODEL', DEFAULTS.volinkTtsModel),
    volinkTtsVoice: env('VOLINK_TTS_VOICE', DEFAULTS.volinkTtsVoice),
    volinkTtsFormat: env('VOLINK_TTS_FORMAT', DEFAULTS.volinkTtsFormat),
    hasArkKey: Boolean(env('ARK_API_KEY', '')),
    hasVolinkImageKey: Boolean(env('VOLINK_IMAGE_API_KEY', '')),
    hasVolinkTtsKey: Boolean(env('VOLINK_TTS_API_KEY', '')),
  };
}

// ======================= 基础工具 =======================

function ensureFetch() {
  if (typeof fetch !== 'function') {
    throw new Error('当前 Node 版本过低（需要 >= 18 提供内置 fetch），请升级 Node.js。');
  }
}

/** POST JSON，返回解析后的 JSON（非 2xx 抛错并附接口错误信息） */
async function postJSON(url, body, key, timeoutMs) {
  ensureFetch();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!resp.ok) {
    const detail = data && data.error ? JSON.stringify(data.error) : text.slice(0, 500);
    throw new Error('API 请求失败 [' + resp.status + ' ' + resp.statusText + ']: ' + detail);
  }
  return data;
}

/** GET JSON */
async function getJSON(url, key, timeoutMs) {
  ensureFetch();
  const resp = await fetch(url, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + key },
    signal: AbortSignal.timeout(timeoutMs || 30000),
  });
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!resp.ok) {
    const detail = data && data.error ? JSON.stringify(data.error) : text.slice(0, 500);
    throw new Error('API 请求失败 [' + resp.status + ' ' + resp.statusText + ']: ' + detail);
  }
  return data;
}

/** POST，返回原始二进制 Buffer（用于 TTS 音频） */
async function postRaw(url, body, key, timeoutMs) {
  ensureFetch();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('API 请求失败 [' + resp.status + ' ' + resp.statusText + ']: ' + text.slice(0, 500));
  }
  return Buffer.from(await resp.arrayBuffer());
}

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp',
};

function sniffMime(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  return 'image/jpeg';
}

function maskKey(k) {
  if (!k) return '(未设置)';
  return k.length <= 8 ? '****' : k.slice(0, 4) + '****' + k.slice(-4);
}

function requireKey(name, aliases) {
  for (const a of [name].concat(aliases || [])) {
    const v = env(a, '');
    if (v) return v;
  }
  throw new Error('缺少 ' + name + '，请在脚本目录/当前目录的 .env 或环境变量中配置。');
}

/** 解析 url 字段：支持 http(s) 链接与 data: 前缀的 base64 */
async function bufferFromUrlField(url) {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    return Buffer.from(url.slice(comma + 1), 'base64');
  }
  ensureFetch();
  const resp = await fetch(url, { signal: AbortSignal.timeout(DEFAULTS.timeouts.image) });
  if (!resp.ok) throw new Error('下载图片失败 [' + resp.status + ']: ' + url);
  return Buffer.from(await resp.arrayBuffer());
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** 生成输出路径：未指定时用当前目录 + 时间戳；多文件自动加序号；保证扩展名 */
function resolveOutputPath(output, index, total, fallbackExt) {
  if (!output) {
    const base = fallbackExt === '.mp3' ? 'speech_' + stamp() : 'generated_' + stamp();
    return path.join(process.cwd(), total > 1 ? base + '_' + (index + 1) + fallbackExt : base + fallbackExt);
  }
  const ext = path.extname(output).toLowerCase();
  const name = ext ? output.slice(0, -ext.length) : output;
  const finalExt = ext ? ext : fallbackExt;
  return total > 1 ? name + '_' + (index + 1) + finalExt : name + finalExt;
}

// ======================= 功能一：图片解读（豆包 ARK） =======================

/** 通用 ARK 对话（文本 + 可选图片） */
async function arkChat(messages, opts) {
  opts = opts || {};
  const cfg = resolvedConfig();
  const key = requireKey('ARK_API_KEY');
  const body = {
    model: opts.model || cfg.arkVisionModel,
    messages,
    max_tokens: opts.maxTokens || 1200,
    // Seed 系列默认思考模式较慢较贵；默认关闭，--thinking 开启
    thinking: { type: opts.thinking ? 'enabled' : 'disabled' },
  };
  const data = await postJSON(
    (opts.baseUrl || cfg.arkBaseUrl) + '/chat/completions',
    body,
    key,
    DEFAULTS.timeouts.vision
  );
  const text = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : null;
  if (!text) throw new Error('接口返回缺少文本内容：' + JSON.stringify(data).slice(0, 300));
  return text;
}

/**
 * 调用豆包视觉模型解读本地图片。
 * @param {string} imagePath 本地图片路径
 * @param {string} [question] 提问，默认「请详细描述这张图片的内容」
 * @param {object} [opts] { model, maxTokens, thinking, baseUrl }
 * @returns {Promise<string>}
 */
async function describeImage(imagePath, question, opts) {
  opts = opts || {};
  const buf = fs.readFileSync(imagePath);
  if (buf.length > DEFAULTS.maxImageBytes) {
    throw new Error('图片过大（' + (buf.length / 1048576).toFixed(1) + ' MB），超过 ' + (DEFAULTS.maxImageBytes / 1048576) + ' MB 上限，请先压缩。');
  }
  const mime = MIME_BY_EXT[path.extname(imagePath).toLowerCase()] || sniffMime(buf);
  return arkChat([{
    role: 'user',
    content: [
      { type: 'text', text: question || '请详细描述这张图片的内容。' },
      { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + buf.toString('base64') } },
    ],
  }], opts);
}

// ======================= 功能二：文生图 =======================

/** Volink OpenAI 兼容生图：POST /v1/images/generations */
async function volinkGenerate(prompt, opts) {
  const cfg = resolvedConfig();
  const key = requireKey('VOLINK_IMAGE_API_KEY');
  const body = {
    model: opts.model || cfg.volinkImageModel,
    prompt: prompt.trim(),
    size: opts.size || '1024x1024',
    response_format: 'b64_json',
  };
  if (opts.count && opts.count > 0) body.n = opts.count;
  if (opts.quality) body.quality = opts.quality;
  if (opts.outputFormat) body.output_format = opts.outputFormat;
  const data = await postJSON(
    (opts.baseUrl || cfg.volinkBaseUrl) + '/images/generations',
    body,
    key,
    DEFAULTS.timeouts.image
  );
  const items = (data && data.data) || [];
  if (!items.length) throw new Error('生图接口返回为空：' + JSON.stringify(data).slice(0, 300));
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let buffer = null;
    if (item.b64_json) buffer = Buffer.from(item.b64_json, 'base64');
    else if (item.url) buffer = await bufferFromUrlField(item.url);
    else throw new Error('生成结果缺少图片数据（b64_json/url 均不存在）。');
    if (!buffer.length) throw new Error('生成图片数据为空（第 ' + (i + 1) + ' 张）。');
    const p = resolveOutputPath(opts.output, i, items.length, '.png');
    fs.writeFileSync(p, buffer);
    out.push(p);
  }
  return out;
}

/** 豆包 ARK Seedream 生图：POST /api/v3/images/generations */
async function arkGenerate(prompt, opts) {
  const cfg = resolvedConfig();
  const key = requireKey('ARK_API_KEY');
  const body = {
    model: opts.model || 'doubao-seedream-4-0-250828',
    prompt: prompt.trim(),
    size: opts.size || '1024x1024',
    response_format: 'b64_json',
  };
  if (opts.count && opts.count > 0) body.n = opts.count;
  if (opts.seed !== undefined) body.seed = opts.seed;
  const data = await postJSON(
    (opts.baseUrl || cfg.arkBaseUrl) + '/images/generations',
    body,
    key,
    DEFAULTS.timeouts.image
  );
  const items = (data && data.data) || [];
  if (!items.length) throw new Error('生图接口返回为空：' + JSON.stringify(data).slice(0, 300));
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let buffer = null;
    if (item.b64_json) buffer = Buffer.from(item.b64_json, 'base64');
    else if (item.url) buffer = await bufferFromUrlField(item.url);
    else throw new Error('生成结果缺少图片数据。');
    const p = resolveOutputPath(opts.output, i, items.length, '.png');
    fs.writeFileSync(p, buffer);
    out.push(p);
  }
  return out;
}

/**
 * 文生图并保存到本地。
 * @param {string} prompt 图像描述
 * @param {object} [opts] { output, size, provider:'volink'|'ark', model, count, quality, seed, baseUrl }
 * @returns {Promise<string[]>} 保存的文件路径
 */
async function generateImage(prompt, opts) {
  opts = opts || {};
  if (!prompt || !prompt.trim()) throw new Error('prompt 不能为空。');
  const provider = opts.provider || 'volink';
  if (provider === 'ark') return arkGenerate(prompt, opts);
  if (provider === 'volink') return volinkGenerate(prompt, opts);
  throw new Error('未知 provider：' + provider + '（可用 volink / ark）');
}

// ======================= 功能三：语音合成（Volink TTS） =======================

/**
 * 文本转语音并保存。
 * @param {string} text 要朗读的文本
 * @param {object} [opts] { output, model, voice, format:'mp3'|'wav'|'pcm'|'ogg', speed, baseUrl }
 * @returns {Promise<string>} 保存的文件路径
 */
async function speak(text, opts) {
  opts = opts || {};
  const cfg = resolvedConfig();
  const key = requireKey('VOLINK_TTS_API_KEY');
  if (!text || !text.trim()) throw new Error('text 不能为空。');
  const format = (opts.format || cfg.volinkTtsFormat || 'mp3').toLowerCase();
  const body = {
    model: opts.model || cfg.volinkTtsModel,
    input: text,
    voice: opts.voice || cfg.volinkTtsVoice,
    response_format: format,
  };
  if (opts.speed) body.speed = opts.speed;
  const buffer = await postRaw(
    (opts.baseUrl || cfg.volinkBaseUrl) + '/tts/speech',
    body,
    key,
    DEFAULTS.timeouts.tts
  );
  if (!buffer.length) throw new Error('语音合成返回空数据。');
  const extMap = { mp3: '.mp3', wav: '.wav', pcm: '.pcm', ogg: '.ogg', opus: '.opus', flac: '.flac' };
  const outPath = resolveOutputPath(opts.output, 0, 1, extMap[format] || '.mp3');
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

// ======================= 功能四：视频分析（ffmpeg 抽帧 + 豆包视觉） =======================

function runTool(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  } catch (e) {
    const stderr = e && e.stderr ? String(e.stderr).slice(0, 400) : '';
    throw new Error('执行 ' + cmd + ' 失败' + (stderr ? '：' + stderr : '：' + (e && e.message ? e.message : '')));
  }
}

/**
 * 分析视频：ffprobe 取元信息，ffmpeg 按时间均匀抽帧，逐帧豆包视觉解读，最后综合总结。
 * @param {string} videoPath 视频文件路径
 * @param {object} [opts] { question, frames, maxTokens, thinking, noSummary, keepFrames, model, baseUrl }
 * @returns {Promise<string>} 分析报告文本
 */
async function analyzeVideo(videoPath, opts) {
  opts = opts || {};
  // 1. 元信息
  let meta;
  try {
    meta = JSON.parse(runTool('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', videoPath]));
  } catch (e) {
    throw new Error('无法读取视频（ffprobe）：' + e.message);
  }
  const vstream = (meta.streams || []).find((s) => s.codec_type === 'video');
  if (!vstream) throw new Error('该文件中没有视频流（可能是纯音频文件），请用音频转写类工具处理。');
  const duration = parseFloat(meta.format && meta.format.duration) || parseFloat(vstream.duration) || 0;
  const frameCount = Math.min(Math.max(parseInt(opts.frames, 10) || 6, 1), 30);
  const interval = duration > 0 ? Math.max(duration / frameCount, 0.5) : 1;

  // 2. 抽帧到临时目录
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmt-video-'));
  try {
    const vf = "scale='min(1280,iw)':-2,fps=1/" + interval;
    runTool('ffmpeg', ['-y', '-v', 'error', '-i', videoPath, '-vf', vf, '-frames:v', String(frameCount), '-q:v', '3', path.join(tmpDir, 'frame_%03d.jpg')]);
    const frames = fs.readdirSync(tmpDir).filter((f) => /\.jpe?g$/i.test(f)).sort();
    if (!frames.length) throw new Error('未能从视频中提取到画面帧。');

    // 3. 逐帧分析
    const question = opts.question || '这是视频按时间顺序抽取的第 %d 帧，请详细描述画面：场景、人物/物体、动作、文字、光线、镜头角度等。';
    const descriptions = [];
    for (let i = 0; i < frames.length; i++) {
      const q = String(question).replace(/%d/g, String(i + 1));
      descriptions.push(await describeImage(path.join(tmpDir, frames[i]), q, {
        model: opts.model, maxTokens: opts.maxTokens || 700, thinking: opts.thinking, baseUrl: opts.baseUrl,
      }));
    }

    // 4. 综合总结（纯文本）
    let summary = '';
    if (!opts.noSummary) {
      const list = descriptions.map((d, i) => (i + 1) + '. ' + d).join('\n');
      const sumPrompt = '以下是同一段视频按时间顺序抽取的关键帧描述：\n' + list +
        '\n\n请基于以上描述对整段视频做综合分析：1) 主题与场景 2) 出现的人物/物体 3) 主要动作与事件 4) 画面风格与镜头 5) 无法确定或需要进一步确认的部分。请用中文回答。';
      summary = await arkChat([{ role: 'user', content: sumPrompt }], {
        model: opts.model, maxTokens: opts.maxTokens || 1000, thinking: opts.thinking, baseUrl: opts.baseUrl,
      });
    }

    // 5. 组装报告
    const fps = vstream.r_frame_rate || vstream.avg_frame_rate || '';
    const metaLine = '时长 ' + (duration ? duration.toFixed(1) + ' 秒' : '未知') +
      ' | 分辨率 ' + (vstream.width || '?') + 'x' + (vstream.height || '?') +
      (fps && fps !== '0/0' ? ' | 帧率 ' + fps : '') +
      ' | 编码 ' + (vstream.codec_name || '?') +
      ' | 抽取 ' + frames.length + ' 帧';
    const lines = [
      '=== 视频信息 ===',
      '路径: ' + videoPath,
      metaLine,
      '',
      '=== 各帧分析 ===',
    ];
    descriptions.forEach((d, i) => lines.push('【帧 ' + (i + 1) + '】' + d, ''));
    if (summary) lines.push('=== 综合总结 ===', summary, '');
    if (opts.keepFrames) lines.push('=== 抽取帧保留在 ===', tmpDir);
    return lines.join('\n');
  } finally {
    if (!opts.keepFrames) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }
}

// ======================= 发现命令 =======================

/** 列出 Volink 可用音色 */
async function listVoices(modelFilter) {
  const cfg = resolvedConfig();
  const key = requireKey('VOLINK_TTS_API_KEY');
  const data = await getJSON(cfg.volinkBaseUrl + '/tts/voices', key, DEFAULTS.timeouts.discovery);
  const voices = (data && data.voices) || [];
  const rows = voices
    .filter((v) => !modelFilter || v.model === modelFilter || (v.model || '').indexOf(modelFilter) >= 0)
    .map((v) => '  ' + v.id + '  |  ' + v.name + '  |  ' + (v.model || '') + '  |  ' + ((v.languages || []).join(',')))
    .join('\n');
  return (data && data.total_count ? '共 ' + data.total_count + ' 个音色（本页显示 ' + voices.length + ' 个）：\n' : '') + rows;
}

/** 列出 Volink 生图模型（output_modalities=image） */
async function listImageModels() {
  const cfg = resolvedConfig();
  const key = requireKey('VOLINK_IMAGE_API_KEY');
  const data = await getJSON(cfg.volinkBaseUrl + '/models?output_modalities=image', key, DEFAULTS.timeouts.discovery);
  const ids = ((data && data.data) || []).map((m) => m.id);
  return 'Volink 生图模型（' + ids.length + ' 个，-by 后缀为第三方托管）：\n' + ids.map((id) => '  ' + id).join('\n');
}

/** 列出 Volink 语音合成模型 */
async function listTtsModels() {
  const cfg = resolvedConfig();
  const key = requireKey('VOLINK_TTS_API_KEY');
  const data = await getJSON(cfg.volinkBaseUrl + '/tts/models', key, DEFAULTS.timeouts.discovery);
  const models = (data && data.models) || [];
  return 'Volink 语音合成模型（' + models.length + ' 个）：\n' + models
    .map((m) => '  ' + m.id + '  |  ' + (m.name || '') + '  |  语言: ' + ((m.languages || []).join(',')))
    .join('\n');
}

// ======================= 自检 =======================

function doctor() {
  const cfg = resolvedConfig();
  return [
    'multimodal_tool 配置自检：',
    '  豆包 ARK  : ' + cfg.arkBaseUrl + '  |  视觉模型 ' + cfg.arkVisionModel + '  |  Key ' + maskKey(env('ARK_API_KEY', '')),
    '  Volink    : ' + cfg.volinkBaseUrl + '  |  生图模型 ' + cfg.volinkImageModel + '  |  生图Key ' + maskKey(env('VOLINK_IMAGE_API_KEY', '')),
    '  Volink TTS: 模型 ' + cfg.volinkTtsModel + '  |  音色 ' + cfg.volinkTtsVoice + '  |  格式 ' + cfg.volinkTtsFormat + '  |  Key ' + maskKey(env('VOLINK_TTS_API_KEY', '')),
    '  Node      : ' + process.version,
  ].join('\n');
}

// ======================= 命令行入口 =======================

function printUsage() {
  console.log([
    'multimodal_tool.js —— 多模态工具（豆包 ARK 视觉 / Volink 生图与语音）',
    '',
    '用法：',
    '  node multimodal_tool.js describe <图片路径> [-q "问题"] [--thinking] [--model 模型ID] [--max-tokens N]',
    '       豆包视觉解读本地图片',
    '  node multimodal_tool.js generate "<图像描述>" [-o 输出.png] [--size 1024x1024] [--provider volink|ark] [--model 模型ID] [--count N] [--quality 档位]',
    '       文生图并保存（默认 Volink，模型后缀带 -by；--provider ark 走豆包 Seedream）',
    '  node multimodal_tool.js speak "<文本>" [-o 输出.mp3] [--model 模型ID] [--voice 音色ID] [--format mp3|wav|pcm|ogg] [--speed 倍速]',
    '       Volink 语音合成并保存',
    '  node multimodal_tool.js video <视频路径> [-q "问题"] [--frames N] [--no-summary] [--keep-frames] [--thinking]',
    '       视频分析：ffmpeg 抽帧 + 豆包逐帧解读 + 综合总结（需安装 ffmpeg）',
    '  node multimodal_tool.js voices [--model 模型过滤]',
    '       列出 Volink 可用音色',
    '  node multimodal_tool.js image-models',
    '       列出 Volink 生图模型',
    '  node multimodal_tool.js tts-models',
    '       列出 Volink 语音模型',
    '  node multimodal_tool.js doctor | help',
    '       配置自检 / 帮助',
    '',
    '配置：脚本目录或当前目录的 .env，详见 multimodal_readme.md',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '-q' || a === '--question' || a === '--prompt') args.question = next();
    else if (a === '-o' || a === '--output') args.output = next();
    else if (a === '--size') args.size = next();
    else if (a === '--model') args.model = next();
    else if (a === '--provider') args.provider = next();
    else if (a === '--count' || a === '-n') args.count = Number(next());
    else if (a === '--quality') args.quality = next();
    else if (a === '--seed') args.seed = Number(next());
    else if (a === '--voice') args.voice = next();
    else if (a === '--format') args.format = next();
    else if (a === '--speed') args.speed = Number(next());
    else if (a === '--max-tokens') args.maxTokens = Number(next());
    else if (a === '--thinking') args.thinking = true;
    else if (a === '--frames') args.frames = Number(next());
    else if (a === '--no-summary') args.noSummary = true;
    else if (a === '--keep-frames') args.keepFrames = true;
    else if (a === '--base-url') args.baseUrl = next();
    else if (a === '-h' || a === '--help') args.help = true;
    else args._.push(a);
  }
  return args;
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    printUsage();
    return;
  }
  const args = parseArgs(argv.slice(1));
  try {
    if (cmd === 'describe' || cmd === 'analyze' || cmd === '看') {
      const imagePath = args._[0];
      if (!imagePath) throw new Error('请提供图片路径：describe <图片路径> [-q "问题"]');
      const text = await describeImage(imagePath, args.question, {
        model: args.model, maxTokens: args.maxTokens, thinking: args.thinking, baseUrl: args.baseUrl,
      });
      console.log(text);
    } else if (cmd === 'generate' || cmd === 'draw' || cmd === '画') {
      const prompt = args.question || args._.join(' ');
      if (!prompt) throw new Error('请提供图像描述：generate "<图像描述>" [-o out.png]');
      const saved = await generateImage(prompt, {
        output: args.output, size: args.size, provider: args.provider, model: args.model,
        count: args.count, quality: args.quality, seed: args.seed, baseUrl: args.baseUrl,
      });
      saved.forEach((p) => console.log(p));
    } else if (cmd === 'speak' || cmd === 'tts' || cmd === '说') {
      const text = args.question || args._.join(' ');
      if (!text) throw new Error('请提供文本：speak "<文本>" [-o out.mp3]');
      const p = await speak(text, {
        output: args.output, model: args.model, voice: args.voice,
        format: args.format, speed: args.speed, baseUrl: args.baseUrl,
      });
      console.log(p);
    } else if (cmd === 'video' || cmd === '分析视频') {
      const videoPath = args._[0];
      if (!videoPath) throw new Error('请提供视频路径：video <视频路径> [--frames N] [--no-summary] [--keep-frames]');
      console.log(await analyzeVideo(videoPath, {
        question: args.question, frames: args.frames, model: args.model,
        maxTokens: args.maxTokens, thinking: args.thinking,
        noSummary: args.noSummary, keepFrames: args.keepFrames, baseUrl: args.baseUrl,
      }));
    } else if (cmd === 'voices') {
      console.log(await listVoices(args.model));
    } else if (cmd === 'image-models' || cmd === 'img-models') {
      console.log(await listImageModels());
    } else if (cmd === 'tts-models') {
      console.log(await listTtsModels());
    } else if (cmd === 'doctor') {
      console.log(doctor());
    } else {
      throw new Error('未知命令：' + cmd + '（可用 describe / generate / speak / voices / image-models / tts-models / doctor / help）');
    }
  } catch (err) {
    console.error('[multimodal_tool] 错误：' + (err && err.message ? err.message : String(err)));
    process.exitCode = 1;
  }
}

// ======================= 导出 =======================

module.exports = {
  describeImage,
  generateImage,
  speak,
  analyzeVideo,
  listVoices,
  listImageModels,
  listTtsModels,
  doctor,
  resolvedConfig,
  DEFAULTS,
};

if (require.main === module) {
  main();
}
