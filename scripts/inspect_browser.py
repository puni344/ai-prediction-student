import urllib.request
import json
import asyncio
import websockets

async def check():
    req = urllib.request.urlopen("http://127.0.0.1:9222/json/list")
    pages = json.loads(req.read().decode("utf-8"))
    target = None
    for p in pages:
        if p.get("id") == "C7E63E54F048B9A00FC0D82A2C82EDEB":
            target = p["webSocketDebuggerUrl"]
            break
    if not target:
        print("Target not found")
        return

    async with websockets.connect(target) as ws:
        expr = """
        (() => {
            const errors = Array.from(document.querySelectorAll('.text-rose-300, .text-rose-400, .text-emerald-400')).map(e => e.innerText);
            const bodyText = document.body.innerText;
            const turnstileElem = document.querySelector('.turnstile-container');
            return {
                errors: errors,
                hasVerifiedText: bodyText.includes("Verified"),
                hasExpiredText: bodyText.includes("Verification expired"),
                hasVerifyingText: bodyText.includes("Verifying"),
                bodySnippet: bodyText.substring(0, 500)
            };
        })()
        """
        msg = {
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {
                "expression": expr,
                "returnByValue": True
            }
        }
        await ws.send(json.dumps(msg))
        res = json.loads(await ws.recv())
        print("Page State:", json.dumps(res.get("result", {}).get("value", {}), indent=2))

asyncio.run(check())
