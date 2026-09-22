import fs from 'fs'; let file = process.argv[2]; let c = fs.readFileSync(file, 'utf8'); c = c.replace(/^pick/gm, 'reword'); fs.writeFileSync(file, c);
