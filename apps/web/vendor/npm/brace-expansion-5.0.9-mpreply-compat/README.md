# brace-expansion 5.0.9 — MPReply compatibility package

This vendored package contains the upstream `5.0.9` bounded expansion algorithm
for CVE-2026-14257 and CVE-2026-69152 and exposes both supported call forms
required by the current MPReply tooling graph:

```js
const expand = require("brace-expansion")
const { expand: namedExpand } = require("brace-expansion")
```

It is vendored only because legacy `minimatch@3.1.5` expects the historical
callable CommonJS export, while modern `minimatch@10.2.5` expects the named
`expand` export. The expansion algorithm and limits follow upstream 5.0.9.
