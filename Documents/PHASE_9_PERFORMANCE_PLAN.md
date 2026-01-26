# Phase 9: Performance Optimization & Enhancement - PLAN

## Overview

Comprehensive performance audit and optimization to ensure the Foodie Meal Planner app runs smoothly with 3,000+ recipes, complex meal plans, and real-time sync features.

---

## Performance Audit Areas

### 1. Database Query Optimization

**Current State:**
- 19 tables with complex joins
- Recipe list loads all 3,000+ recipes at once
- Shopping list builds with multiple queries
- Meal plan rendering queries per day/slot

**Opportunities:**
- **Lazy loading** for recipe list (load 50 at a time, infinite scroll)
- **Query result caching** for frequently accessed data
- **Index optimization** on commonly queried columns
- **Prepared statements** for repeated queries
- **Batch operations** instead of individual inserts/updates

**Estimated Impact:** 40-60% faster page loads, 70% less database CPU

---

### 2. Recipe List Rendering

**Current State:**
- Renders all 3,000+ recipes to DOM immediately
- Creates ~3,000 DOM nodes on Recipes tab load
- No virtualization
- Pagination implemented but loads all data upfront

**Opportunities:**
- **Virtual scrolling** (only render visible items + buffer)
- **Incremental rendering** (render 50 items, then requestIdleCallback for more)
- **DOM recycling** (reuse existing nodes when scrolling)
- **Image lazy loading** (if recipe thumbnails added)
- **Debounced search/filter** (already implemented, verify performance)

**Estimated Impact:** 80% faster initial render, 60% less memory usage

---

### 3. Meal Planner Performance

**Current State:**
- Renders 7-day grid with all meals
- Queries database per slot (21 queries for 7 days × 3 meals)
- Re-renders entire grid on any change
- Drag & drop creates temporary elements

**Opportunities:**
- **Batch query** for entire date range (1 query instead of 21)
- **Partial re-rendering** (only update changed cells)
- **Memoization** of meal slot components
- **Debounced drag & drop** updates
- **Optimistic UI updates** (show change immediately, sync later)

**Estimated Impact:** 50% faster grid rendering, 75% fewer database queries

---

### 4. Shopping List Generation

**Current State:**
- Builds list from scratch each time
- Multiple queries for ingredients, categories, stores
- Processes all recipes in date range
- No caching of intermediate results

**Opportunities:**
- **Incremental updates** (only recalculate changed recipes)
- **Ingredient deduplication** optimization (use Map instead of array loops)
- **Worker thread** for heavy computation
- **Cache ingredient categories** in memory
- **Streaming results** (show items as they're calculated)

**Estimated Impact:** 60% faster generation, better perceived performance

---

### 5. WebSocket & Companion App Sync

**Current State:**
- Sends full meal plan on every change
- No message compression
- Re-sends all data even for small updates
- Connection checks every second

**Opportunities:**
- **Differential sync** (only send changes)
- **Message batching** (combine multiple updates)
- **gzip compression** for large payloads
- **Heartbeat optimization** (reduce frequency)
- **Reconnection backoff** strategy

**Estimated Impact:** 70% less network traffic, better battery life on devices

---

### 6. Memory Management

**Current State:**
- Recipe cache grows unbounded
- Event listeners not always cleaned up
- Large arrays kept in memory
- No garbage collection hints

**Opportunities:**
- **LRU cache** for recipes (max 100 in memory)
- **Weak references** for event listeners
- **Cleanup on tab switch** (clear unused data)
- **Memory profiling** to find leaks
- **Object pooling** for frequently created objects

**Estimated Impact:** 50% less memory usage, no memory leaks

---

### 7. Search & Filter Performance

**Current State:**
- Linear search through all recipes
- Re-filters entire list on every keystroke
- No search index
- Case-insensitive toLowerCase() on every item

**Opportunities:**
- **Debounced search** (already implemented, verify 300ms is optimal)
- **Search index** (pre-build lowercase title/ingredient maps)
- **Early exit** optimizations
- **Web Worker** for search on large datasets
- **Result caching** (cache last 10 search queries)

**Estimated Impact:** 80% faster search, smoother typing experience

---

### 8. Animation Performance

**Current State:**
- Most animations GPU-accelerated (transform, opacity)
- Some layout-triggering animations (max-height)
- Skeleton loaders animate continuously
- Tour spotlight pulses every 2s

**Opportunities:**
- **will-change** hints for animated elements
- **Pause animations** when tab not visible
- **Reduce motion** for power savings
- **requestAnimationFrame** for custom animations
- **CSS containment** for complex components

**Estimated Impact:** Consistent 60 FPS, 20% less CPU usage

---

### 9. Startup Performance

**Current State:**
- Loads all data on init()
- Synchronous database queries block UI
- Large HTML file (17,000+ lines)
- No code splitting

**Opportunities:**
- **Lazy tab loading** (only load active tab's data)
- **Progressive enhancement** (show skeleton, load data async)
- **Defer non-critical JS** (tour, help system)
- **Critical CSS inlining** (already done in single file)
- **Service worker** for instant loads (future)

**Estimated Impact:** 50% faster Time to Interactive (TTI)

---

### 10. Bundle Size & Code Optimization

**Current State:**
- Single 17,000+ line HTML file
- Some unused code (e.g., features not enabled)
- Repetitive CSS
- No minification in production

**Opportunities:**
- **Minify HTML/CSS/JS** for production builds
- **Remove dead code** (tree shaking)
- **CSS deduplication** (extract repeated styles)
- **Compress images** (if added)
- **Split large functions** into modules (if possible)

**Estimated Impact:** 30% smaller file size, faster downloads

---

## Implementation Phases

### Phase 9.1: Database Optimization (~2-3 hours)

**Tasks:**
1. Add database indexes for frequently queried columns
2. Implement query result caching (in-memory Map)
3. Batch meal plan queries (1 query for entire range)
4. Optimize shopping list ingredient queries
5. Add prepared statement caching

**Deliverables:**
- Migration script for indexes
- Caching layer for queries
- Performance benchmarks (before/after)

**Success Metrics:**
- Recipe list loads < 500ms (currently ~2s)
- Meal plan renders < 300ms (currently ~1s)
- Shopping list generates < 1s (currently ~3s)

---

### Phase 9.2: Recipe List Virtual Scrolling (~3-4 hours)

**Tasks:**
1. Implement virtual scroll container
2. Calculate visible range based on scroll position
3. Render only visible + buffer items (50 total)
4. Recycle DOM nodes when scrolling
5. Update pagination to work with virtual scroll

**Deliverables:**
- Virtual scroll component
- Smooth scrolling behavior
- Search/filter integration

**Success Metrics:**
- Initial render < 100ms (currently ~800ms)
- Smooth 60 FPS scrolling
- Memory usage < 50MB (currently ~120MB)

---

### Phase 9.3: Meal Planner Optimization (~2 hours)

**Tasks:**
1. Batch database queries for entire date range
2. Implement partial re-rendering (only update changed slots)
3. Memoize meal slot components
4. Optimize drag & drop performance
5. Add loading skeletons for perceived performance

**Deliverables:**
- Optimized meal plan rendering
- Faster drag & drop
- Better perceived performance

**Success Metrics:**
- Grid renders in < 200ms (currently ~800ms)
- Drag & drop feels instant (< 16ms per frame)
- Fewer than 5 database queries per render (currently 21)

---

### Phase 9.4: Search & Filter Index (~1-2 hours)

**Tasks:**
1. Build search index on app startup
2. Pre-compute lowercase titles, ingredients, keywords
3. Implement indexed search (O(1) lookup)
4. Cache last 10 search results
5. Add search result highlighting (optional)

**Deliverables:**
- Search index implementation
- Cached search results
- Performance benchmarks

**Success Metrics:**
- Search completes in < 10ms (currently ~100ms)
- Typing feels instant (no lag)
- Search index builds in < 500ms

---

### Phase 9.5: Memory Management (~2-3 hours)

**Tasks:**
1. Implement LRU cache for recipes (max 100 items)
2. Clean up event listeners on component unmount
3. Clear unused data when switching tabs
4. Add garbage collection hints
5. Memory leak detection & fixes

**Deliverables:**
- LRU cache implementation
- Cleanup utilities
- Memory profiling report

**Success Metrics:**
- Memory usage stays < 100MB after 1 hour of use
- No memory leaks detected
- GC pauses < 10ms

---

### Phase 9.6: WebSocket Optimization (~1-2 hours)

**Tasks:**
1. Implement differential sync (send only changes)
2. Add message batching (combine updates)
3. Reduce heartbeat frequency (5s → 10s)
4. Implement reconnection backoff
5. Add optional gzip compression

**Deliverables:**
- Optimized WebSocket protocol
- Message batching logic
- Reconnection strategy

**Success Metrics:**
- 70% less network traffic
- Faster sync updates (< 50ms)
- Better battery life on iPad/iPhone

---

### Phase 9.7: Startup Performance (~2 hours)

**Tasks:**
1. Implement lazy tab loading (only load active tab)
2. Defer non-critical JS (tour, help)
3. Show skeleton loaders immediately
4. Async data loading with progress indicators
5. Optimize critical rendering path

**Deliverables:**
- Lazy loading system
- Progressive enhancement
- Startup profiling report

**Success Metrics:**
- Time to First Paint (FP) < 500ms
- Time to Interactive (TTI) < 1.5s (currently ~3s)
- First Contentful Paint (FCP) < 800ms

---

### Phase 9.8: Animation Performance (~1 hour)

**Tasks:**
1. Add `will-change` hints to animated elements
2. Pause animations when tab not visible
3. Optimize FAQ expand/collapse (use transform instead of max-height)
4. Reduce skeleton loader animation frequency
5. Test on lower-end hardware

**Deliverables:**
- Optimized animations
- Power savings mode
- Performance report

**Success Metrics:**
- Consistent 60 FPS on all animations
- 20% less CPU usage during animations
- No dropped frames

---

### Phase 9.9: Code Size Optimization (~1-2 hours)

**Tasks:**
1. Minify HTML/CSS/JS for production
2. Remove unused code
3. Deduplicate CSS
4. Analyze bundle size
5. Implement production build script

**Deliverables:**
- Minified production build
- Build script
- Size comparison report

**Success Metrics:**
- 30% smaller file size (17KB → 12KB HTML)
- Faster download on slow connections
- No functionality lost

---

### Phase 9.10: Performance Monitoring (~1 hour)

**Tasks:**
1. Add performance timing API calls
2. Log slow operations (> 100ms)
3. Track memory usage over time
4. Monitor database query times
5. Create performance dashboard (optional)

**Deliverables:**
- Performance monitoring system
- Logging utilities
- Metrics dashboard (console-based)

**Success Metrics:**
- All operations logged
- Easy to identify bottlenecks
- Historical performance data

---

## Performance Budget

**Target Metrics:**

| Metric | Current | Target | Priority |
|--------|---------|--------|----------|
| **Startup Time (TTI)** | ~3s | < 1.5s | High |
| **Recipe List Load** | ~2s | < 500ms | High |
| **Search Response** | ~100ms | < 10ms | Medium |
| **Meal Plan Render** | ~800ms | < 200ms | High |
| **Shopping List Gen** | ~3s | < 1s | High |
| **Memory Usage (1hr)** | ~150MB | < 100MB | Medium |
| **Animation FPS** | 45-60 | 60 | Medium |
| **Bundle Size** | ~17KB | < 12KB | Low |

---

## Testing Strategy

### Performance Tests

**1. Startup Performance**
```javascript
// Measure Time to Interactive
const startTime = performance.now();
window.addEventListener('load', () => {
  const tti = performance.now() - startTime;
  console.log(`TTI: ${tti}ms`);
});
```

**2. Recipe List Rendering**
```javascript
// Measure render time
console.time('Recipe List Render');
await resetAndLoadRecipes();
console.timeEnd('Recipe List Render');
```

**3. Search Performance**
```javascript
// Measure search time
const searchQuery = 'chicken';
console.time(`Search: ${searchQuery}`);
filterRecipes(searchQuery);
console.timeEnd(`Search: ${searchQuery}`);
```

**4. Memory Profiling**
```javascript
// Take heap snapshot before/after operations
if (performance.memory) {
  console.log('Memory Usage:', {
    used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
    total: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB'
  });
}
```

**5. Frame Rate Monitoring**
```javascript
// Monitor FPS during animations
let lastTime = performance.now();
let frames = 0;

function measureFPS() {
  frames++;
  const currentTime = performance.now();
  
  if (currentTime >= lastTime + 1000) {
    console.log(`FPS: ${frames}`);
    frames = 0;
    lastTime = currentTime;
  }
  
  requestAnimationFrame(measureFPS);
}

measureFPS();
```

### Load Testing

**1. Large Dataset Test**
- Create 10,000+ recipes (instead of 3,000)
- Measure all operations
- Ensure no performance cliffs

**2. Extended Usage Test**
- Run app for 8 hours continuously
- Monitor memory usage
- Check for memory leaks

**3. Stress Test**
- Rapid tab switching
- Fast scrolling
- Quick search typing
- Verify no crashes or slowdowns

---

## Tools & Resources

### Profiling Tools

1. **Chrome DevTools Performance Tab**
   - Record timeline
   - Identify long tasks (> 50ms)
   - Find layout thrashing
   - Memory profiling

2. **Chrome DevTools Memory Tab**
   - Heap snapshots
   - Allocation timeline
   - Memory leak detection

3. **Lighthouse**
   - Overall performance score
   - Recommendations
   - Best practices

4. **Custom Performance Markers**
```javascript
performance.mark('recipe-list-start');
await loadRecipes();
performance.mark('recipe-list-end');
performance.measure('recipe-list', 'recipe-list-start', 'recipe-list-end');
console.log(performance.getEntriesByName('recipe-list')[0].duration);
```

### Monitoring

**Console-Based Dashboard:**
```javascript
function showPerformanceStats() {
  console.log(`
┌─────────────────────────────────────┐
│     Performance Dashboard           │
├─────────────────────────────────────┤
│ Memory Usage:    ${getMemoryUsage()} MB      │
│ Recipe Count:    3,247               │
│ Last Query Time: 45ms                │
│ Cache Hit Rate:  87%                 │
│ FPS (avg):       59                  │
└─────────────────────────────────────┘
  `);
}
```

---

## Risk Assessment

### High Risk
- **Virtual scrolling** - Complex to implement, could break existing features
- **Database schema changes** - Could corrupt data if migration fails

**Mitigation:**
- Comprehensive testing
- Database backups before migrations
- Feature flags for new implementations

### Medium Risk
- **LRU cache** - Could cause stale data if not invalidated properly
- **Lazy loading** - Could break assumptions about data availability

**Mitigation:**
- Clear cache invalidation rules
- Fallback to eager loading if issues

### Low Risk
- **Animation optimizations** - Mostly cosmetic
- **Code minification** - Reversible in development mode

---

## Success Criteria

**Phase 9 Complete When:**
- ✅ All target metrics met (see Performance Budget)
- ✅ No regressions in functionality
- ✅ Memory usage stable over 8-hour test
- ✅ 60 FPS maintained on all animations
- ✅ Startup time < 1.5s
- ✅ No memory leaks detected
- ✅ Performance monitoring in place

**User-Facing Improvements:**
- App feels instant and responsive
- No lag when typing in search
- Smooth scrolling through recipe list
- Fast tab switching
- Quick meal plan updates
- Instant drag & drop feedback

---

## Timeline Estimate

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 9.1 | Database Optimization | 2-3 hours |
| 9.2 | Virtual Scrolling | 3-4 hours |
| 9.3 | Meal Planner Optimization | 2 hours |
| 9.4 | Search Index | 1-2 hours |
| 9.5 | Memory Management | 2-3 hours |
| 9.6 | WebSocket Optimization | 1-2 hours |
| 9.7 | Startup Performance | 2 hours |
| 9.8 | Animation Performance | 1 hour |
| 9.9 | Code Size Optimization | 1-2 hours |
| 9.10 | Performance Monitoring | 1 hour |
| **Total** | | **16-22 hours** |

**Recommended Approach:** Tackle highest-impact phases first (9.1, 9.2, 9.3, 9.7)

---

## Documentation

**Performance Report Template:**
```markdown
# Performance Optimization Report

## Phase: [Phase Number]

### Before
- Metric 1: XXms
- Metric 2: XXms
- Memory: XXMB

### After
- Metric 1: XXms (XX% improvement)
- Metric 2: XXms (XX% improvement)
- Memory: XXMB (XX% reduction)

### Changes Made
1. Change 1
2. Change 2

### Issues Encountered
- Issue 1 → Resolution

### Next Steps
- Follow-up optimization
```

---

**Implementation Date:** 2026-01-20  
**Status:** PLAN COMPLETE - Ready for implementation  
**Priority:** 3 (Performance & Optimization)  
**Dependencies:** All Priority 2 (Polish) tasks complete
