# ConduitTTS — standing rules (local voice generation for 渠成 Conduit)

This folder holds the local text-to-speech toolchain that pre-generates read-aloud audio for the study app `E:\ClaudeProjects\conduit`. Claude directs; GPT (you) installs and builds. Briefs and reports live in `E:\ClaudeProjects\conduit-briefs\`.

1. Write only inside `F:\ConduitTTS\` and your report in `E:\ClaudeProjects\conduit-briefs\`. You may READ `E:\ClaudeProjects\conduit\` (and run its `npm.cmd run speech:export` if it exists) but never edit files there unless the brief says so.
2. Downloads only from the official sources named in the brief (GitHub release of RVC-Boss/GPT-SoVITS, download.pytorch.org, PyPI, the official Hugging Face model repos, the dataset's official host, ffmpeg via gyan.dev). Never download the GPT-SoVITS Windows all-in-one package. Never run unknown binaries. Record **every** downloaded file in `F:\ConduitTTS\LEDGER.md` (name, URL, bytes, SHA-256, date).
3. No global installs, no system changes, no driver changes, no PATH/registry edits. Everything in `F:\ConduitTTS\.venv`, `tools\`, caches under `F:\ConduitTTS\` (set TEMP, PIP_CACHE_DIR, HF_HOME, NLTK_DATA, TORCH_HOME there). Using the existing Visual Studio 2022 C++ toolchain to compile a wheel is allowed.
4. No git operations. No Python bytecode in source folders (`PYTHONDONTWRITEBYTECODE=1` where possible).
5. Voice rights: use only the reference audio the brief allows; keep its license and attribution in `F:\ConduitTTS\ref\<voice>\LICENSE-NOTE.md`. Never use recordings of real people or characters from other sources.
6. Do not send lesson text or audio to any online service.
7. Non-interactive: decide, record under "Decisions" in your report, continue. Finish by writing the report named in the brief, then stop. Long-running generation is NOT yours: leave scripts ready; the director runs them.
