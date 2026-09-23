const fs = require('fs');

const content = fs.readFileSync('app/recepcionista/page.tsx', 'utf8');

// Escape ${ in template literals that are inside c() calls
let result = content.replace(/c\(`([^`]*)`\)/g, (match, p1) => {
  // Escape ${ in the content
  const escaped = p1.replace(/\$\{/g, '\\${');
  return 'c(\'' + escaped.replace(/'/g, "\\'") + '\')';
});

// Also handle any remaining template literals in c() calls
result = result.replace(/c\(`([^`]*)`\)/g, (match, p1) => {
  const escaped = p1.replace(/\$\{/g, '\\${');
  return 'c(\'' + escaped.replace(/'/g, "\\'") + '\')';
});

require('fs').writeFileSync('app/recepcionista/page.tsx', result);
console.log('Done');