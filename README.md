# Component Studio

A local visual builder for Discord Components V2 messages. Compose a message, inspect its dark and light previews, insert Unicode symbols, and export JSON or a discord.js TypeScript example.

## Run it

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. `npm test` checks message export and project bundles; `npm run build` checks types and creates the production build in `dist/`.

## What it supports

- All [documented message components](https://docs.discord.com/developers/components/reference): containers, sections, text displays, separators, media galleries, files, thumbnails, action rows, buttons, and message select menus.
- A close Discord-style preview at desktop and mobile widths, with dark and light themes. Click a component in the tree or preview to edit it. Drag tree items to reorder them; use Alt+Up or Alt+Down when focused on a tree item.
- Searchable symbol categories, favorites, recent symbols, and Unicode alphabet styles. Insert symbols into a selected text display or copy styled text.
- Browser autosave and versioned project ZIP files containing local attachments. The ZIP also contains `message.json` and `send.ts` for handoff.
- Import existing Components V2 message JSON or a Component Studio project bundle. Unsupported fields are reported instead of being silently dropped.

The preview is a simulation. Discord controls its own font, resolves mentions and dynamic select options in the client, and may change media sizing or wrapping between clients. Unicode alphabet styles are characters, not font settings. A File component requires a local attachment. Interactive buttons and selects require handlers in your bot.

Components V2 messages use the `IS_COMPONENTS_V2` flag and cannot also contain classic `content` or `embeds`. This app builds V2 messages only.
