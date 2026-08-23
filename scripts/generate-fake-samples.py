#!/usr/bin/env python3
"""Generate FAKE demo session files for trajectory-panel.

These are purely fictional example sessions (generic "build a todo app" /
"fix a bug" / "research" flows) so the public repo ships ZERO real user data.
The real redacted samples live only on disk (public/samples/*.jsonl were
removed from git) — this script regenerates clean stand-ins for the demo UI.
"""
import json, os, random, time, uuid

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "samples")
os.makedirs(OUT_DIR, exist_ok=True)

def ts(offset_s):
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() - offset_s)) + ".000Z"

def msg(pid, role, text, extra=None):
    d = {"type": "message", "id": uuid.uuid4().hex[:12], "parentId": pid,
         "timestamp": ts(random.randint(60, 3600)),
         "message": {"role": role, "content": [{"type": "text", "text": text}]}}
    if extra: d["message"].update(extra)
    return d

def tool_call(pid, name, args, result, model="claude-opus-5"):
    cid = uuid.uuid4().hex[:12]
    call = {"type": "message", "id": uuid.uuid4().hex[:12], "parentId": pid,
            "timestamp": ts(random.randint(30, 120)),
            "message": {"role": "assistant", "content": [
                {"type": "text", "text": "让我来查一下。"},
                {"type": "toolCall", "id": cid, "name": name, "arguments": {"command": args}}]},
            "api": "anthropic", "provider": "claude", "model": model,
            "stopReason": "toolUse", "responseId": "gen_" + uuid.uuid4().hex[:12],
            "responseModel": model, "rawStopReason": "tool_calls"}
    res = {"type": "message", "id": uuid.uuid4().hex[:12], "parentId": cid,
           "timestamp": ts(random.randint(5, 30)),
           "message": {"role": "toolResult", "toolCallId": cid, "toolName": name,
                       "content": [{"type": "text", "text": result}], "isError": False}}
    return [call, res]

def build_session(sid, title, steps):
    """steps: list of (kind, text) tuples — user text or tool_name+result."""
    lines = [{"type": "session", "version": 3, "id": sid,
              "timestamp": ts(7200), "cwd": "/Users/demo/dev/demo-project"}]
    parent = None
    for step in steps:
        kind = step[0]
        if kind == "user":
            lines.append(msg(parent, "user", step[1]))
            parent = lines[-1]["id"]
        elif kind == "assistant":
            lines.append(msg(parent, "assistant", step[1]))
            parent = lines[-1]["id"]
        elif kind == "tool":
            name, args, result = step[1], step[2][0], step[2][1]
            lines += tool_call(parent, name, args, result)
            parent = lines[-1]["id"]
    return lines

def main():
    demos = [
        ("sample-1", "构建 Todo 应用", [
            ("user", "帮我在这个目录里搭一个 todo app，用 React + Vite"),
            ("assistant", "好的，我先看一下当前目录结构，然后初始化项目。"),
            ("tool", "bash", ("ls -la", "README.md  package.json  src/  vite.config.ts")),
            ("tool", "bash", ("npm create vite@latest . -- --template react-ts", "✅ Scafolding project in ./ ... done")),
            ("assistant", "项目已创建。接下来我写 Todo 的核心组件。"),
            ("tool", "edit", ("src/App.tsx", "wrote App.tsx with TodoList + add/delete")),
            ("assistant", "完成，跑起来验证一下。"),
            ("tool", "bash", ("npm run dev & curl localhost:5173", "200 OK — Vite dev server running")),
            ("assistant", "本地跑通了，交付。你可以访问 http://localhost:5173 看到效果。"),
        ]),
        ("sample-2", "修复 CI 构建失败", [
            ("user", "CI 挂了，报 TS 类型错误，帮我看看"),
            ("assistant", "我先拉一下日志定位问题。"),
            ("tool", "bash", ("cat /tmp/ci.log | tail -50", "error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'")),
            ("tool", "read", ("src/api/client.ts", "line 42: `fetchData(url?: string)` calls `http.get(url)` without guard")),
            ("assistant", "找到了：url 可选参数没做空值保护。我修一下。"),
            ("tool", "edit", ("src/api/client.ts", "added `if (!url) throw new Error('url is required')` guard")),
            ("tool", "bash", ("npm run typecheck", "✅ No type errors (2.3s)")),
            ("assistant", "修复完成，CI 应该能过了。"),
        ]),
        ("sample-3", "调研 RAG 方案", [
            ("user", "对比一下 RAG 和长上下文的成本差异"),
            ("assistant", "我去搜一些数据，然后整理成对比。"),
            ("tool", "web_search", ("RAG vs long-context cost comparison 2026", "1. RAG: ~$0.001/query retrieval 2. Long-context: $0.01/1K tokens…")),
            ("assistant", "搜到了几份资料，我总结一下核心结论。"),
            ("tool", "write", ("reports/rag-vs-longcontext.md", "wrote 1200-word comparison report")),
            ("assistant", "报告写好了：短文档用 RAG 便宜，长文档重复查询用长上下文更划算。"),
        ]),
    ]
    manifest = []
    for sid, title, steps in demos:
        lines = build_session(sid, title, steps)
        with open(os.path.join(OUT_DIR, sid + ".jsonl"), "w") as f:
            for ln in lines:
                f.write(json.dumps(ln, ensure_ascii=False) + "\n")
        manifest.append({"file": sid + ".jsonl", "title": title, "timestamp": ts(7200)})
        print(f"  wrote {sid}.jsonl ({len(lines)} events)")
    with open(os.path.join(OUT_DIR, "index.json"), "w") as f:
        json.dump({"version": 1, "samples": manifest}, f, indent=2, ensure_ascii=False)
    print("done —", len(demos), "fake demos written to", OUT_DIR)

if __name__ == "__main__":
    main()
