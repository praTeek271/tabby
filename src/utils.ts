export const COLORS = {
  bg: '#0B0E14',
  text: '#9CA3AF',
  textDim: '#4B5563',
  accent: '#DFFF00', 
  sidebarBorder: '#1F2937',
  tagColors: ['#DFFF00', '#3B82F6', '#EF4444', '#10B981', '#F59E0B']
};

export const getNotePreview = (content: string) => {
  if (!content) return { title: "Untitled", snippet: "" };
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return { title: "Untitled", snippet: "" };
  
  // Strip markdown formatting for the title
  const title = lines[0].replace(/^#+\s*/, '').replace(/[*_`]/g, '');
  const snippet = lines.length > 1 ? lines.slice(1).join(' ').substring(0, 120) : "";
  
  return { title, snippet };
};
