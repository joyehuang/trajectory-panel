#!/usr/bin/env python3
"""生成 trajectory-panel 的 **虚构** demo 会话文件。

这些会话是完全编造的（"搭个 todo app" / "修 CI" / "调研 RAG" 三个通用流程），
目的是让开源仓库和线上 demo 里 **不含任何真实用户数据**。
运行后会覆盖写入 public/samples/。
"""
import json, os, random, time, uuid

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "samples")
os.makedirs(OUT_DIR, exist_ok=True)

# 每个 demo 会话的起始时间（距今多少秒）—— 错开到不同的天，
# 好让侧边栏「按天分组」的效果在 demo 里就能看出来。
SESSION_START_AGO_S = {"sample-1": 2 * 3600, "sample-2": 7 * 3600, "sample-3": 30 * 3600}


class Clock:
    """单调递增的时间轴 —— demo 数据的时间戳必须顺着往前走，不能乱序。"""

    def __init__(self, start_epoch):
        self.now = start_epoch

    def tick(self, seconds):
        self.now += seconds
        return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(self.now)) + ".000Z"


def iso(epoch):
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(epoch)) + ".000Z"


def usage(input_tokens, output_tokens, reasoning=0):
    total = input_tokens + output_tokens + reasoning
    return {
        "input": input_tokens,
        "output": output_tokens,
        "cacheRead": int(input_tokens * 0.6),
        "cacheWrite": int(input_tokens * 0.1),
        "reasoning": reasoning,
        "totalTokens": total,
        "cost": {"total": round(total * 0.000012, 6)},
    }


def msg(clock, pid, role, text, gap, thinking=None, model="claude-opus-5"):
    content = []
    if thinking:
        content.append({"type": "thinking", "thinking": thinking})
    content.append({"type": "text", "text": text})
    d = {"type": "message", "id": uuid.uuid4().hex[:12], "parentId": pid,
         "timestamp": clock.tick(gap),
         "message": {"role": role, "content": content}}
    if role == "assistant":
        d["message"]["usage"] = usage(random.randint(3000, 9000), random.randint(120, 600),
                                      reasoning=len(thinking) // 3 if thinking else 0)
        d.update({"api": "anthropic", "provider": "claude", "model": model,
                  "stopReason": "endTurn", "responseModel": model,
                  "responseId": "gen_" + uuid.uuid4().hex[:12]})
    return d


def tool_call(clock, pid, name, args, result, lead, thinking=None, model="claude-opus-5"):
    cid = uuid.uuid4().hex[:12]
    content = []
    if thinking:
        content.append({"type": "thinking", "thinking": thinking})
    content.append({"type": "text", "text": lead})
    content.append({"type": "toolCall", "id": cid, "name": name, "arguments": {"command": args}})
    call = {"type": "message", "id": uuid.uuid4().hex[:12], "parentId": pid,
            "timestamp": clock.tick(random.randint(4, 20)),
            "message": {"role": "assistant", "content": content,
                        "usage": usage(random.randint(4000, 12000), random.randint(80, 400),
                                       reasoning=len(thinking) // 3 if thinking else 0)},
            "api": "anthropic", "provider": "claude", "model": model,
            "stopReason": "toolUse", "responseId": "gen_" + uuid.uuid4().hex[:12],
            "responseModel": model, "rawStopReason": "tool_calls"}
    res = {"type": "message", "id": uuid.uuid4().hex[:12], "parentId": cid,
           "timestamp": clock.tick(random.randint(2, 40)),
           "message": {"role": "toolResult", "toolCallId": cid, "toolName": name,
                       "content": [{"type": "text", "text": result}], "isError": False}}
    return [call, res]


def build_session(sid, steps):
    """steps: ("user"|"assistant"|"tool", ...) 三种事件，按顺序铺在同一条时间轴上。"""
    start = time.time() - SESSION_START_AGO_S.get(sid, 2 * 3600)
    clock = Clock(start)
    lines = [{"type": "session", "version": 3, "id": sid,
              "timestamp": iso(start), "cwd": "/Users/demo/dev/demo-project"}]
    parent = None
    for step in steps:
        kind = step[0]
        if kind == "user":
            lines.append(msg(clock, parent, "user", step[1], gap=random.randint(20, 90)))
        elif kind == "assistant":
            lines.append(msg(clock, parent, "assistant", step[1], gap=random.randint(3, 15),
                             thinking=step[2] if len(step) > 2 else None))
        elif kind == "tool":
            _, name, (args, result), lead = step[:4]
            lines += tool_call(clock, parent, name, args, result, lead,
                               thinking=step[4] if len(step) > 4 else None)
        parent = lines[-1]["id"]
    return lines, iso(start)


def main():
    demos = [
        ("sample-1", "构建 Todo 应用", [
            ("user", "帮我在这个目录里搭一个 todo app，用 React + Vite"),
            ("assistant", "好的，我先看一下当前目录结构，再决定是初始化新项目还是在现有骨架上改。",
             "目录里可能已经有脚手架了。直接跑 create vite 会覆盖现有文件，先 ls 一眼更稳妥。"),
            ("tool", "bash", ("ls -la", "README.md  package.json  src/  vite.config.ts"),
             "先看看目录里已经有什么。"),
            ("assistant", "已经有 Vite 配置了，但 src/ 还是空壳，我把模板补齐。"),
            ("tool", "bash", ("npm create vite@latest . -- --template react-ts",
                              "✅ Scaffolding project in ./ ... done\n  npm install\n  npm run dev"),
             "在当前目录初始化 React + TS 模板。"),
            ("assistant", "项目已创建。接下来写 Todo 的核心组件：列表、新增、删除、本地持久化。"),
            ("tool", "edit", ("src/App.tsx",
                              "wrote src/App.tsx (98 lines): TodoList + useLocalStorage + add/toggle/delete"),
             "写入主组件。",
             "状态放 useState 就够了，不引 Redux；持久化用 localStorage 包一层 hook，避免每个组件各写一遍。"),
            ("assistant", "组件写完了，跑起来验证一下能不能正常渲染。"),
            ("tool", "bash", ("npm run dev & sleep 2 && curl -s -o /dev/null -w '%{http_code}' localhost:5173",
                              "200"),
             "启动 dev server 并探活。"),
            ("assistant", "本地跑通了。访问 http://localhost:5173 就能看到效果：支持新增、勾选完成、删除，刷新后数据还在。"),
        ]),
        ("sample-2", "修复 CI 构建失败", [
            ("user", "CI 挂了，报 TS 类型错误，帮我看看"),
            ("assistant", "我先拉日志定位到具体文件和行号。"),
            ("tool", "bash", ("tail -50 /tmp/ci.log",
                              "src/api/client.ts(42,18): error TS2345: Argument of type 'string | undefined' "
                              "is not assignable to parameter of type 'string'."),
             "看看 CI 日志最后几十行。"),
            ("tool", "read", ("src/api/client.ts",
                              "42: export async function fetchData(url?: string) {\n43:   return http.get(url)"),
             "读一下报错那段代码。",
             "url 声明成可选，却直接透传给只接受 string 的 http.get —— 类型错误是真的，不是配置问题。"),
            ("assistant", "找到了：`fetchData` 的 url 是可选参数，但直接传给了要求 string 的 `http.get`，没做空值保护。"),
            ("tool", "edit", ("src/api/client.ts",
                              "added guard: if (!url) throw new Error('fetchData: url is required')"),
             "加一个显式的空值守卫。"),
            ("tool", "bash", ("npm run typecheck", "✅ No type errors (2.3s)"),
             "本地跑一遍类型检查确认修好了。"),
            ("assistant", "修复完成，本地 typecheck 通过，推上去 CI 应该能过。"),
        ]),
        ("sample-3", "调研 RAG 方案", [
            ("user", "对比一下 RAG 和长上下文的成本差异"),
            ("assistant", "我先搜一些今年的实测数据，再按场景整理成对比。",
             "成本对比要分场景：文档量、查询频次、是否重复查同一批文档，结论会完全不一样。"),
            ("tool", "web_search", ("RAG vs long-context cost comparison 2026",
                                    "1. 检索式 RAG：约 $0.001/次查询（含 embedding + 向量检索）\n"
                                    "2. 长上下文：约 $0.01/1K tokens，100K 上下文单次约 $1"),
             "搜一下公开的成本基准。"),
            ("assistant", "拿到几份数据了，我写成一份带取舍建议的对比报告。"),
            ("tool", "write", ("reports/rag-vs-longcontext.md", "wrote reports/rag-vs-longcontext.md (1200 words)"),
             "输出报告文件。"),
            ("assistant", "报告写好了。结论：文档多、查询稀疏用 RAG 便宜一个量级；文档少且要反复追问同一批内容，长上下文配合 prompt cache 更划算。"),
        ]),
    ]
    manifest = []
    for sid, title, steps in demos:
        lines, started_at = build_session(sid, steps)
        with open(os.path.join(OUT_DIR, sid + ".jsonl"), "w") as f:
            for ln in lines:
                f.write(json.dumps(ln, ensure_ascii=False) + "\n")
        manifest.append({"file": sid + ".jsonl", "title": title, "timestamp": started_at})
        print(f"  wrote {sid}.jsonl ({len(lines)} events)")
    with open(os.path.join(OUT_DIR, "index.json"), "w") as f:
        json.dump({"version": 1, "samples": manifest}, f, indent=2, ensure_ascii=False)
    print("done —", len(demos), "fake demos written to", OUT_DIR)


if __name__ == "__main__":
    main()
