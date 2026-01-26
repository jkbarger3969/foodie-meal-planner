# How Meal Assignments Work

## Current System Design

**The meal plan is SHARED across all users** - there's only one meal plan per household per date. However, you can **assign specific meals to specific users** to track who each meal is for.

## How to Assign a Meal to a User

### Step 1: Open the Meal Picker
Click on any meal slot (Breakfast, Lunch, or Dinner) on any date in the Planner view.

### Step 2: Assign Users
In the Meal Picker modal, you'll see a section labeled **"This meal is for:"**

This section shows **user chips** for each family member:
```
┌─────────────────────────────────────────────┐
│ This meal is for:                           │
│                                             │
│  👨‍👩‍👧‍👦 Whole Family ✓   👤 John        👤 Sarah    │
│  └──────────────┘   └────────┘   └────────┘ │
│     Selected         Not          Not       │
│                    Selected     Selected     │
└─────────────────────────────────────────────┘
```

- **Click a chip** to toggle assignment
- **Selected chips** show a checkmark (✓) and are highlighted
- You can select **multiple users** for the same meal
- If you don't select anyone, it defaults to "Whole Family"

### Step 3: Select a Recipe
Search for and select a recipe as normal. When you click "Select", the meal is saved with the assigned users.

### Step 4: View in Planner
The meal slot now shows:
- The recipe name
- Small avatar badges showing who the meal is for

Example in planner:
```
┌─────────────────────────┐
│ Breakfast               │
│ Scrambled Eggs          │
│ 👤 John 👤 Sarah        │ ← Assignment badges
└─────────────────────────┘
```

## What This Means

### ✅ What Works
- **Track who each meal is for** - You can see at a glance which family members are eating what
- **Multiple people per meal** - A meal can be assigned to multiple family members
- **Per-meal granularity** - Each meal slot can have different assignments

### ❌ What Doesn't Work (Current Limitation)
- **Separate meal plans per user** - Switching users doesn't change the meal plan
- **User-specific views** - John and Sarah both see the exact same meal plan
- **Personal meal planning** - You can't create different meal plans for different family members

## Example Use Case

**Family Scenario:**
- **Breakfast (Monday):** Pancakes → Assigned to "Whole Family"
- **Lunch (Monday):** Salad → Assigned to "Mom" only (Dad is at work)
- **Dinner (Monday):** Pizza → Assigned to "Whole Family"

Even though Mom is the only one assigned to the Salad, everyone still sees it in the meal plan. The assignment just tracks/labels who it's for.

## Current vs. Desired Behavior

### Current Behavior ✅
- One shared household meal plan
- Tags indicate who each meal is for
- Switching users doesn't change what you see

### Potential Future Behavior (Not Implemented)
- Each user could have their own separate meal plan
- Switching to "John" would show John's personal meal plan
- Switching to "Sarah" would show Sarah's personal meal plan
- "Whole Family" would show the shared household plan

---

## Technical Details

### Database Structure
- **`plans` table**: Stores the actual meal plan (one per date, shared)
- **`plan_meal_assignments` table**: Stores which users are assigned to each meal

### Current User Switching
When you switch users:
- The active user context changes (`ACTIVE_USER`)
- User-specific data changes (favorites, preferences)
- **Meal plan stays the same** (shared household plan)

### To Implement Separate Plans Per User (Future)
Would require:
1. Add `UserId` column to `plans` table
2. Change primary key to `(Date, UserId)`
3. Filter all meal plan queries by active user
4. Show "Whole Family" plan when that user is selected
5. Data migration for existing plans
