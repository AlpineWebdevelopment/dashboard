# Do not commit until I confirm

**Never run `git commit` in this repo unless I have explicitly asked for it in that message.**

Write the files, run the migrations I approved, typecheck, lint, build, test — then stop and
tell me what changed. Leave everything in the working tree. I decide when it lands, and I will
say so plainly ("commit this", "yes commit"). Finishing a task is not permission to commit it,
and neither is a plan that mentions committing.

Same for `git push`, `git reset --hard`, and force-pushing: ask first.

# Styling

This project has a wallpaper feature, and a set of conventions that exist because of it:
frosted `.panel` surfaces, a 13px type floor, and `dark:text-zinc-200` as the settled
secondary. **Read `STYLING.md` before touching any className.** It also records the
traps — the `:where()` zero-specificity variant, the specificity of bare `group-hover:`,
and the newline-matching regex that has corrupted this repo twice.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
