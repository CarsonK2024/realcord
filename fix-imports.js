const fs = require('fs');
const path = require('path');

// Files to fix with their unused imports
const filesToFix = {
  'src/components/CreateServerModal.tsx': {
    remove: ['Hash', 'Mic']
  },
  'src/components/DebugPanel.tsx': {
    remove: ['MessageSquare']
  },
  'src/components/ErrorBoundary.tsx': {
    remove: ['React']
  },
  'src/components/NotificationBell.tsx': {
    remove: ['UserPlus']
  },
  'src/components/Sidebar.tsx': {
    remove: ['Hash', 'Users', 'Mic', 'MicOff', 'Volume2']
  }
};

// Fix each file
Object.entries(filesToFix).forEach(([filePath, config]) => {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    config.remove.forEach(importName => {
      // Remove from lucide-react imports
      const lucideImportRegex = new RegExp(`import\\s*{[^}]*\\b${importName}\\b[^}]*}\\s*from\\s*['"]lucide-react['"]`, 'g');
      content = content.replace(lucideImportRegex, (match) => {
        const newImports = match.replace(new RegExp(`\\s*,\\s*${importName}\\s*`), '').replace(new RegExp(`\\b${importName}\\s*,?\\s*`), '');
        return newImports.replace(/,\s*,/g, ',').replace(/{\s*,/, '{').replace(/,\s*}/, '}');
      });
      
      // Remove React import if it's the only one
      if (importName === 'React') {
        content = content.replace(/import\s+React\s*,\s*{([^}]+)}\s*from\s*['"]react['"]/, 'import {$1} from \'react\'');
        content = content.replace(/import\s+React\s*from\s*['"]react['"]/, '');
      }
    });
    
    fs.writeFileSync(fullPath, content);
    console.log(`Fixed ${filePath}`);
  }
});

console.log('Import fixes completed!'); 