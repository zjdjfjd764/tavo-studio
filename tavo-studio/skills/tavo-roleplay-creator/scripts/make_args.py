# -*- coding: utf-8 -*-
"""
Tavo import args generator template.
Copy this file, replace the placeholder content with your own character/lorebook,
then run:  python make_args.py
It writes args_char.json and args_lore.json in UTF-8 (no BOM issues).
"""
import json

# ============ 角色卡内容(替换为你的内容) ============
character = {
    "name": "角色名",
    "nickname": "昵称",
    "description": (
        "身份背景。外貌细节。性格概括。与{{user}}的关系。"
    ),
    "personality": (
        "核心特质。\n"
        "说话方式/口癖。\n"
        "行为模式。\n"
        "表面与实际的落差。"
    ),
    "scenario": "时间地点、环境细节、与{{user}}的相遇情境。",
    "first_mes": "（动作/环境描写）\n\n\"台词……\"\n\n动作细节。",
    "mes_example": (
        "<START>\n"
        "{{user}}:第一轮用户\n"
        "{{char}}:（动作）第一轮角色回复\n"
        "{{user}}:第二轮用户\n"
        "{{char}}:（动作）第二轮角色回复\n"
        "<END>"
    ),
    "system_prompt": (
        "你是{{char}},完整人设。\n"
        "互动要求。\n"
        "请始终以{{char}}的身份与{{user}}互动。"
    ),
    "post_history_instructions": (
        "1. 规则一。\n"
        "2. 规则二。\n"
        "3. 节奏控制与禁止事项。"
    ),
    "alternate_greetings": [
        "（场景一开场白）\n\n\"台词\"",
        "（场景二开场白）\n\n\"台词\"",
    ],
    "creator_notes": "由视频分析生成。视频来源:……",
    "creator": "来源作者 (视频分析生成)",
    "character_version": "1.0.0",
    "tags": ["标签1", "标签2", "标签3"],
    "extensions": {"world": "角色名的世界"},  # 可选:关联世界书
}

# ============ 世界书内容(替换为你的内容) ============
def entry(identifier, name, strategy, content, keywords=None, depth=4, position="lorebookBefore",
          probability=None, sticky=None, cooldown=None, delay=None):
    """构造世界书条目。strategy: constant|keyword。
    probability/sticky/cooldown/delay 用于方法5(主动情景引擎型)的随机事件与持续效果,
    若目标 Tavo 版本不支持则不要传。"""
    e = {
        "identifier": identifier,
        "name": name,
        "content": content,
        "strategy": strategy,
        "injectionPosition": position,
        "injectionDepth": depth,
        "injectionRole": "system",
    }
    if keywords:
        e["keywords"] = keywords
    if probability is not None:
        e["probability"] = probability
    if sticky is not None:
        e["sticky"] = sticky
    if cooldown is not None:
        e["cooldown"] = cooldown
    if delay is not None:
        e["delay"] = delay
    return e

lorebook = {
    "name": "角色名的世界",
    "entries": [
        entry("world_overview", "世界总览", "constant",
              "这里是属于{{char}}与{{user}}的世界。……"),
        entry("char_profile", "人物档案", "keyword",
              "{{char}}的外貌、性格、与{{user}}的关系。……",
              keywords=["角色名", "昵称"]),
        entry("char_outfit", "服装装扮", "keyword",
              "服装细节……", keywords=["服装", "装饰"]),
        entry("main_scene", "主要场景", "keyword",
              "场景细节……", keywords=["客厅", "家"]),
        entry("char_secret", "小秘密", "keyword",
              "不为人知的秘密……", keywords=["秘密", "心事"]),
        # 成人向卡必加:语言风格/黄腔指南(constant, 低深度), 模板见 docs/explicitness-guide.md §5
        # entry("char_speech_style", "说话风格·露骨度Lv3", "constant",
        #       "【{{char}}的说话风格·露骨度Lv3】\n- 性器官直呼词:……\n- 口癖:……\n- 骚话时机:……\n- 禁忌词:那里、下面、玉茎……\n- 羞称使用:……",
        #       depth=1, position="atDepth"),
        # 方法5 事件条目示例(probability/sticky 视 Tavo 版本支持):
        # entry("night_event", "深夜敲门事件", "keyword",
        #       "深夜{{user}}敲门。事件持续3轮……", keywords=["敲门", "深夜"],
        #       probability=40, sticky=3),
    ],
}

# ============ 输出 ============
with open("args_char.json", "w", encoding="utf-8") as f:
    json.dump({"character": character}, f, ensure_ascii=False, indent=2)

with open("args_lore.json", "w", encoding="utf-8") as f:
    json.dump({"lorebook": lorebook}, f, ensure_ascii=False, indent=2)

print("OK: args_char.json / args_lore.json written")
