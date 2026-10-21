// One line icon per tour chapter (24 x 24, stroked). Used by the build for the chapter
// index and headings, and by the presentation for its title slides.
export const CHAPTER_ICONS = {
  overview: 'M12 6.6C10 4.9 6.6 4.5 3.5 5.7v12.8c3.1-1.2 6.5-.8 8.5.9 2-1.7 5.4-2.1 8.5-.9V5.7c-3.1-1.2-6.5-.8-8.5.9Zm0 0v12.8',
  install: 'M12 3.5v10.5m-4.2-4.2L12 14l4.2-4.2M4.5 15v2.6a2.4 2.4 0 0 0 2.4 2.4h10.2a2.4 2.4 0 0 0 2.4-2.4V15',
  model: 'M8.2 6.5h7.6a1.7 1.7 0 0 1 1.7 1.7v7.6a1.7 1.7 0 0 1-1.7 1.7H8.2a1.7 1.7 0 0 1-1.7-1.7V8.2a1.7 1.7 0 0 1 1.7-1.7ZM10 10h4v4h-4zM9.5 3.5v3m5-3v3m-5 11v3m5-3v3M3.5 9.5h3m-3 5h3m11-5h3m-3 5h3',
  documents: 'M8.4 3.5h6.1l4 4v9.6a1.6 1.6 0 0 1-1.6 1.6H8.4a1.6 1.6 0 0 1-1.6-1.6V5.1a1.6 1.6 0 0 1 1.6-1.6Zm5.8 0v4.3h4.3M4.6 7.2v11.7a1.6 1.6 0 0 0 1.6 1.6h8.6',
  reading: 'M4 8.2V5.6A1.6 1.6 0 0 1 5.6 4h2.6m7.6 0h2.6A1.6 1.6 0 0 1 20 5.6v2.6m0 7.6v2.6a1.6 1.6 0 0 1-1.6 1.6h-2.6m-7.6 0H5.6A1.6 1.6 0 0 1 4 18.4v-2.6M8 9.5h8M8 12h8m-8 2.5h5',
  search: 'M10.6 17.2a6.6 6.6 0 1 0 0-13.2 6.6 6.6 0 0 0 0 13.2Zm4.7-1.9 4.4 4.4',
  asking: 'M20 11.6a8 8 0 0 1-11.7 7.1L4 20l1.3-4.1A8 8 0 1 1 20 11.6ZM8.8 10h6.4m-6.4 3.2h4',
  answers: 'M4.5 6.5h15m-15 4h15m-15 4h8.5M16 13.5h3.5a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H16a1 1 0 0 1-1-1v-3.5a1 1 0 0 1 1-1Z',
  privacy: 'M12 3.5 5 6.1v5.5c0 4.2 3 7.6 7 8.9 4-1.3 7-4.7 7-8.9V6.1l-7-2.6Zm-3 8.6 2.1 2.1 4.1-4.1',
  workspace: 'M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Zm3.5 0v15m0-10h11.5',
  architecture: 'M12 3.5 3.5 8l8.5 4.5L20.5 8 12 3.5Zm-8.5 8L12 16l8.5-4.5m-17 4L12 20l8.5-4.5',
  quality: 'M12 3.2l2.2 1.7 2.7-.2.9 2.6 2.3 1.5-.8 2.6.8 2.6-2.3 1.5-.9 2.6-2.7-.2L12 19.6l-2.2-1.7-2.7.2-.9-2.6L3.9 14l.8-2.6-.8-2.6 2.3-1.5.9-2.6 2.7.2L12 3.2Zm-2.9 8.5 2 2 3.9-3.9',
  config: 'M4 7h8.5m5 0H20M4 12h2.5m5 0H20M4 17h10.5m5 0h.5M15 5v4M9 10v4m8 1v4',
  license: 'M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v9.2M5.5 5v14A1.5 1.5 0 0 0 7 20.5h6.5M5.5 5A1.5 1.5 0 0 1 7 3.5M9 8h6.5M9 11.5h6.5M9 15h3.5m5.5 6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-1.6.4-.4 2.1 2-.9 2 .9-.4-2.1',
};

export const chapterIcon = (id, cls = 'icon') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="${CHAPTER_ICONS[id] || CHAPTER_ICONS.overview}"/></svg>`;

// Interface icons (same grid and stroke), used in templates as {{icon:name}}.
export const UI_ICONS = {
  server: 'M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 9V6A1.5 1.5 0 0 1 5 4.5Zm0 9h14a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-3A1.5 1.5 0 0 1 5 13.5ZM7 7.5h.01M7 16.5h.01M10 7.5h.01M10 16.5h.01',
  cloud: 'M7.4 18.5h9.9a3.7 3.7 0 0 0 .5-7.4 5.6 5.6 0 0 0-10.9-.9 4.2 4.2 0 0 0 .5 8.3Z',
  lock: 'M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5m-10 0h11a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5V12a1.5 1.5 0 0 1 1.5-1.5Zm5.5 4v2',
  history: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.2h3.2M12 8v4.2l2.8 1.8',
  plug: 'M9 3.5v4m6-4v4M7 7.5h10v3a5 5 0 0 1-10 0v-3Zm5 8v5',
  vectors: 'M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-.1-15.3 8.2 2.6M16.7 10.6l-7.4 7M6.3 7l1.3 10',
  star: 'M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 3.8Z',
  alert: 'M12 4.5 3.5 19h17L12 4.5Zm0 5.5v4m0 2.5h.01',
  fork: 'M7 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0v3a2.5 2.5 0 0 0 2.5 2.5h5A2.5 2.5 0 0 0 17 9.5v-3m0 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 12v5.5m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
};

export const uiIcon = (name, cls = 'icon') => {
  const d = UI_ICONS[name] || CHAPTER_ICONS[name];
  if (!d) throw new Error(`unknown icon "${name}"`);
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="${d}"/></svg>`;
};
