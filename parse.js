const fs = require('fs'); const html = fs.readFileSync('error441.html', 'utf8'); const regex = /"message":"([^"]+)"/g; let m; while ((m = regex.exec(html)) !== null) { console.log(m[1]); }
