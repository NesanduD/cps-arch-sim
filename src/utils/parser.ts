import type { CommandResult } from '../types/architecture';

// Helper to convert "Web Server" into "web_server" for the API
const normalizeType = (label: string) => label.toLowerCase().replace(/\s+/g, '_');

// Main function to parse user commands into structured actions
export function parseCommand(input: string): CommandResult {
  const text = input.trim();
  
  // 1. connect | link | join <source> to | with <target>
  const connectMatch = text.match(/^(?:connect|link|join)\s+(.+?)\s+(?:to|with)\s+(.+)$/i);
  if (connectMatch) {
    return { action: 'connect', source: connectMatch[1].trim(), target: connectMatch[2].trim() };
  }

  // 2. disconnect | unlink | remove edge <source> from | and <target>
  const disconnectMatch = text.match(/^(?:disconnect|unlink|remove edge(?: between)?)\s+(.+?)\s+(?:from|and)\s+(.+)$/i);
  if (disconnectMatch) {
    return { action: 'disconnect', source: disconnectMatch[1].trim(), target: disconnectMatch[2].trim() };
  }

  // 3. add | create | new <node>
  const addMatch = text.match(/^(?:add|create|new)\s+(.+)$/i);
  if (addMatch) {
    const label = addMatch[1].trim();
    return { action: 'add', label, normalizedType: normalizeType(label) };
  }

  // 4. remove | delete | drop <node>
  const removeMatch = text.match(/^(?:remove|delete|drop)\s+(.+)$/i);
  if (removeMatch) {
    return { action: 'remove', label: removeMatch[1].trim() };
  }

  return { action: 'unknown', message: 'Command not recognized. Try "create Database" or "link A to B".' };
}