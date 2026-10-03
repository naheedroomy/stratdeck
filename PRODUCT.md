# Stratdeck product

Stratdeck is a private team strategy reader synchronized from one Discord server. Discord is the authoring source. One supported text channel becomes one strategy; original messages become opening notes and image-led chronological steps. The application does not infer tactics or rewrite notes.

Teammates use a shared password to browse selected categories, search names and notes, follow steps, enlarge screenshots, and open source messages in Discord. Owners manage content in Discord and keep credentials private. Individual accounts, editing, AI, and multi-server support are out of scope.

Selected category IDs are maintained in the versioned `config/categories.txt` file, one snowflake per line; blank lines and `#` comments are allowed. Missing, empty, or malformed files fail startup closed. `.env` contains other private runtime configuration only. Deployment architecture and constraints are documented in `docs/DEPLOYMENT.md`; the API contract is in `docs/API.md`. Team content is served only through authenticated APIs/media and is not packaged into public assets.
