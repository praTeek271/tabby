const fs = require('fs');
const path = require('path');

function replaceColors(content) {
  return content
    .replace(/bg-\[\#0B0E14\]/gi, 'bg-main')
    .replace(/bg-\[\#0D1017\]/gi, 'bg-panel')
    .replace(/bg-\[\#141824\]/gi, 'bg-panel') 
    .replace(/bg-zinc-900\/30/gi, 'bg-panel/50')
    .replace(/bg-zinc-800\/80/gi, 'bg-panel/80')
    .replace(/bg-zinc-800/gi, 'bg-border-color')
    .replace(/bg-zinc-700/gi, 'bg-border-color/80')
    
    .replace(/text-white/gi, 'text-primary')
    .replace(/text-gray-300/gi, 'text-primary/90')
    .replace(/text-gray-400/gi, 'text-muted')
    .replace(/text-gray-500/gi, 'text-muted')
    .replace(/text-zinc-200/gi, 'text-primary')
    .replace(/text-zinc-400/gi, 'text-muted')
    
    .replace(/border-gray-800\/50/gi, 'border-border-color/50')
    .replace(/border-gray-800/gi, 'border-border-color')
    .replace(/border-gray-700/gi, 'border-border-color')
    .replace(/border-zinc-800\/80/gi, 'border-border-color')
    .replace(/border-zinc-800/gi, 'border-border-color')
    .replace(/border-zinc-700/gi, 'border-border-color')
    
    .replace(/text-\[\#DFFF00\]/gi, 'text-accent')
    .replace(/bg-\[\#DFFF00\]\/20/gi, 'bg-accent-mute')
    .replace(/bg-\[\#DFFF00\]\/50/gi, 'bg-accent/50')
    .replace(/bg-\[\#DFFF00\]\/10/gi, 'bg-accent-mute')
    .replace(/bg-\[\#DFFF00\]\/5/gi, 'bg-accent-mute')
    .replace(/bg-\[\#DFFF00\]/gi, 'bg-accent')
    .replace(/border-\[\#DFFF00\]\/20/gi, 'border-accent/20')
    .replace(/border-\[\#DFFF00\]\/50/gi, 'border-accent/50')
    .replace(/border-\[\#DFFF00\]/gi, 'border-accent')
    
    .replace(/bg-white\/5/gi, 'bg-primary/5')
    .replace(/bg-white\/10/gi, 'bg-primary/10')
    .replace(/hover:bg-gray-800/gi, 'hover:bg-border-color')
    .replace(/bg-zinc-900/gi, 'bg-panel')
}

['/src/App.tsx', '/src/components/SimpleMarkdown.tsx', '/src/components/SettingsModal.tsx'].forEach(file => {
  if(fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, replaceColors(content));
      console.log(`Updated ${file}`);
  }
});
