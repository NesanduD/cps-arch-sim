import { CommandResult } from '../types/architecture';

// Helper to convert "Web Server" into "web_server" for the API
const normalizeType = (label: string) => label.toLowerCase().replace(/\s+/g, '_');

export function parseCommand(input: string): CommandResult {
  const text = input.trim();
  
  // 1. connect <source> to <target>
  const connectMatch = text.match(/^connect\s+(.+?)\s+to\s+(.+)$/i);
  if (connectMatch) {
    return { action: 'connect', source: connectMatch[1].trim(), target: connectMatch[2].trim() };
  }

  // 2. disconnect <source> from <target>
  const disconnectMatch = text.match(/^disconnect\s+(.+?)\s+from\s+(.+)$/i);
  if (disconnectMatch) {
    return { action: 'disconnect', source: disconnectMatch[1].trim(), target: disconnectMatch[2].trim() };
  }

  // 3. add <node>
  const addMatch = text.match(/^add\s+(.+)$/i);
  if (addMatch) {
    const label = addMatch[1].trim();
    return { action: 'add', label, normalizedType: normalizeType(label) };
  }

  // 4. remove <node>
  const removeMatch = text.match(/^remove\s+(.+)$/i);
  if (removeMatch) {
    return { action: 'remove', label: removeMatch[1].trim() };
  }

  return { action: 'unknown', message: 'Command not recognized. Try "add <node>" or "connect <A> to <B>".' };
}