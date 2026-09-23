with open("frontend/src/pages/student/PredictionPage.tsx", "r", encoding="utf-8") as f:
    pred_content = f.read()

target = """                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\\d*\\.?\\d*$/.test(val)) {
                          setWhatIfStrings((prev) => ({ ...prev, study_hours: val }));"""

replacement = """                      onChange={(e) => {
                        const rawVal = e.target.value;
                        if (rawVal === "" || /^\\d*\\.?\\d*$/.test(rawVal)) {
                          const val = rawVal.replace(/^0+(?=\\d)/, "");
                          setWhatIfStrings((prev) => ({ ...prev, study_hours: val }));"""

if target in pred_content:
    pred_content = pred_content.replace(target, replacement)
    print("study_hours input replaced")

target2 = """                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\\d*\\.?\\d*$/.test(val)) {
                          setWhatIfStrings((prev) => ({ ...prev, attendance: val }));"""

replacement2 = """                      onChange={(e) => {
                        const rawVal = e.target.value;
                        if (rawVal === "" || /^\\d*\\.?\\d*$/.test(rawVal)) {
                          const val = rawVal.replace(/^0+(?=\\d)/, "");
                          setWhatIfStrings((prev) => ({ ...prev, attendance: val }));"""

if target2 in pred_content:
    pred_content = pred_content.replace(target2, replacement2)
    print("attendance input replaced")

target3 = """                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\\d*\\.?\\d*$/.test(val)) {
                          setWhatIfStrings((prev) => ({ ...prev, sleep_hours: val }));"""

replacement3 = """                      onChange={(e) => {
                        const rawVal = e.target.value;
                        if (rawVal === "" || /^\\d*\\.?\\d*$/.test(rawVal)) {
                          const val = rawVal.replace(/^0+(?=\\d)/, "");
                          setWhatIfStrings((prev) => ({ ...prev, sleep_hours: val }));"""

if target3 in pred_content:
    pred_content = pred_content.replace(target3, replacement3)
    print("sleep_hours input replaced")

target4 = """                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\\d*\\.?\\d*$/.test(val)) {
                          setWhatIfStrings((prev) => ({ ...prev, assignments_completed: val }));"""

replacement4 = """                      onChange={(e) => {
                        const rawVal = e.target.value;
                        if (rawVal === "" || /^\\d*\\.?\\d*$/.test(rawVal)) {
                          const val = rawVal.replace(/^0+(?=\\d)/, "");
                          setWhatIfStrings((prev) => ({ ...prev, assignments_completed: val }));"""

if target4 in pred_content:
    pred_content = pred_content.replace(target4, replacement4)
    print("assignments_completed input replaced")

with open("frontend/src/pages/student/PredictionPage.tsx", "w", encoding="utf-8") as f:
    f.write(pred_content)
print("PredictionPage.tsx finished successfully.")
