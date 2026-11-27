# Plants vs. Zombies: Emoji Edition — modular Version 69

This ZIP is a file-organization conversion of the supplied `plants-vs-zombies-v69-ability-visuals.html`. Game logic, content, CSS rules, Tailwind CDN usage, and script order were preserved; embedded CSS and JavaScript were moved into separate files.

## Run

Open `index.html` in a modern browser. An internet connection is required for the existing Tailwind CSS CDN dependency. If your browser restricts local-file behavior, serve this folder with a simple local static web server and open the local address.

## Structure

- `index.html` — game markup and stylesheet/script references
- `src/css/` — original CSS blocks, separated in their original order
- `src/js/` — original inline JavaScript blocks, separated and loaded in their original order

No fusion mode, new recipes, gameplay changes, or refactoring were added.
