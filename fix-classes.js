const fs = require('fs');

const content = fs.readFileSync('app/recepcionista/page.tsx', 'utf8');

// Replace className="..." with className={c(`...`)} for strings containing /
let result = content.replace(/className="([^"]*\/[^"]*)"/g, (match, p1) => {
  return 'className={c(`' + p1 + '`)}';
});

fs.writeFileSync('app/recepcionista/page.tsx', result);
console.log('Done');