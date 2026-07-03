const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function findTsxFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findTsxFiles(fullPath, fileList);
    } else if (fullPath.endsWith('.tsx') && !fullPath.includes('SetupAccount.tsx') && !fullPath.includes('TutorialOverlay.tsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = findTsxFiles(srcDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('₹') || content.includes('INR ')) {
    // Determine relative path to hooks
    const depth = file.replace(srcDir, '').split(path.sep).length - 2;
    const hooksPath = depth === 0 ? './hooks/useCurrency' : '../'.repeat(depth) + 'hooks/useCurrency';

    // Add import if not present
    if (!content.includes('useCurrency')) {
      // Find the last import
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfLastImport = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, endOfLastImport + 1) + `import { useCurrency } from '${hooksPath}';\n` + content.slice(endOfLastImport + 1);
      } else {
        content = `import { useCurrency } from '${hooksPath}';\n` + content;
      }
      changed = true;
    }

    // Insert const currency = useCurrency(); into main component
    if (!content.includes('const currency = useCurrency();')) {
      // Find export default function XYZ() { or export function XYZ() {
      const match = content.match(/export (?:default )?function [A-Z][a-zA-Z0-9_]*\s*\([^)]*\)\s*\{/);
      if (match) {
        const insertIndex = match.index + match[0].length;
        content = content.slice(0, insertIndex) + '\n  const currency = useCurrency();' + content.slice(insertIndex);
        changed = true;
      } else {
        const match2 = content.match(/const [A-Z][a-zA-Z0-9_]* = \([^)]*\) =>\s*\{/);
        if (match2) {
          const insertIndex = match2.index + match2[0].length;
          content = content.slice(0, insertIndex) + '\n  const currency = useCurrency();' + content.slice(insertIndex);
          changed = true;
        }
      }
    }

    // Replace literal ₹ in JSX text
    // E.g. >₹{amount} -> >{currency}{amount}
    // E.g. > ₹{amount} -> > {currency}{amount}
    content = content.replace(/>([^<]*?)₹([^<]*?)</g, '>$1{currency}$2<');
    content = content.replace(/>([^<]*?)₹([^<]*?)</g, '>$1{currency}$2<'); // run twice in case of multiple on one line

    // Replace literal ₹ inside template literals
    // E.g. `₹${amount}` -> `${currency}${amount}`
    content = content.replace(/`([^`]*?)₹([^`]*?)`/g, '`$1${currency}$2`');
    content = content.replace(/`([^`]*?)₹([^`]*?)`/g, '`$1${currency}$2`');
    
    // Replace INR in template strings (e.g. `INR ${amount}`)
    content = content.replace(/`([^`]*?)INR\s+([^`]*?)`/g, '`$1${currency} $2`');

    // Replace remaining ₹ that might be in quotes (like "₹500") if it's a string literal, though less common.
    // E.g. "₹500" -> currency + "500" or just let it be. For now, leave it.

    if (changed) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Updated:', file);
    }
  }
});
