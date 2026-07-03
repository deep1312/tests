import os
import re

files = [
  "UI/src/pages/Monitoring.tsx",
  "UI/src/pages/Alerts.tsx",
  "UI/src/pages/Incidents.tsx",
  "UI/src/pages/IncidentDetail.tsx",
  "UI/src/components/monitoring/SuccessRateChart.test.tsx",
  "UI/src/components/monitoring/SummaryPanel.tsx",
  "UI/src/components/monitoring/MetricExplorer.tsx",
  "UI/src/components/monitoring/MetricExplorer.test.tsx",
  "UI/src/components/monitoring/AdaptiveInsightsPanel.tsx",
  "UI/src/components/monitoring/FilterBar.tsx",
  "UI/src/components/monitoring/charts/TelemetryTable.tsx",
  "UI/src/components/monitoring/AlertDetailSheet.tsx",
  "UI/src/components/monitoring/DetailDrawer.tsx",
  "UI/src/components/monitoring/StatusTimelineChart.tsx",
  "UI/src/components/monitoring/CheckHealthMatrix.tsx",
  "UI/src/components/monitoring/ExecutionTimeChart.test.tsx",
  "UI/src/components/monitoring/SuccessRateChart.tsx",
  "UI/src/components/monitoring/CheckHealthMatrix.test.tsx",
  "UI/src/components/monitoring/ExecutionTimeChart.tsx",
  "UI/src/components/monitoring/SummaryPanel.test.tsx"
]

replacements = {
    r'\bbg-white\b': 'bg-card/90 backdrop-blur-sm',
    r'\bbg-gray-50\b': 'bg-muted',
    r'\bbg-slate-50\b': 'bg-muted',
    r'\bbg-gray-100\b': 'bg-muted',
    r'\bbg-slate-100\b': 'bg-muted',
    r'\bbg-gray-900\b': 'bg-background',
    r'\bbg-slate-900\b': 'bg-background',
    r'\bbg-\[\#0f172a\]\b': 'bg-background',
    r'\btext-gray-900\b': 'text-foreground',
    r'\btext-slate-900\b': 'text-foreground',
    r'\btext-black\b': 'text-foreground',
    r'\btext-gray-800\b': 'text-foreground',
    r'\btext-slate-800\b': 'text-foreground',
    r'\btext-gray-500\b': 'text-muted-foreground',
    r'\btext-slate-500\b': 'text-muted-foreground',
    r'\btext-gray-600\b': 'text-muted-foreground',
    r'\btext-slate-600\b': 'text-muted-foreground',
    r'\btext-gray-400\b': 'text-muted-foreground',
    r'\btext-slate-400\b': 'text-muted-foreground',
    r'\bborder-gray-200\b': 'border-border',
    r'\bborder-slate-200\b': 'border-border',
    r'\bborder-gray-300\b': 'border-border',
    r'\bborder-slate-300\b': 'border-border',
}

for file in files:
    if not os.path.exists(file):
        continue
    with open(file, 'r') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements.items():
        new_content = re.sub(old, new, new_content)
    
    if new_content != content:
        with open(file, 'w') as f:
            f.write(new_content)
        print(f"Updated {file}")

