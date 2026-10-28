---
description: "[depth] topic - deep web research (quick|standard|deep|exhaustive)"
---
<!-- Primary path: the extension rewrites /research into /skill:pi-deep-research before expansion, so the hidden skill loads via Pi core. This bod
y only runs if the extension is inactive. -->
Before anything else, load the pi-deep-research skill: read `pi-deep-research/SKILL.md` from the pi-deep-research-lean package that provides this command (`../pi-deep-research/SKILL.md` relative to this file), plus `../references/config.md` and `../references/report-template.md` from the same package. If the package path is unknown, locate `pi-deep-research/SKILL.md` via file search. Then follow that workflow strictly.

Conduct deep research on the following topic:

${@:2}

**Research depth: $1**

Follow the deep-research skill workflow strictly. Use the depth level specified above ($1).
If the depth parameter is not one of quick/standard/deep/exhaustive, treat it as part of the topic and use standard depth.
