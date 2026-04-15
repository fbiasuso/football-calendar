# Skill Registry

This file documents available agent skills for the project.

## SDD Skills (User-level)

Located at `~/.config/opencode/skills/`:

| Skill | Description | Trigger |
|-------|-------------|---------|
| `sdd-init` | Bootstrap SDD context | Project initialization |
| `sdd-explore` | Investigate codebase | `/sdd-explore <topic>` |
| `sdd-propose` | Create change proposals | `/sdd-new <change>`, `/sdd-propose` |
| `sdd-spec` | Write specifications | After proposal, before design |
| `sdd-design` | Technical design | After spec |
| `sdd-tasks` | Task breakdown | After design |
| `sdd-apply` | Implementation | During implementation |
| `sdd-verify` | Validation | After implementation |
| `sdd-archive` | Archive completed change | After verification |

## Project Skills

None yet.

---

*This registry is auto-generated during SDD init.*