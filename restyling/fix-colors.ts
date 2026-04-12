import fs from 'fs';
const files = ['src/components/Dashboard.tsx', 'src/components/Sidebar.tsx'];
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/dark:text-\[#888\]/g, 'dark:text-[#A0A0A0]');
  fs.writeFileSync(file, content);
});
console.log('Done');
