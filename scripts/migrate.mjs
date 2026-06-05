import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

const moves = [
  // Auth
  { src: 'components/auth-button.tsx', dest: 'features/auth/components/auth-button.tsx', oldImport: '@/components/auth-button', newImport: '@/features/auth/components/auth-button' },
  { src: 'components/auth-shell.tsx', dest: 'features/auth/components/auth-shell.tsx', oldImport: '@/components/auth-shell', newImport: '@/features/auth/components/auth-shell' },
  { src: 'components/logout-button.tsx', dest: 'features/auth/components/logout-button.tsx', oldImport: '@/components/logout-button', newImport: '@/features/auth/components/logout-button' },
  { src: 'components/oauth-provider-buttons.tsx', dest: 'features/auth/components/oauth-provider-buttons.tsx', oldImport: '@/components/oauth-provider-buttons', newImport: '@/features/auth/components/oauth-provider-buttons' },
  { src: 'components/oauth-provider-icon.tsx', dest: 'features/auth/components/oauth-provider-icon.tsx', oldImport: '@/components/oauth-provider-icon', newImport: '@/features/auth/components/oauth-provider-icon' },
  { src: 'components/reset-password-form.tsx', dest: 'features/auth/components/reset-password-form.tsx', oldImport: '@/components/reset-password-form', newImport: '@/features/auth/components/reset-password-form' },
  { src: 'components/sign-in-form.tsx', dest: 'features/auth/components/sign-in-form.tsx', oldImport: '@/components/sign-in-form', newImport: '@/features/auth/components/sign-in-form' },
  { src: 'components/sign-up-form.tsx', dest: 'features/auth/components/sign-up-form.tsx', oldImport: '@/components/sign-up-form', newImport: '@/features/auth/components/sign-up-form' },

  // Todos
  { src: 'components/add-todo-form.tsx', dest: 'features/todos/components/add-todo-form.tsx', oldImport: '@/components/add-todo-form', newImport: '@/features/todos/components/add-todo-form' },
  { src: 'components/todo-item.tsx', dest: 'features/todos/components/todo-item.tsx', oldImport: '@/components/todo-item', newImport: '@/features/todos/components/todo-item' },
  { src: 'components/todos-display.tsx', dest: 'features/todos/components/todos-display.tsx', oldImport: '@/components/todos-display', newImport: '@/features/todos/components/todos-display' },

  // Layout / Generic
  { src: 'components/hero.tsx', dest: 'core/components/layout/hero.tsx', oldImport: '@/components/hero', newImport: '@/core/components/layout/hero' },
  { src: 'components/next-logo.tsx', dest: 'core/components/layout/next-logo.tsx', oldImport: '@/components/next-logo', newImport: '@/core/components/layout/next-logo' },
  { src: 'components/site-shell.tsx', dest: 'core/components/layout/site-shell.tsx', oldImport: '@/components/site-shell', newImport: '@/core/components/layout/site-shell' },
  { src: 'components/theme-switcher.tsx', dest: 'core/components/layout/theme-switcher.tsx', oldImport: '@/components/theme-switcher', newImport: '@/core/components/layout/theme-switcher' },
  { src: 'components/env-var-warning.tsx', dest: 'core/components/layout/env-var-warning.tsx', oldImport: '@/components/env-var-warning', newImport: '@/core/components/layout/env-var-warning' },
  { src: 'components/refresh-button.tsx', dest: 'core/components/layout/refresh-button.tsx', oldImport: '@/components/refresh-button', newImport: '@/core/components/layout/refresh-button' },

  // Tutorial
  { src: 'components/tutorial', dest: 'features/tutorial', oldImport: '@/components/tutorial', newImport: '@/features/tutorial', isDir: true },

  // Lib
  { src: 'lib/utils.ts', dest: 'core/utils/utils.ts', oldImport: '@/lib/utils', newImport: '@/core/utils/utils' },
  { src: 'lib/store', dest: 'core/store', oldImport: '@/lib/store', newImport: '@/core/store', isDir: true }
];

// Helper to recursively get files
function getFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath));
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

// 2. Replace imports
const allFiles = getFiles(srcDir);

allFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  moves.forEach(m => {
    // Basic string replacement for import paths
    const regex1 = new RegExp(`['"]${m.oldImport}['"]`, 'g');
    const regex2 = new RegExp(`['"]${m.oldImport}/([^'"]+)['"]`, 'g');
    
    if (regex1.test(content)) {
      content = content.replace(regex1, `"${m.newImport}"`);
      changed = true;
    }
    if (regex2.test(content)) {
      content = content.replace(regex2, `"${m.newImport}/$1"`);
      changed = true;
    }
  });
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated imports in ${file.replace(srcDir, '')}`);
  }
});

// Clean up empty dirs
function cleanEmptyDirs(dir) {
  if (fs.existsSync(dir)) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        cleanEmptyDirs(fullPath);
      }
    });
    if (fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
      console.log(`Removed empty dir ${dir}`);
    }
  }
}

cleanEmptyDirs(path.join(srcDir, 'components'));
cleanEmptyDirs(path.join(srcDir, 'lib'));
