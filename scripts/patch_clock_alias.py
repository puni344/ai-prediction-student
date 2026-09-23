with open("backend/main.py", "r", encoding="utf-8") as f:
    c = f.read()

target = """@app.get(f"{settings.API_V1_STR}/system/now")"""
replacement = """@app.get(f"{settings.API_V1_STR}/system/clock")
@app.get(f"{settings.API_V1_STR}/system/now")"""

if target in c and "system/clock" not in c:
    c = c.replace(target, replacement)
    with open("backend/main.py", "w", encoding="utf-8") as f:
        f.write(c)
    print("Clock alias added.")
else:
    print("Already present or target not found.")
