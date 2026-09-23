with open('frontend/src/pages/student/AIAdvisorPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

import re
c = re.sub(
    r'setChatError\(\s*err\.response\?\.data\?\.detail\s*\|\|\s*"We couldn\'t load your academic insight right now\. Please try again\."\s*\);',
    'setChatError(extractErrorMessage(err, "We couldn\'t load your academic insight right now. Please try again."));',
    c
)

with open('frontend/src/pages/student/AIAdvisorPage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('AIAdvisorPage patched successfully!')
