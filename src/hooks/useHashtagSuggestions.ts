import * as React from "react";

export interface HashtagSuggestion {
  type: "specialty" | "item";
  label: string;       // display text
  insertText: string;  // text to insert (e.g. "Cardiologie" or "CARDIO-001")
}

interface UseHashtagSuggestionsOptions {
  specialties: Array<{ id: string; name: string }>;
  items: Array<{ id: number; code: string; title: string }>;
}

interface UseHashtagSuggestionsReturn {
  hashtagQuery: string | null;
  suggestions: HashtagSuggestion[];
  insertSuggestion: (
    currentValue: string,
    cursorPos: number,
    suggestion: HashtagSuggestion
  ) => { newValue: string; newCursorPos: number };
}

const MAX_SUGGESTIONS = 6;

/** Detects if the user is typing a #hashtag and returns matching suggestions. */
export function useHashtagSuggestions(
  inputValue: string,
  cursorPos: number,
  { specialties, items }: UseHashtagSuggestionsOptions
): UseHashtagSuggestionsReturn {
  const hashtagQuery = React.useMemo(() => {
    const textUpToCursor = inputValue.slice(0, cursorPos);
    const match = textUpToCursor.match(/#([\wÀ-ÿ]*)$/);
    return match ? match[1] : null;
  }, [inputValue, cursorPos]);

  const suggestions = React.useMemo<HashtagSuggestion[]>(() => {
    if (hashtagQuery === null) return [];
    const q = hashtagQuery.toLowerCase();

    const specSuggestions: HashtagSuggestion[] = specialties
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((s) => ({
        type: "specialty",
        label: s.name,
        insertText: s.name,
      }));

    const itemSuggestions: HashtagSuggestion[] = items
      .filter(
        (item) =>
          item.code.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q)
      )
      .slice(0, MAX_SUGGESTIONS - specSuggestions.length)
      .map((item) => ({
        type: "item",
        label: `${item.code} — ${item.title}`,
        insertText: item.code,
      }));

    return [...specSuggestions, ...itemSuggestions];
  }, [hashtagQuery, specialties, items]);

  const insertSuggestion = React.useCallback(
    (
      currentValue: string,
      cursorPos: number,
      suggestion: HashtagSuggestion
    ): { newValue: string; newCursorPos: number } => {
      const textUpToCursor = currentValue.slice(0, cursorPos);
      const match = textUpToCursor.match(/#([\wÀ-ÿ]*)$/);
      if (!match) return { newValue: currentValue, newCursorPos: cursorPos };

      const start = cursorPos - match[0].length;
      const inserted = `#${suggestion.insertText}`;
      const newValue =
        currentValue.slice(0, start) + inserted + currentValue.slice(cursorPos);
      const newCursorPos = start + inserted.length;
      return { newValue, newCursorPos };
    },
    []
  );

  return { hashtagQuery, suggestions, insertSuggestion };
}
