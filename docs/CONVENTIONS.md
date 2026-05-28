# Code & Communication Conventions

## Code Style
- Comments are direct: acknowledge what the code does AND why. Avoid filler.
- Variable names: `built_for` / `builtFor` interchangeable (snake_case in Python, camelCase in JS)
- Don't add formatting the user didn't ask for — plain prose, minimal headers/bullets

## Testing
- Run headless test before declaring a fix works:
  ```bash
  node --check <extracted-script>.js
  # or
  node playwright-test.js  # full click-through
