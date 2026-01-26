# Priority 2: Polish - Implementation Plan

**Total Estimated Time:** 5-8 hours  
**Goal:** Enhance user experience with refined dark mode, smooth animations, onboarding tour, and contextual help

---

## Phase 5.4: Dark Mode Refinements (~1 hour)

### Objectives
- Audit all UI components for dark mode contrast
- Ensure WCAG AA accessibility standards
- Polish visual hierarchy and readability
- Add smooth dark/light mode transitions

### Tasks

#### 1. Color Palette Refinement (15 min)
- [ ] Review current CSS variables for dark mode
- [ ] Adjust contrast ratios to meet WCAG AA (4.5:1 for normal text, 3:1 for large text)
- [ ] Add intermediate shades for better depth perception
- [ ] Test with macOS system dark mode toggle

**File:** `src/renderer/index.html` (CSS variables section)

**Current Variables:**
```css
:root { 
  --bg:#0b0f14; 
  --card:#121926; 
  --muted:#8aa0b6; 
  --text:#e8eef6; 
  --accent:#4da3ff; 
  --danger:#ff6b6b; 
  --line:rgba(255,255,255,0.10); 
}
```

**Enhancements:**
- Add `--bg-elevated` for layered cards
- Add `--text-primary`, `--text-secondary`, `--text-tertiary` for hierarchy
- Add `--border-subtle`, `--border-strong` for borders
- Add transition for theme switching

#### 2. Component-Level Audits (30 min)

**Cards & Containers:**
- [ ] Meal planner cards - ensure proper elevation and shadows
- [ ] Modal backgrounds - adjust backdrop opacity
- [ ] User switcher dropdown - improve shadow and borders
- [ ] Collection cards - enhance hover states

**Forms & Inputs:**
- [ ] Input fields - improve focus states and borders
- [ ] Select dropdowns - enhance readability
- [ ] Textareas - ensure proper contrast
- [ ] Checkboxes/radio buttons - increase visibility

**Buttons:**
- [ ] Primary buttons - ensure sufficient contrast
- [ ] Ghost buttons - improve visibility without being intrusive
- [ ] Danger buttons - balance warning without alarm
- [ ] Disabled states - clear but not invisible

**Lists & Items:**
- [ ] Recipe list items - improve hover and selected states
- [ ] Shopping list items - enhance checkbox visibility
- [ ] Additional items - clarify hierarchy
- [ ] Assignment badges - ensure readable on all backgrounds

#### 3. Smooth Theme Transitions (15 min)
- [ ] Add `transition: background-color 0.3s ease, color 0.3s ease` to root elements
- [ ] Prevent transition on initial load
- [ ] Add prefers-color-scheme media query for system preference detection

---

## Phase 5.5: Complete Animations (~1-2 hours)

### Objectives
- Add loading states to prevent blank screens
- Implement smooth transitions between views
- Add micro-interactions for better feedback
- Ensure 60fps performance

### Tasks

#### 1. Loading States (30 min)

**Skeleton Loaders:**
- [ ] Recipe list skeleton (15 lines with shimmer)
- [ ] Meal planner skeleton (7-day grid)
- [ ] User switcher skeleton (3 user cards)
- [ ] Modal content skeleton

**File:** `src/renderer/index.html` (add skeleton CSS)

**Example Skeleton:**
```css
.skeleton {
  background: linear-gradient(90deg, 
    rgba(255,255,255,0.05) 25%, 
    rgba(255,255,255,0.1) 50%, 
    rgba(255,255,255,0.05) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Spinners:**
- [ ] Button loading states (inline spinner)
- [ ] Page-level loading (center spinner)
- [ ] Async operation feedback

#### 2. View Transitions (30 min)

**Tab Switching:**
- [ ] Fade in/out with 200ms duration
- [ ] Slight scale effect (0.98 → 1.0)
- [ ] Stagger child elements (50ms delay)

**Modal Animations:**
- [ ] Slide up from bottom (mobile-style)
- [ ] Backdrop fade in
- [ ] Close animation (reverse)

**Code Example:**
```javascript
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.style.display = 'flex';
  modal.style.opacity = '0';
  modal.style.transform = 'translateY(20px)';
  
  requestAnimationFrame(() => {
    modal.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    modal.style.opacity = '1';
    modal.style.transform = 'translateY(0)';
  });
}
```

#### 3. Micro-Interactions (30 min)

**Hover Effects:**
- [ ] Recipe card lift (2px translateY)
- [ ] Button press feedback (scale 0.98)
- [ ] Checkbox check animation
- [ ] Star favorite bounce

**Click Feedback:**
- [ ] Ripple effect on buttons
- [ ] Flash on toggle
- [ ] Bounce on add/remove

**File Updates:**
- [ ] Add `will-change: transform` to animated elements
- [ ] Use `transform` instead of position changes (GPU accelerated)
- [ ] Debounce rapid interactions

---

## Phase 8.1: First-Run Tour (~2-3 hours)

### Objectives
- Create welcoming onboarding experience
- Highlight key features in order of importance
- Allow skip/dismiss at any time
- Store completion state in localStorage

### Tasks

#### 1. Tour Infrastructure (45 min)

**HTML Structure:**
```html
<!-- Tour overlay -->
<div id="tourOverlay" class="tour-overlay" style="display:none">
  <div class="tour-spotlight"></div>
  <div class="tour-card">
    <div class="tour-card-header">
      <span class="tour-step">1 of 7</span>
      <button class="tour-skip">Skip Tour</button>
    </div>
    <div class="tour-card-content">
      <h3 class="tour-title"></h3>
      <p class="tour-description"></p>
    </div>
    <div class="tour-card-footer">
      <button class="tour-prev">Previous</button>
      <button class="tour-next">Next</button>
    </div>
  </div>
</div>
```

**CSS Styling:**
```css
.tour-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(4px);
}

.tour-spotlight {
  position: absolute;
  border: 3px solid var(--accent);
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0,0,0,0.8);
  pointer-events: none;
  transition: all 0.3s ease;
}

.tour-card {
  position: absolute;
  width: 360px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.6);
}
```

**JavaScript Functions:**
```javascript
const TOUR_STEPS = [
  {
    target: '#recipesTab',
    title: 'Browse Recipes',
    description: 'Explore 10,000+ recipes from around the world. Search, filter by cuisine, dietary restrictions, and more.',
    position: 'bottom'
  },
  {
    target: '#plannerTab',
    title: 'Plan Your Meals',
    description: 'Drag recipes into your weekly planner. View as a list or calendar grid.',
    position: 'bottom'
  },
  {
    target: '#shoppingTab',
    title: 'Generate Shopping Lists',
    description: 'Automatically create shopping lists from your meal plan. Organized by category and store.',
    position: 'bottom'
  },
  {
    target: '#btnUserSwitcher',
    title: 'Multi-User Support',
    description: 'Create profiles for household members with personal favorites and dietary restrictions.',
    position: 'bottom-right'
  },
  {
    target: '#companionFloatBtn',
    title: 'Companion Apps',
    description: 'Connect your iPad (kitchen display) and iPhone (shopping list) for a complete cooking experience.',
    position: 'left'
  },
  {
    target: '#voiceBtn',
    title: 'Voice Commands',
    description: 'Use voice commands on iPad to navigate recipes hands-free while cooking.',
    position: 'left'
  },
  {
    target: '#settingsBtn',
    title: 'Customize Your Experience',
    description: 'Configure preferences, manage data, and customize your meal planning workflow.',
    position: 'bottom-left'
  }
];

function startTour() {
  if (localStorage.getItem('tourCompleted') === 'true') return;
  
  currentTourStep = 0;
  showTourStep(0);
}

function showTourStep(index) {
  const step = TOUR_STEPS[index];
  const target = document.querySelector(step.target);
  
  // Position spotlight
  const rect = target.getBoundingClientRect();
  const spotlight = document.querySelector('.tour-spotlight');
  spotlight.style.left = rect.left - 8 + 'px';
  spotlight.style.top = rect.top - 8 + 'px';
  spotlight.style.width = rect.width + 16 + 'px';
  spotlight.style.height = rect.height + 16 + 'px';
  
  // Position card
  const card = document.querySelector('.tour-card');
  positionTourCard(card, rect, step.position);
  
  // Update content
  document.querySelector('.tour-step').textContent = `${index + 1} of ${TOUR_STEPS.length}`;
  document.querySelector('.tour-title').textContent = step.title;
  document.querySelector('.tour-description').textContent = step.description;
  
  // Show overlay
  document.getElementById('tourOverlay').style.display = 'flex';
}
```

#### 2. Tour Steps Definition (60 min)

**7 Key Tour Steps:**

1. **Welcome Screen** (modal, no spotlight)
   - App logo
   - "Welcome to Foodie Meal Planner!"
   - Brief overview (2-3 sentences)
   - "Let's take a quick tour" button

2. **Recipes Tab**
   - Highlight tab button
   - Show recipe search and filters
   - Mention 10k+ recipes

3. **Meal Planner**
   - Highlight planner tab
   - Show drag-and-drop
   - Mention list/grid views

4. **Shopping Lists**
   - Highlight shopping tab
   - Show automatic generation
   - Mention store organization

5. **User Switcher**
   - Highlight user button
   - Show multi-user profiles
   - Mention dietary restrictions

6. **Companion Apps**
   - Highlight companion button
   - Show iPad/iPhone sync
   - Mention voice commands

7. **Settings & Finish**
   - Highlight settings
   - "You're all set!"
   - "Start Planning" button

#### 3. Tour State Management (30 min)

**localStorage Keys:**
- `tourCompleted`: boolean
- `tourSkippedAt`: step number
- `tourLastShown`: timestamp

**Functions:**
- `checkFirstRun()` - called on app init
- `skipTour()` - mark as completed
- `resetTour()` - developer function
- `resumeTour()` - optional resume feature

---

## Phase 8.2: Contextual Help (~1-2 hours)

### Objectives
- Add help icons next to complex features
- Implement tooltip system
- Create help modal with FAQ
- Link to documentation where appropriate

### Tasks

#### 1. Tooltip System (30 min)

**HTML Structure:**
```html
<button class="help-icon" data-tooltip="Click to assign this meal to specific users">
  <span class="icon-help">?</span>
</button>
```

**CSS:**
```css
.help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(77,163,255,0.15);
  border: 1px solid rgba(77,163,255,0.3);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  cursor: help;
  transition: all 0.2s ease;
}

.help-icon:hover {
  background: rgba(77,163,255,0.25);
  transform: scale(1.1);
}

/* Tooltip */
[data-tooltip] {
  position: relative;
}

[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #1a1a1a;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

[data-tooltip]:hover::after {
  opacity: 1;
}
```

**JavaScript Enhancement:**
```javascript
// Enhanced tooltips with multiline support
function initTooltips() {
  document.querySelectorAll('[data-tooltip-multiline]').forEach(el => {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-multiline';
    tooltip.textContent = el.dataset.tooltipMultiline;
    tooltip.style.maxWidth = '300px';
    tooltip.style.whiteSpace = 'normal';
    
    el.addEventListener('mouseenter', () => {
      document.body.appendChild(tooltip);
      const rect = el.getBoundingClientRect();
      tooltip.style.left = rect.left + 'px';
      tooltip.style.top = rect.bottom + 8 + 'px';
      tooltip.style.opacity = '1';
    });
    
    el.addEventListener('mouseleave', () => {
      tooltip.remove();
    });
  });
}
```

#### 2. Contextual Help Locations (45 min)

**Key Areas for Help Icons:**

1. **Meal Assignment Editor**
   - Help: "Select which household members this meal is for. Leave empty to default to 'Whole Family'."

2. **Additional Items**
   - Help: "Add side dishes, desserts, or appetizers to this meal. They'll appear in the shopping list."

3. **Dietary Restrictions**
   - Help: "Mark dietary preferences for this user. Future updates will suggest compatible recipes."

4. **Collection Assignment**
   - Help: "Assign a collection to replace the main recipe and add others as additional items."

5. **Voice Commands (iPad)**
   - Help: "Say 'Foodie' followed by commands like 'next step', 'start timer', 'read ingredients'."

6. **Smart Suggestions**
   - Help: "AI-powered suggestions based on your favorites, recent meals, and variety preferences."

7. **Companion Apps**
   - Help: "Connect your iPad to display recipes while cooking, and iPhone for shopping lists on the go."

8. **User Switcher**
   - Help: "Switch between household members to see personalized favorites and meal assignments."

#### 3. Help Modal (45 min)

**Quick Help Modal:**
```html
<div id="helpModal" class="modalBack">
  <div class="modal">
    <div class="modalHead">
      <h2>Help & Documentation</h2>
      <button onclick="closeModal('helpModal')">×</button>
    </div>
    
    <div class="help-search">
      <input type="text" id="helpSearch" placeholder="Search help topics..." />
    </div>
    
    <div class="help-categories">
      <button class="help-category-btn active" data-category="getting-started">
        Getting Started
      </button>
      <button class="help-category-btn" data-category="meal-planning">
        Meal Planning
      </button>
      <button class="help-category-btn" data-category="shopping">
        Shopping Lists
      </button>
      <button class="help-category-btn" data-category="multi-user">
        Multi-User
      </button>
      <button class="help-category-btn" data-category="companion">
        Companion Apps
      </button>
    </div>
    
    <div id="helpContent" class="help-content">
      <!-- Dynamic content loaded here -->
    </div>
  </div>
</div>
```

**Help Content Structure:**
```javascript
const HELP_TOPICS = {
  'getting-started': [
    {
      q: 'How do I add recipes to my meal plan?',
      a: 'Go to the Recipes tab, find a recipe you like, and click "Add to Plan". Choose the date and meal slot (Breakfast, Lunch, or Dinner).'
    },
    {
      q: 'How do I search for recipes?',
      a: 'Use the search bar at the top of the Recipes tab. You can search by name, cuisine, ingredients, or dietary restrictions.'
    }
  ],
  'meal-planning': [
    {
      q: 'Can I assign meals to specific family members?',
      a: 'Yes! When selecting a meal, click on user chips to assign it to specific household members. This helps track who\'s eating what.'
    },
    {
      q: 'How do I add sides or desserts to a meal?',
      a: 'In the meal plan, click "Add Additional Item" below a meal. Search for the recipe and choose the item type (side, dessert, etc.).'
    }
  ],
  // ... more categories
};
```

---

## Implementation Order

### Day 1 (3-4 hours)
1. **Morning:** Phase 5.4 - Dark Mode Refinements (1 hour)
2. **Afternoon:** Phase 5.5 - Complete Animations (2 hours)
3. **Testing:** Verify animations and dark mode across all tabs

### Day 2 (4 hours)
1. **Morning:** Phase 8.1 - First-Run Tour (2.5 hours)
2. **Afternoon:** Phase 8.2 - Contextual Help (1.5 hours)
3. **Testing:** Full UX walkthrough with fresh eyes

---

## Success Criteria

### Phase 5.4 (Dark Mode)
- [ ] All text meets WCAG AA contrast ratios
- [ ] Smooth theme transitions (no flash)
- [ ] Consistent elevation hierarchy
- [ ] System dark mode preference respected

### Phase 5.5 (Animations)
- [ ] No blank screens during loading
- [ ] Smooth 60fps transitions
- [ ] Clear feedback for all interactions
- [ ] No janky scrolling or hover effects

### Phase 8.1 (Tour)
- [ ] Tour auto-starts on first run
- [ ] All 7 steps clearly highlight features
- [ ] Can skip at any time
- [ ] Can restart from settings
- [ ] localStorage persists completion

### Phase 8.2 (Help)
- [ ] Help icons on 8+ key features
- [ ] Tooltips appear on hover
- [ ] Help modal searchable
- [ ] FAQ covers common questions
- [ ] Links to full documentation

---

## Files to Modify

**Primary File:**
- `src/renderer/index.html` - All CSS, HTML, and JavaScript changes

**New Assets (Optional):**
- `docs/HELP.md` - Full help documentation
- `assets/tour-welcome.png` - Welcome screen image (if desired)

**Total Estimated Lines of Code:**
- Dark Mode: ~100 lines (CSS refinements)
- Animations: ~300 lines (CSS + JS)
- First-Run Tour: ~500 lines (HTML + CSS + JS)
- Contextual Help: ~400 lines (HTML + CSS + JS + content)
- **Total: ~1,300 lines**

---

## Ready to Start?

Let's begin with **Phase 5.4: Dark Mode Refinements**!
