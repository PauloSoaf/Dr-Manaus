const fs = require('fs'); let f = fs.readFileSync(process.argv[2], 'utf8'); f = f.replace(/^feat:/, 'feat(player):').replace(/^fix:/, 'fix(player):'); fs.writeFileSync(process.argv[2], f);
