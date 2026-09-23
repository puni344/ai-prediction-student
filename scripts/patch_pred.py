with open("frontend/src/pages/student/PredictionPage.tsx", "r", encoding="utf-8") as f:
    c = f.read()

if "extractErrorMessage" not in c.split("\n")[0:20]:
    c = 'import { extractErrorMessage } from "../../utils/errors";\n' + c

with open("frontend/src/pages/student/PredictionPage.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Added import to PredictionPage.tsx")
