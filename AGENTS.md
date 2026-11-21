# 渠成 Conduit — standing rules for every agent

This is a local-first study app that takes one learner from zero to hired as a 數據開發工程師 (Data Engineer). Claude directs and reviews; GPT (you) implements and researches. The product spec is `E:\ClaudeProjects\conduit-briefs\00-spec.md` — read it before any work. Each task has its own brief in `E:\ClaudeProjects\conduit-briefs\`. Lesson-writing rules are in `E:\ClaudeProjects\conduit-briefs\content-style.md`.

The app engine was copied from the sister project 棧道 Stackway. Code and docs in this folder may still say Stackway/棧道 until the build brief renames them.

## Rules (always)

1. Work only inside `E:\ClaudeProjects\conduit` and write your report into `E:\ClaudeProjects\conduit-briefs`. The only other folder you may **read** (never write) is `E:\ClaudeProjects\stackway\content\` and `E:\ClaudeProjects\stackway\research\`, and only when your brief says so. Do not read or write any other project folder (especially `E:\CodexProjects\*`, `E:\ClaudeProjects\watchdogs-*`, `E:\ClaudeProjects\patrol`, `E:\ClaudeProjects\stackway\userdata`).
2. No git: do not run `git init`, commit, branch, or push.
3. No global installs and no system changes. `npm install` into this project with exact pinned versions is fine. Python (`C:\Python311\python.exe`, has PyYAML) may be used with `-B`. Do not download anything else except web pages for research and npm packages the spec allows.
4. Never delete or overwrite files you did not create in this task unless the brief says so. Never touch `userdata/` (the learner's data).
5. Product text is Traditional Chinese with the vocabulary in spec §1 (數據 for data). No Simplified characters in product text.
6. Content is original writing. Summarise and link sources; never copy paragraphs from them. Every external URL you put in content must have been opened and checked by you.
7. Do not put anyone's personal information (names, emails, accounts) into files, code, or requests. Example data uses invented names.
8. You run non-interactively: nobody will answer questions mid-task. When something is unclear, choose the option that best fits the spec, record it under "Decisions" in your report, and continue.
9. Several tasks may run at the same time in this folder. Respect the file ownership stated in your brief; never edit files owned by another task.
10. Scratch files (test scripts, browser profiles, temporary builds) go under `E:\ClaudeProjects\conduit\.cache\<your-task-tag>\` and are deleted before you stop (but never delete `.cache\` itself or other tasks' folders). Never leave them in `content/`, `src/` or the project root.
11. Finish by writing the report file named in your brief, then stop.
