const fs = require('fs');

const content = fs.readFileSync('app/recepcionista/page.tsx', 'utf8');

// Replace all c(`...`) with c('...') for strings containing /
let result = content.replace(/c\(`([^`]*\/[^`]*)`\)/g, (match, p1) => {
  return 'c(\'' + p1.replace(/'/g, "\\'") + '\')';
});

require('fs').writeFileSync('app/recepcionista/page.tsx', result);
console.log('Done');