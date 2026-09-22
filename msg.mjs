import fs from 'fs'; let file = process.argv[2]; let c = fs.readFileSync(file, 'utf8'); c = c.replace(/^feat:/, 'feat(player):').replace(/^fix:/, 'fix(player):'); fs.writeFileSync(file, c);
