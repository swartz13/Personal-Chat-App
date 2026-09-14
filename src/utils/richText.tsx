import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

/**
 * WhatsApp style text formatting.
 *
 * Supported markers (can be used single or double):
 *   *bold*   **bold**
 *   _italic_  __italic__
 *   ~strikethrough~   ~~strikethrough~~
 *   `code`     ```code```
 *
 * Can be nested: *_bold italic_*
 */

interface Format {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

/** Marker mappings. Longer ones should be tried first. */
const MARKERS: Array<{ marker: string; field: keyof Format }> = [
  { marker: '```', field: 'code' },
  { marker: '**', field: 'bold' },
  { marker: '__', field: 'italic' },
  { marker: '~~', field: 'strikethrough' },
  { marker: '*', field: 'bold' },
  { marker: '_', field: 'italic' },
  { marker: '~', field: 'strikethrough' },
  { marker: '`', field: 'code' },
];

interface Chunk {
  text: string;
  format: Format;
}

/**
 * Parses text into formatted chunks.
 * Unclosed markers are left as is.
 */
export function parseRichText(text: string): Chunk[] {
  const chunks: Chunk[] = [];

  function process(input: string, format: Format) {
    let position = 0;

    while (position < input.length) {
      let match: { start: number; marker: string; field: keyof Format } | null = null;

      for (let i = position; i < input.length; i++) {
        const found = MARKERS.find((m) => input.startsWith(m.marker, i));
        if (found) {
          match = { start: i, marker: found.marker, field: found.field };
          break;
        }
      }

      if (!match) {
        if (position < input.length) chunks.push({ text: input.slice(position), format });
        return;
      }

      const closeIndex = input.indexOf(match.marker, match.start + match.marker.length);

      // If no close or if empty inside, treat marker as plain text.
      if (closeIndex === -1 || closeIndex === match.start + match.marker.length) {
        chunks.push({
          text: input.slice(position, match.start + match.marker.length),
          format,
        });
        position = match.start + match.marker.length;
        continue;
      }

      if (match.start > position) {
        chunks.push({ text: input.slice(position, match.start), format });
      }

      // Inner part is processed again with same rules (for nested formats).
      process(input.slice(match.start + match.marker.length, closeIndex), {
        ...format,
        [match.field]: true,
      });

      position = closeIndex + match.marker.length;
    }
  }

  process(text, {});
  return chunks;
}

/** Does the text have formatting markers? */
export function hasFormatting(text: string) {
  return /[*_~`]/.test(text);
}

/** Renders formatted text. */
export function RichText({ text, style }: { text: string; style?: TextStyle | TextStyle[] }) {
  if (!hasFormatting(text)) return <Text style={style}>{text}</Text>;

  return (
    <Text style={style}>
      {parseRichText(text).map((chunk, i) => (
        <Text
          key={i}
          style={[
            chunk.format.bold && styles.bold,
            chunk.format.italic && styles.italic,
            chunk.format.strikethrough && styles.strikethrough,
            chunk.format.code && styles.code,
          ]}
        >
          {chunk.text}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  strikethrough: { textDecorationLine: 'line-through' },
  code: { fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.07)' },
});
