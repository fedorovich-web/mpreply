# Respio 0.1.96 — section spacing and trial modal recovery

## Scope

- Fixed global spacing between public labels, H1/H2 headings and subtitles.
- Reworked trial popup layout, lead copy, left benefits list and form style.
- Kept name, email and phone fields; removed marketplace selector.
- Preserved dependency warning fix for inflight/rimraf/glob.
- Bumped public version contract to 0.1.96.

## Required local checks

```bash
cd apps/web
node -p "require('./package.json').version"
npm ci
npm ls inflight rimraf glob --all
npm run test:unit
npm run test:design-tokens
npm run typecheck
npm run lint
npm run validate:css-syntax
npm run build
npm run validate:w3c
npm run design:detect
npm run test:visual
```
