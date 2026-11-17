# Specs

One file per change, `GD-<n>-<slug>.md`, created from `TEMPLATE.md` (the `/spec` skill does this). A spec is approved by the owner before implementation starts and set to done in the PR that completes it. Specs are the memory of the project: when a question comes up about why something works the way it does, the answer should be here or in `docs/adr/`.

Ids GD-0 to GD-8 are reserved for the steps in `docs/session-brief.md` section 4 (step N is GD-N). Any other change takes the next id above both 8 and the largest existing id, so it never collides with a planned step.
