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

// Check and copy .ico
if (fs.existsSync(iconIcoPath)) {
  fs.copyFileSync(iconIcoPath, targetIco);            // build/icon.ico
  fs.copyFileSync(iconIcoPath, path.join(publicDir, 'icon.ico')); // public/icon.ico
  console.log('icon.ico prepared for build successfully.');
} else {
  console.warn('Warning: icon/icon.ico not found.');
}

// Check and copy .png
if (fs.existsSync(iconPngPath)) {
  fs.copyFileSync(iconPngPath, targetPng);            // public/icon.png
  fs.copyFileSync(iconPngPath, path.join(targetDir, 'icon.png')); // build/icon.png
  console.log('icon.png prepared for public assets and build successfully.');
} else {
  console.warn('Warning: icon/icon.png not found. App icon might not be displayed in settings.');
}

// Check and copy .icns
const iconIcnsPath = path.join(iconDir, 'icon.icns');
const targetIcns = path.join(targetDir, 'icon.icns');
if (fs.existsSync(iconIcnsPath)) {
  fs.copyFileSync(iconIcnsPath, targetIcns);           // build/icon.icns
  fs.copyFileSync(iconIcnsPath, path.join(publicDir, 'icon.icns')); // public/icon.icns
  console.log('icon.icns prepared for build successfully.');
} else {
  console.warn('Warning: icon/icon.icns not found.');
}
