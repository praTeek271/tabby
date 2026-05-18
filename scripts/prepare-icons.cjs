const fs = require('fs');
const path = require('path');

const iconDir = path.join(process.cwd(), 'icon');
const targetDir = path.join(process.cwd(), 'build');
const publicDir = path.join(process.cwd(), 'public');

const iconIcoPath = path.join(iconDir, 'icon.ico');
const iconPngPath = path.join(iconDir, 'icon.png');
const targetIco = path.join(targetDir, 'icon.ico');
const targetPng = path.join(publicDir, 'icon.png');

if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir);
  console.log('Created "icon" folder. Please place your icon.ico and icon.png files there.');
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir);
}
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

if (fs.existsSync(iconIcoPath)) {
  fs.copyFileSync(iconIcoPath, targetIco);
  console.log('icon.ico prepared for build successfully.');
} else {
  console.warn('Warning: icon/icon.ico not found.');
}

if (fs.existsSync(iconPngPath)) {
  fs.copyFileSync(iconPngPath, targetPng);
  console.log('icon.png prepared for public assets successfully.');
} else {
  console.warn('Warning: icon/icon.png not found. App icon might not be displayed in settings.');
}
