# Repository workflow

- This is the Discord Components V2 builder project. Keep its GitHub repository private.
- If this directory has no Git repository, initialize one. If no GitHub remote exists, create a new private GitHub repository named `embedbuilder` under the authenticated account and set it as `origin`. Never make the repository public without an explicit user request.
- Commit and push completed work frequently in focused, meaningful commits. Run the relevant checks before each push and verify that the local branch and `origin` point to the same commit afterward.
- Preserve unrelated edits. Do not commit credentials, tokens, browser state, local drafts, uploaded user media, caches, or build output.
- If GitHub authentication or a remote operation fails, report the exact blocker and continue local implementation and verification.

Use lucide icons, but not super famous or common ones. Also no sparkle icons.

Do not spend a lot of time on testing unless asked. Only run tests on changes that you think are most likely to break something and deserving of testing, or when explicitly requested. The goal is to get a working prototype out quickly, and I'd rather quickly test the site myself than spend time waiting on complicated and unnecessary automated tests.
