# Live Editable Tables — Build Program

## Spec

Render markdown pipe tables as actual HTML `<table>` elements in live editing mode. Users type directly into table cells — never see pipes or dashes.

**Core behavior:**
1. Table node in Lezer tree → `Decoration.replace({block: true})` with a `LiveTableWidget`
2. Widget renders `<table>` with `contenteditable` cells
3. User clicks a cell → types directly
4. On cell blur → serialize table back to markdown pipes → dispatch CM6 transaction
5. Tab key moves between cells
6. Header row styled differently from body rows

**Acceptance criteria:**
- Markdown table renders as styled HTML table
- User can click any cell and edit text
- Edits persist to the markdown document (pipes update)
- Tab moves to next cell, Shift+Tab to previous
- Enter in last row creates a new row
- Inline formatting in cells works (bold, italic, code)
- Table stays rendered while editing (no flash to raw markdown)
- `ignoreEvent()` returns true so CM6 doesn't interfere
- Works in both dark and light themes

## Steps

1. Create `LiveTableWidget extends WidgetType` — parses markdown table, renders HTML `<table>`
2. Add contenteditable on `<td>` and `<th>` cells
3. On cell blur → serialize back to markdown → dispatch transaction
4. Tab/Shift+Tab navigation between cells
5. Wire into liveEditing.ts — detect Table nodes, replace with widget
6. CSS styling (borders, padding, header background, theme-aware)
7. Test with demo app — verify editing round-trip
8. Test with trip.md tables in blurb-desktop

## Key Technical Decisions

- Widget owns the editing — CM6 cursor never enters the table range
- `ignoreEvent() → true` — all mouse/keyboard events handled by the widget
- Serialize on blur, not on every keystroke (avoids decoration rebuild churn)
- Use `view.dispatch()` to update the document — widget needs access to EditorView
- `eq()` compares table text hash — prevents re-render when other parts of doc change

## Scope
- Modify: `src/editor/live/liveEditing.ts`, `src/styles/engei.css`
- Create: `src/editor/live/LiveTableWidget.ts`
- Don't touch: LiveWidgetType.ts, preview mode, source mode
