# UX Skills — Laws of UX for AI Agents

> Source: [Laws of UX](https://lawsofux.com) by Jon Yablonski
> Purpose: Reference for AI agents building UI/UX in the myVoice codebase. Apply these principles when designing components, layouts, interactions, and user flows.

---

## How to Use This File

When building or modifying UI, scan the relevant sections below and apply the principles that match your task:
- **Building forms or wizards?** → Hick's Law, Miller's Law, Chunking, Goal-Gradient Effect
- **Designing navigation?** → Serial Position Effect, Law of Proximity, Jakob's Law
- **Handling loading states?** → Doherty Threshold, Peak-End Rule
- **Styling components?** → Aesthetic-Usability Effect, Von Restorff Effect, Law of Prägnanz
- **Accepting user input?** → Postel's Law, Tesler's Law
- **Onboarding new users?** → Paradox of the Active User, Hick's Law, Goal-Gradient Effect

---

## 1. Aesthetic-Usability Effect

**Definition:** Users perceive aesthetically pleasing design as more usable.

**Apply when:** Styling any component, choosing color palettes, spacing, typography.

- Beautiful interfaces increase user tolerance for minor issues
- But don't let good looks mask real usability problems — always test
- Invest in consistent visual polish: spacing, alignment, color harmony
- A polished UI builds trust before the user interacts with functionality

**myVoice application:** Our dark theme with accent colors, rounded cards, and consistent spacing follows this. Maintain visual consistency across all new pages.

---

## 2. Choice Overload

**Definition:** People get overwhelmed when presented with too many options.

**Apply when:** Designing menus, settings pages, filter panels, dropdowns.

- Limit visible choices; use progressive disclosure for advanced options
- Group related options under categories
- Provide smart defaults so users can proceed without choosing
- When choices exceed 5-7, consider a search/filter mechanism instead

---

## 3. Chunking

**Definition:** Break information into small, meaningful groups.

**Apply when:** Displaying data tables, long forms, statistics, lists.

- Group related form fields under section headers
- Break phone numbers, credit cards, and IDs into visual segments
- Use whitespace and dividers to separate logical groups
- Stats dashboards should cluster related metrics (e.g., revenue cards grouped together)

**myVoice application:** Admin finance page groups revenue/payout/net as 3 summary cards before the transaction table. Follow this pattern.

---

## 4. Cognitive Load

**Definition:** The mental effort required to understand and interact with an interface.

**Apply when:** Every UI decision.

- Minimize what users must remember — show, don't make them recall
- Remove decorative elements that don't aid comprehension
- Use progressive disclosure: show basics first, details on demand
- Avoid jargon; use plain language in labels and messages

---

## 5. Doherty Threshold

**Definition:** Productivity soars when interactions complete within 400ms.

**Apply when:** Loading states, API calls, form submissions, navigation.

- Target <400ms response for all interactions
- If a task takes longer, show immediate visual feedback (spinners, skeleton screens, progress bars)
- Use optimistic updates — show the result before the server confirms
- Animations during loading mask perceived wait time
- Progress bars make long waits tolerable even if imprecise

**myVoice application:** SpacetimeDB real-time updates provide instant feedback. For API calls (search, Stripe), show loading spinners immediately on click.

---

## 6. Fitts's Law

**Definition:** Time to reach a target depends on its distance and size.

**Apply when:** Placing buttons, designing touch targets, laying out CTAs.

- Make primary action buttons large and easy to reach
- Place frequently used actions near the user's current focus
- Touch targets should be minimum 44x44px (mobile) or 32x32px (desktop)
- Destructive actions should be small and distant from primary actions
- Group related actions close together

**myVoice application:** "Follow Topic" button is full-width in the sidebar for easy reach. "Start Contest" is full-width in the admin card. Follow this pattern.

---

## 7. Flow State

**Definition:** The mental state of full immersion in an activity.

**Apply when:** Designing core experiences (canvas interaction, video browsing).

- Minimize interruptions and modal dialogs during core tasks
- Provide clear, immediate feedback for every action
- Match challenge to skill level — don't overwhelm beginners or bore experts
- Avoid unnecessary confirmations that break rhythm

---

## 8. Goal-Gradient Effect

**Definition:** People accelerate effort as they approach a goal.

**Apply when:** Multi-step forms, onboarding, progress tracking.

- Show progress bars in multi-step flows (step 2 of 4)
- Give users a "head start" — pre-fill what you can, mark first step complete
- Highlight proximity to completion ("Just 1 more step!")
- Break long tasks into visible milestones
- Loyalty/credit systems should emphasize remaining distance, not total

**myVoice application:** Contest leaderboard positions, credit balances, and the spiral position (distance from center) all leverage this.

---

## 9. Hick's Law

**Definition:** Decision time increases with the number and complexity of choices.

**Apply when:** Navigation, dropdown menus, settings, onboarding.

- Reduce choices when speed matters
- Break complex tasks into smaller sequential steps
- Highlight recommended options to speed decisions
- Use progressive onboarding — don't show all features at once
- Don't oversimplify to the point of confusion

**myVoice application:** Topic creation is one form, not a wizard. Search has one input. Admin nav has 7 items — at the limit. Don't add more without grouping.

---

## 10. Jakob's Law

**Definition:** Users expect your site to work like other sites they know.

**Apply when:** Every design decision. This is the most important law for consistency.

- Use standard UI patterns: hamburger menus, search bars in headers, settings gear icons
- Forms should use standard controls: text inputs, dropdowns, checkboxes
- Navigation should follow conventions: logo top-left links home, primary nav horizontal
- Don't reinvent patterns unless you have a compelling reason
- When redesigning, allow gradual transition from old to new

**myVoice application:** Our header follows standard patterns (logo left, actions right). Admin layout uses standard sidebar nav. Keep this.

---

## 11. Law of Common Region

**Definition:** Elements sharing a visual boundary are perceived as a group.

**Apply when:** Card layouts, sections, form groups.

- Use cards, borders, and background colors to group related content
- Each card should contain one cohesive unit of information
- Don't put unrelated items in the same container
- Subtle borders and background shifts are enough — don't overdo it

**myVoice application:** We use `Card` components with `bg-surface` consistently. Each admin section is a card. Each notification is a visual group.

---

## 12. Law of Proximity

**Definition:** Nearby elements are perceived as related.

**Apply when:** Spacing between elements, form layouts, button groups.

- Related items should be closer together than unrelated items
- Use more spacing between groups than within groups
- Labels should be closer to their input than to adjacent inputs
- Action buttons should cluster by function (e.g., "Save" and "Cancel" together, "Delete" separate)

---

## 13. Law of Prägnanz (Simplicity)

**Definition:** People interpret ambiguous images in the simplest way possible.

**Apply when:** Icon design, layout structure, data visualization.

- Use simple shapes and clear visual hierarchy
- Reduce visual noise — every element should earn its place
- Align elements to a grid for visual order
- When in doubt, simplify

---

## 14. Law of Similarity

**Definition:** Similar-looking elements are perceived as a group.

**Apply when:** Consistent styling of repeated elements.

- All buttons of the same type should look identical across the app
- Cards representing the same kind of data should share visual treatment
- Use consistent colors for consistent meanings (green=success, red=destructive)
- Status badges should use the same color coding everywhere

**myVoice application:** We use `Badge` with consistent colors: green for success/connected, yellow for pending, red for destructive. Keep this.

---

## 15. Law of Uniform Connectedness

**Definition:** Visually connected elements are perceived as more related.

**Apply when:** Connecting labels to values, steps in a flow, breadcrumbs.

- Use lines, arrows, or shared backgrounds to show relationships
- Breadcrumbs use "/" or ">" to connect path segments
- Timeline/progress steps should have connecting lines
- Form field labels should visually connect to their inputs

---

## 16. Miller's Law

**Definition:** Working memory holds approximately 7 (±2) items.

**Apply when:** Navigation items, form fields per section, visible options.

- Don't show more than 5-9 items in a navigation bar
- Chunk long lists into groups of 3-5
- Use tabs or accordion to paginate dense content
- Phone numbers should be displayed as `(555) 123-4567`, not `5551234567`

**myVoice application:** Admin nav has 7 items. Topic stats show 3-4 metrics. Keep groups small.

---

## 17. Occam's Razor

**Definition:** The simplest solution is usually the best.

**Apply when:** Architecture decisions, feature design, component structure.

- Don't add features "just in case"
- If two approaches solve the same problem, choose the simpler one
- Every UI element should have a clear purpose
- Remove, don't add, when troubleshooting confusing UX

---

## 18. Paradox of the Active User

**Definition:** Users never read manuals — they start using software immediately.

**Apply when:** Onboarding, help text, empty states.

- Don't rely on documentation or tutorials being read
- Make the interface self-explanatory with clear labels and affordances
- Use inline hints and empty state messages to guide first-time actions
- Tooltips and contextual help are more effective than help pages

**myVoice application:** New users land on the canvas with no guidance. Use empty states ("No videos yet — click + to add one") and inline prompts.

---

## 19. Pareto Principle (80/20 Rule)

**Definition:** 80% of effects come from 20% of causes.

**Apply when:** Prioritizing features, optimizing performance.

- Focus design effort on the 20% of features used 80% of the time
- Optimize the most common user paths first
- Don't polish edge cases before nailing the core experience
- Analytics will reveal which features matter most

---

## 20. Parkinson's Law

**Definition:** Tasks expand to fill available time.

**Apply when:** Form design, time-limited actions.

- Keep forms concise — more fields means more time spent
- Use deadlines and countdowns to create urgency (contest timers)
- Auto-save and auto-progress where possible
- Don't give infinite scroll without a purpose

---

## 21. Peak-End Rule

**Definition:** People judge experiences by their peak moment and ending, not the average.

**Apply when:** User journey design, error handling, success states.

- Design delightful peak moments (winning a contest, first video submission)
- Make endings positive — success messages, confirmation pages, next-step suggestions
- Negative peaks are remembered vividly — invest heavily in error recovery
- A smooth checkout/payout experience matters more than perfect browsing

**myVoice application:** Contest win announcement should be celebratory. Stripe payout success should feel rewarding. Error states should be helpful, not scary.

---

## 22. Postel's Law (Robustness Principle)

**Definition:** Be liberal in what you accept, conservative in what you send.

**Apply when:** Form validation, search, input handling.

- Accept various input formats (with/without spaces, dashes, protocols)
- Trim whitespace, normalize case, fix common typos before validating
- Show clean, consistent output regardless of messy input
- Video URLs should accept full URLs, short URLs, or bare IDs
- Search should be forgiving — fuzzy matching over exact matching

**myVoice application:** Video URL resolution already accepts multiple formats. Search should match partial strings. Apply this everywhere.

---

## 23. Selective Attention

**Definition:** Users focus only on stimuli relevant to their current goal.

**Apply when:** Placing important elements, designing notifications.

- Don't expect users to notice changes outside their focus area
- Critical alerts should interrupt the workflow (modals, toasts)
- Non-critical updates can be passive (badge counts, subtle highlights)
- Place CTAs in the user's natural scan path (top-left to bottom-right)

---

## 24. Serial Position Effect

**Definition:** People remember the first and last items in a series best.

**Apply when:** Navigation bars, lists, feature highlights.

- Put the most important nav items first and last
- In pricing tiers, put the recommended plan in a memorable position
- Hero content should lead; CTAs should close
- The middle of a list is the worst position for important items

**myVoice application:** Header has logo first, login/notifications last. Admin nav starts with Overview, ends with Reports (new, attention-grabbing).

---

## 25. Tesler's Law (Conservation of Complexity)

**Definition:** Every system has irreducible complexity — absorb it in design so users don't have to.

**Apply when:** Complex features, configuration, advanced settings.

- Absorb complexity into the system rather than exposing it to users
- One engineer's extra week > millions of users' extra minutes
- Provide smart defaults that work for 80% of users
- Advanced options should be available but hidden behind progressive disclosure
- Don't oversimplify — power users need depth too

**myVoice application:** SpacetimeDB connection management is hidden from users. BigInt conversions happen in code, not in the UI. API key hashing is server-side. Keep complexity in the system.

---

## 26. Von Restorff Effect (Isolation Effect)

**Definition:** The item that differs from the rest is most remembered.

**Apply when:** CTAs, important notices, pricing, status indicators.

- Make primary CTAs visually distinct from secondary actions
- Use color, size, or animation to highlight what matters
- Don't make everything stand out — if everything is bold, nothing is
- Don't rely solely on color — use shape, size, and position too (accessibility)
- Reduce motion for users who prefer it

**myVoice application:** Primary buttons use `bg-accent`, secondary use `variant="ghost"`. Destructive actions use red. Unread notifications have a blue dot. Contest timer pulses. Maintain these distinctions.

---

## 27. Working Memory

**Definition:** A cognitive system that temporarily holds information needed for tasks.

**Apply when:** Multi-step processes, data-heavy screens.

- Don't require users to remember information from a previous screen
- Show context persistently (breadcrumbs, step indicators, selected filters)
- Pre-fill fields when the system already knows the answer
- Keep related information visible together, not split across tabs

---

## 28. Zeigarnik Effect

**Definition:** People remember uncompleted tasks better than completed ones.

**Apply when:** Onboarding checklists, profile completion, engagement features.

- Incomplete progress bars drive completion
- Profile completion indicators ("Your profile is 60% complete")
- Draft states and "continue where you left off" prompts
- Don't auto-dismiss incomplete task reminders too quickly

---

## Quick Reference: Do's and Don'ts

### Always Do
- Use consistent spacing, colors, and component patterns (Jakob's Law, Similarity)
- Show loading states within 400ms (Doherty Threshold)
- Group related items visually (Proximity, Common Region, Chunking)
- Make primary actions large and visually distinct (Fitts's Law, Von Restorff)
- Accept flexible input, output clean data (Postel's Law)
- Show progress in multi-step flows (Goal-Gradient, Zeigarnik)
- Put important items first and last in lists (Serial Position)
- Use smart defaults (Tesler's Law, Hick's Law)

### Never Do
- Show more than 7 options without grouping (Miller's Law, Choice Overload)
- Invent new UI patterns when standard ones exist (Jakob's Law)
- Add decorative elements that increase cognitive load (Cognitive Load, Prägnanz)
- Rely on users reading help docs (Paradox of Active User)
- Let a beautiful UI mask broken functionality (Aesthetic-Usability Effect)
- Make destructive actions look like primary actions (Von Restorff, Fitts's Law)
- Require users to remember info from previous screens (Working Memory)

---

## myVoice Design System Conventions

These conventions should be followed in all new UI code:

| Element | Pattern | Law |
|---------|---------|-----|
| Cards | `rounded-xl border-border bg-surface` | Common Region |
| Primary Button | `bg-accent text-white` | Von Restorff |
| Ghost Button | `variant="ghost"` for secondary actions | Fitts's Law |
| Destructive | `variant="destructive"` or red colors | Von Restorff |
| Status Badge (success) | `bg-green-500/20 text-green-400` | Similarity |
| Status Badge (pending) | `bg-yellow-500/20 text-yellow-400` | Similarity |
| Status Badge (error) | `bg-red-500/20 text-red-400` | Similarity |
| Loading Spinner | `h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent` | Doherty |
| Empty State | Centered text with action prompt | Paradox of Active User |
| Form Sections | Card with CardHeader + CardContent | Chunking |
| Error Messages | `text-red-400 text-xs` below the field | Proximity |
| Success Messages | `text-green-400 text-xs` | Von Restorff |
| Sortable Headers | `cursor-pointer hover:text-foreground` + arrow indicator | Selective Attention |
| Navigation | Max 7 items; most important first/last | Miller's Law, Serial Position |
| Search Input | Icon left, clearable, debounced | Postel's Law, Doherty |
