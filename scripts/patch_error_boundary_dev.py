with open("frontend/src/components/common/ErrorBoundary.tsx", "r", encoding="utf-8") as f:
    c = f.read()

target = """            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              An unexpected error occurred while rendering this view. Your session and credentials remain completely active.
            </p>"""

replacement = """            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              An unexpected error occurred while rendering this view. Your session and credentials remain completely active.
            </p>

            {this.state.error && (
              <div className="mt-4 p-3 bg-black/60 rounded-xl text-left font-mono text-[11px] text-rose-300 overflow-x-auto border border-rose-500/20 max-h-48">
                <div className="font-bold text-rose-400">{this.state.error.name}: {this.state.error.message}</div>
                {this.state.error.stack && (
                  <pre className="mt-1 text-[10px] text-slate-400 whitespace-pre-wrap">{this.state.error.stack}</pre>
                )}
              </div>
            )}"""

if target in c:
    c = c.replace(target, replacement)
    with open("frontend/src/components/common/ErrorBoundary.tsx", "w", encoding="utf-8") as f:
        f.write(c)
    print("ErrorBoundary updated with dev details.")
else:
    print("Target pattern not found in ErrorBoundary.tsx")
