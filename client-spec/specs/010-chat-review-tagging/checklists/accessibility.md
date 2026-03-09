# Accessibility Review: Chat Review Tagging Components

**Feature Branch**: `010-chat-review-tagging`
**Date**: 2026-02-10
**Standard**: WCAG 2.1 Level AA
**Purpose**: Verify accessibility requirements for all new tag-related UI components.

## Component Inventory

| Component | Location | Role | Keyboard Users | Screen Readers |
|-----------|----------|------|----------------|----------------|
| TagBadge | `review/components/TagBadge.tsx` | Display | Optional remove | Tag name + category |
| TagFilter | `review/components/TagFilter.tsx` | Interactive | Multi-select | Filter description |
| TagInput | `review/components/TagInput.tsx` | Interactive | Combobox | Autocomplete |
| ExcludedTab | `review/components/ExcludedTab.tsx` | Display | Tab navigation | Exclusion info |
| TagManagementPage | `review/TagManagementPage.tsx` | Interactive | Full CRUD | Table + forms |
| UserTagPanel | `review/UserTagPanel.tsx` | Interactive | Assign/remove | Tag list |

---

## 1. TagBadge

### ARIA Requirements

- [ ] **Role**: Rendered as an inline element (e.g., `<span>`) with no interactive role when read-only
- [ ] **Label**: `aria-label` includes tag name and category — e.g., `aria-label="Tag: functional QA (user tag)"`
- [ ] **Remove button**: When removable, the "x" button has `aria-label="Remove tag: {tagName}"` (not just "x" or "close")
- [ ] **Remove button role**: Remove button uses `<button>` element or `role="button"` with `tabindex="0"`

### Visual

- [ ] **Contrast ratio**: Tag text against badge background meets 4.5:1 minimum contrast ratio (WCAG 1.4.3)
- [ ] **Color coding**: Category color coding (user vs chat) is not the sole differentiator — include text label or icon (WCAG 1.4.1)
- [ ] **Focus indicator**: Remove button has a visible focus ring (WCAG 2.4.7)
- [ ] **Text size**: Tag text is at least 12px / 0.75rem and scales with user font preferences

### Keyboard

- [ ] **Tab order**: Remove button is reachable via Tab key
- [ ] **Activation**: Remove button responds to Enter and Space keys
- [ ] **Focus trap**: Removing a tag moves focus to the next tag or the add-tag input (not lost)

---

## 2. TagFilter

### ARIA Requirements

- [ ] **Label**: Filter control has `aria-label="Filter by tags"` or associated `<label>` element
- [ ] **Role**: Uses `role="listbox"` with `aria-multiselectable="true"` for the dropdown, or equivalent multi-select pattern
- [ ] **Options**: Each tag option uses `role="option"` with `aria-selected` state
- [ ] **Expanded state**: Dropdown trigger has `aria-expanded` reflecting open/closed state
- [ ] **Controls relationship**: Trigger button has `aria-controls` pointing to the dropdown ID
- [ ] **Session count**: Tag session counts are included in accessible name — e.g., `"short (12 sessions)"`

### Keyboard

- [ ] **Open/close**: Dropdown opens with Enter/Space, closes with Escape
- [ ] **Navigation**: Arrow Up/Down navigates between options
- [ ] **Selection**: Space toggles option selection (multi-select)
- [ ] **Type-ahead**: Typing characters filters/jumps to matching tag names
- [ ] **Tab behavior**: Tab closes the dropdown and moves focus to next control

### Live Regions

- [ ] **Filter results**: Applying a tag filter announces result count change via `aria-live="polite"` — e.g., "Showing 5 sessions filtered by tag: short"

---

## 3. TagInput (Combobox)

### ARIA Requirements

- [ ] **Role**: Input has `role="combobox"` with `aria-autocomplete="list"`
- [ ] **Expanded state**: `aria-expanded` reflects whether suggestion list is shown
- [ ] **Active descendant**: `aria-activedescendant` tracks the currently highlighted suggestion
- [ ] **Controls**: `aria-controls` points to the suggestion listbox ID
- [ ] **Label**: Input has `aria-label="Add tag"` or associated `<label>`
- [ ] **Listbox role**: Suggestion list uses `role="listbox"`
- [ ] **Option roles**: Each suggestion uses `role="option"` with unique `id`
- [ ] **Create option**: "Create new tag" option is clearly distinguishable — e.g., `aria-label="Create new tag: {typedText}"`

### Keyboard

- [ ] **Open suggestions**: Typing opens the suggestion list
- [ ] **Navigate**: Arrow Down moves into suggestion list; Arrow Up/Down navigates
- [ ] **Select**: Enter selects the active suggestion (or creates ad-hoc tag)
- [ ] **Close**: Escape closes suggestion list without selecting
- [ ] **Clear**: Backspace in empty input does not unexpectedly delete tags
- [ ] **Home/End**: Home/End keys move within input text, not suggestion list

### Screen Reader

- [ ] **Instructions**: Combobox provides hint text — e.g., "Type to search tags or create a new one"
- [ ] **Match count**: Number of matching suggestions announced — e.g., "3 suggestions available"
- [ ] **Selection feedback**: After selecting a tag, announcement confirms — e.g., "Tag 'escalated' added to session"

---

## 4. ExcludedTab

### ARIA Requirements

- [ ] **Tab role**: "Excluded" tab uses `role="tab"` within a `role="tablist"` container
- [ ] **Selected state**: `aria-selected="true"` when active
- [ ] **Tab panel**: Content area has `role="tabpanel"` with `aria-labelledby` pointing to the tab
- [ ] **Exclusion reasons**: Each exclusion reason badge has descriptive `aria-label` — e.g., `"Excluded: short (auto-tagged by system)"`

### Keyboard

- [ ] **Tab switching**: Arrow Left/Right navigates between tabs (Pending, Flagged, In Progress, Completed, Excluded)
- [ ] **Tab activation**: Enter/Space activates the focused tab
- [ ] **Focus management**: Activating the Excluded tab moves focus into the tab panel content

### Data Table

- [ ] **Table semantics**: Excluded sessions list uses `<table>` with `<th>` headers or equivalent ARIA grid
- [ ] **Row descriptions**: Each row provides session ID, exclusion reason, and timestamp in accessible text
- [ ] **Empty state**: When no excluded sessions exist, a descriptive message is announced (not just visual)
- [ ] **Pagination**: Pagination controls are keyboard-accessible with `aria-label` descriptions

---

## 5. TagManagementPage

### ARIA Requirements

- [ ] **Page heading**: `<h1>` or `role="heading"` with descriptive title (e.g., "Tag Management")
- [ ] **Table**: Tag list uses `<table>` with `<thead>` / `<th>` for column headers (Name, Category, Description, Exclude, Active, Actions)
- [ ] **Table caption**: Table has `<caption>` or `aria-label` describing its purpose
- [ ] **Sortable columns**: If columns are sortable, headers have `aria-sort` attribute

### Create Form

- [ ] **Form labeling**: All form inputs have associated `<label>` elements
- [ ] **Required fields**: Required fields marked with `aria-required="true"` and visual indicator
- [ ] **Error messages**: Validation errors use `aria-describedby` linking to error message elements
- [ ] **Duplicate error**: Case-insensitive duplicate name error is announced — `aria-live="assertive"`
- [ ] **Category selector**: Category select uses native `<select>` or ARIA `role="combobox"`
- [ ] **Exclude checkbox**: "Exclude from reviews" checkbox has descriptive label including consequences

### Edit/Delete Actions

- [ ] **Edit button**: Each row's edit button has `aria-label="Edit tag: {tagName}"`
- [ ] **Delete button**: Each row's delete button has `aria-label="Delete tag: {tagName}"`
- [ ] **Confirmation dialog**: Delete confirmation uses `role="alertdialog"` with `aria-describedby` pointing to the affected counts message
- [ ] **Dialog focus**: Confirmation dialog traps focus and returns focus to the triggering button on close
- [ ] **Dialog close**: Escape key closes the confirmation dialog

### Keyboard

- [ ] **Tab order**: Logical tab order through table rows, edit/delete buttons, and create form
- [ ] **Inline edit**: If inline editing is supported, Enter activates edit mode, Escape cancels, Enter confirms
- [ ] **Bulk operations**: If any bulk operations exist, they are keyboard-accessible

---

## 6. UserTagPanel

### ARIA Requirements

- [ ] **Section label**: Panel has `aria-label="User tags"` or heading element
- [ ] **Tag list**: Current tags displayed as a list — `role="list"` with `role="listitem"` for each tag
- [ ] **Dropdown**: Tag assignment dropdown follows combobox or listbox pattern with proper ARIA
- [ ] **Assign button**: Has `aria-label="Assign tag to user"` or similar descriptive label

### Keyboard

- [ ] **Dropdown navigation**: Arrow keys navigate tag options in the assignment dropdown
- [ ] **Assignment**: Enter/Space assigns the selected tag
- [ ] **Removal**: Each tag's remove button is Tab-reachable and responds to Enter/Space
- [ ] **Focus after action**: After assigning or removing a tag, focus is placed on a logical target (not lost)

---

## Cross-Cutting Concerns

### Color & Contrast

- [ ] **Badge colors**: All tag badge color variants (user category, chat category, system tags) meet 4.5:1 contrast ratio
- [ ] **Hover states**: Hover/focus color changes maintain contrast requirements
- [ ] **Dark mode**: If dark mode is supported, all contrast ratios remain compliant in both themes
- [ ] **Non-color indicators**: Tags are distinguishable without relying solely on color — include text labels, icons, or patterns

### Focus Management

- [ ] **Focus visible**: All interactive elements have visible focus indicators (WCAG 2.4.7)
- [ ] **Focus order**: Tab order follows visual reading order (WCAG 2.4.3)
- [ ] **No focus trap**: Users can Tab out of all components (except modal dialogs)
- [ ] **Focus restoration**: After closing dialogs or removing elements, focus returns to a logical position

### Screen Reader Testing

- [ ] **VoiceOver (macOS)**: All components tested with VoiceOver
- [ ] **NVDA (Windows)**: All components tested with NVDA
- [ ] **Announcements**: Dynamic content changes (tag added/removed, filter applied) are announced via live regions

### Motion & Timing

- [ ] **Animations**: Tag badge animations (appear/disappear) respect `prefers-reduced-motion`
- [ ] **No timeouts**: No timed interactions for tag operations (users have unlimited time)
