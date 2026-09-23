# -*- coding: utf-8 -*-

# 1. Update PerformanceAnalysisSidebar.tsx
sidebar_path = 'frontend/src/components/analytics/PerformanceAnalysisSidebar.tsx'
with open(sidebar_path, 'r', encoding='utf-8') as f:
    sidebar_code = f.read()

old_desc = 'Based on {chartData.length} recorded {activeRange === "DAY" ? "daily snapshots" : activeRange === "WEEK" ? "weekly intervals" : "calendar months"}.'
new_desc = '''{activeRange === "DAY" && `Based on ${chartData.length} recorded daily snapshots (last 30 calendar days).`}
              {activeRange === "WEEK" && `Based on ${chartData.length} weekly intervals (last 35 calendar days, 7 days/week).`}
              {activeRange === "MONTH" && `Based on all ${chartData.length} recorded calendar months (Sep '26 - Sep '27, 365 daily snapshots).`}
              {activeRange === "YEAR" && `Based on exactly ${chartData.length} consecutive calendar months (Oct '26 - Sep '27, 354 daily snapshots).`}'''

sidebar_code = sidebar_code.replace(old_desc, new_desc)

with open(sidebar_path, 'w', encoding='utf-8') as f:
    f.write(sidebar_code)
print('Updated PerformanceAnalysisSidebar.tsx successfully!')

# 2. Update PerformanceTrendBarChart.tsx
chart_path = 'frontend/src/components/charts/PerformanceTrendBarChart.tsx'
with open(chart_path, 'r', encoding='utf-8') as f:
    chart_code = f.read()

chart_code = chart_code.replace(
    'return "Predicted Performance - Daily Snapshots";',
    'return "Predicted Performance - Daily Snapshots (Last 30 Days)";'
)
chart_code = chart_code.replace(
    'return "Predicted Performance - Last 5 Weeks";',
    'return "Predicted Performance - Last 5 Weeks (35 Days)";'
)
chart_code = chart_code.replace(
    'return "Predicted Performance - Monthly Progression";',
    'return "Predicted Performance - All Recorded Calendar Months (13 Months: Sep \'26 - Sep \'27)";'
)
chart_code = chart_code.replace(
    'return "Predicted Performance - Full Year Progression";',
    'return "Predicted Performance - 12 Consecutive Calendar Months (Oct \'26 - Sep \'27)";'
)

with open(chart_path, 'w', encoding='utf-8') as f:
    f.write(chart_code)
print('Updated PerformanceTrendBarChart.tsx successfully!')
