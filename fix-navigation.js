const fs = require('fs');
const path = require('path');

// Configuration
const ROOT = process.cwd();
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', '.expo', 'android', 'ios'];

// Track changes
let filesModified = 0;
let totalFixes = 0;
const changes = [];

// Walk directory
function walk(dir, files = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDE_DIRS.includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, files);
      } else if (EXTENSIONS.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`⚠️  Could not read ${dir}:`, error.message);
  }
  return files;
}

// Fix patterns
const fixes = [
  {
    pattern: /import\s+{([^}]*)}\s+from\s+['"]@react-navigation\/native['"]/g,
    replacement: (match, imports) => {
      const cleaned = imports.replace(/\buseNavigation\b/g, 'useRouter')
                            .replace(/\buseRoute\b/g, 'useLocalSearchParams')
                            .replace(/\bNavigationContainer\b/g, '')
                            .replace(/\bcreateNavigationContainerRef\b/g, '')
                            .replace(/,\s*,/g, ',')
                            .replace(/,\s*}/g, '}')
                            .replace(/{\s*,/g, '{')
                            .trim();
      if (!cleaned) return "import { router } from 'expo-router';";
      if (cleaned.includes('useRouter') || cleaned.includes('useLocalSearchParams')) {
        return `import { ${cleaned} } from 'expo-router';`;
      }
      return "import { router } from 'expo-router';";
    }
  },
  {
    pattern: /const\s+(\w+)\s*=\s*useNavigation\(\);/g,
    replacement: () => 'const router = useRouter();'
  },
  {
    pattern: /(\w+)\.navigate\(['"]([^'"]+)['"],\s*{([^}]+)}\)/g,
    replacement: (match, navVar, screen, params) => {
      const paramStr = params.trim();
      const paramsObj = paramStr.split(',').reduce((acc, p) => {
        const [key, val] = p.trim().split(':').map(s => s.trim());
        if (key && val) acc[key] = val.replace(/['"]/g, '');
        return acc;
      }, {});
      const routeMap = {
        'DetailScreen': 'movie',
        'VideoPlayer': 'player',
        'Home': '/(tabs)',
        'Library': '/(tabs)/library',
        'Settings': '/(tabs)/settings',
        'MainTabs': '/(tabs)'
      };
      const route = routeMap[screen] || screen.toLowerCase();
      if (paramsObj.id) {
        return `router.push(\`/${route}/${paramsObj.id}\`);`;
      } else if (Object.keys(paramsObj).length > 0) {
        const queryString = Object.entries(paramsObj).map(([k, v]) => `${k}=${v}`).join('&');
        return `router.push(\`/${route}?${queryString}\`);`;
      } else {
        return `router.push(\`/${route}\`);`;
      }
    }
  },
  {
    pattern: /(\w+)\.navigate\(['"]([^'"]+)['"]\)/g,
    replacement: (match, navVar, screen) => {
      const routeMap = {
        'DetailScreen': 'movie',
        'VideoPlayer': 'player',
        'Home': '/(tabs)',
        'Library': '/(tabs)/library',
        'Settings': '/(tabs)/settings',
        'MainTabs': '/(tabs)'
      };
      const route = routeMap[screen] || screen.toLowerCase();
      return `router.push(\`/${route}\`);`;
    }
  },
  {
    pattern: /(\w+)\.goBack\(\)/g,
    replacement: () => 'router.back();'
  },
  {
    pattern: /(\w+)\.replace\(['"]([^'"]+)['"],\s*{([^}]+)}\)/g,
    replacement: (match, navVar, screen, params) => {
      const routeMap = {
        'DetailScreen': 'movie',
        'VideoPlayer': 'player'
      };
      const route = routeMap[screen] || screen.toLowerCase();
      const paramStr = params.trim();
      const idMatch = paramStr.match(/id:\s*['"]?([^,'"]+)['"]?/);
      if (idMatch) {
        return `router.replace(\`/${route}/${idMatch[1]}\`);`;
      }
      return `router.replace(\`/${route}\`);`;
    }
  },
  {
    pattern: /(\w+)\.setOptions\(({[^}]+})\)/g,
    replacement: (match) => match
  },
  {
    pattern: /(\w+)\.canGoBack\(\)/g,
    replacement: () => 'router.canGoBack()'
  },
  {
    pattern: /const\s+route\s*=\s*useRoute\(\);/g,
    replacement: 'const { params } = useLocalSearchParams();'
  },
  {
    pattern: /route\.params\.(\w+)/g,
    replacement: (match, param) => `params.${param}`
  },
  {
    pattern: /const\s+{([^}]+)}\s*=\s*route\.params;/g,
    replacement: (match, params) => `const { ${params} } = useLocalSearchParams();`
  }
];

// Process each file
const files = walk(ROOT);
console.log(`📁 Found ${files.length} files to scan...\n`);

for (const file of files) {
  try {
    const original = fs.readFileSync(file, 'utf8');
    let content = original;
    let fileChanges = 0;
    const fileFixes = [];

    for (const fix of fixes) {
      const matches = content.match(fix.pattern);
      if (matches) {
        content = content.replace(fix.pattern, (...args) => {
          fileChanges++;
          const replacement = fix.replacement(...args);
          fileFixes.push({
            from: args[0].trim().slice(0, 80) + '...',
            to: replacement.trim().slice(0, 80) + '...'
          });
          return replacement;
        });
      }
    }

    if (content.includes('router.') || content.includes('useRouter') || content.includes('useLocalSearchParams')) {
      if (!content.includes("from 'expo-router'") && !content.includes('from "expo-router"')) {
        const importStatement = "import { router, useRouter, useLocalSearchParams } from 'expo-router';\n";
        const importRegex = /^import\s+.*?from\s+['"].*?['"];?\s*\n/m;
        if (content.match(importRegex)) {
          content = content.replace(importRegex, (match) => {
            if (!match.includes('expo-router')) {
              return match + importStatement;
            }
            return match;
          });
        } else {
          content = importStatement + content;
        }
        fileChanges++;
      }
    }

    if (content.includes('@react-navigation/native') && !content.includes('useNavigation') && !content.includes('useRoute')) {
      content = content.replace(/import\s+{[^}]*}\s+from\s+['"]@react-navigation\/native['"];?\s*\n/g, '');
      fileChanges++;
    }

    if (fileChanges > 0) {
      fs.writeFileSync(file + '.bak', original, 'utf8');
      fs.writeFileSync(file, content, 'utf8');
      filesModified++;
      totalFixes += fileChanges;
      changes.push({
        file: path.relative(ROOT, file),
        fixes: fileFixes,
        count: fileChanges
      });
      console.log(`✅ Fixed ${fileChanges} issue(s) in ${path.relative(ROOT, file)}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
}

console.log('\n' + '='.repeat(60));
console.log('📊 SUMMARY');
console.log('='.repeat(60));
console.log(`📁 Files modified: ${filesModified}`);
console.log(`🔧 Total fixes applied: ${totalFixes}`);

if (changes.length > 0) {
  console.log('\n📝 Detailed changes:');
  changes.forEach(({ file, count, fixes }) => {
    console.log(`\n  📄 ${file} (${count} fixes)`);
    fixes.slice(0, 3).forEach(({ from, to }) => {
      console.log(`    - ${from.replace(/\n/g, ' ')}`);
      console.log(`      → ${to.replace(/\n/g, ' ')}`);
    });
    if (fixes.length > 3) {
      console.log(`      ... and ${fixes.length - 3} more`);
    }
  });
}

console.log('\n📝 Next steps:');
console.log('  1. Review changes: git diff');
console.log('  2. Test your app: npx expo start -c');
console.log('  3. If issues, restore from .bak files');
console.log('\n✨ Navigation migration complete!');