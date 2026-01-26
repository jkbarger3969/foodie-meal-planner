#!/bin/bash
# Test: Collection Assignment Planner View Preservation

clear
echo "╔═══════════════════════════════════════════════════╗"
echo "║  🔍 Test: Planner View After Collection Assign   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

echo "This test verifies the planner view stays consistent"
echo "when assigning collections from the Collections tab."
echo ""

# Test 1: Assign within current view
echo "═══════════════════════════════════════════════════"
echo "TEST 1: Assign Collection Within Current View"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Setup:"
echo "  1. Go to Meal Planner tab"
echo "  2. Note the current date range (e.g., Jan 19-26)"
echo "  3. Go to Collections tab"
echo "  4. Click '📅 Assign to Meal Plan' on any collection"
echo "  5. Select a date WITHIN the current range (e.g., Jan 22)"
echo "  6. Select a meal slot (e.g., Dinner)"
echo "  7. Click 'Assign Collection'"
echo ""
echo "Expected Result:"
echo "  ✅ View should STAY on Jan 19-26 (not change)"
echo "  ✅ You should still see today (Jan 19) and all days"
echo "  ✅ Auto-scroll to Jan 22 and expand that day"
echo "  ✅ Console shows: 'Assigned date within current view, keeping view'"
echo ""
read -p "Did the view stay unchanged? (y/n): " test1
echo ""

if [[ "$test1" == "y" ]]; then
    echo "✅ Test 1 PASSED"
else
    echo "❌ Test 1 FAILED"
    echo "   The view should NOT change when assigning within current range"
fi

echo ""
read -p "Press ENTER to continue to Test 2..."
clear

# Test 2: Assign to future date
echo "═══════════════════════════════════════════════════"
echo "TEST 2: Assign Collection to Future Date"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Setup:"
echo "  1. Current view: Jan 19-26"
echo "  2. Today: Jan 19"
echo "  3. Go to Collections tab"
echo "  4. Assign a collection to Jan 30 (future date)"
echo ""
echo "Expected Result:"
echo "  ✅ View should STAY on Jan 19-26 (keeps today visible)"
echo "  ✅ You should still see Jan 19 (today)"
echo "  ✅ Jan 30 is not visible yet (use navigation to see it)"
echo "  ✅ Console shows: 'Assigned date within current view' OR 'adjusting to: 2026-01-19'"
echo ""
read -p "Did the view keep today visible? (y/n): " test2
echo ""

if [[ "$test2" == "y" ]]; then
    echo "✅ Test 2 PASSED"
else
    echo "❌ Test 2 FAILED"
    echo "   Should keep today visible when assigning to future"
fi

echo ""
read -p "Press ENTER to continue to Test 3..."
clear

# Test 3: Assign to past date (edge case)
echo "═══════════════════════════════════════════════════"
echo "TEST 3: Assign Collection to Past Date"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Setup (if you can test this later):"
echo "  1. Change system date to Jan 25"
echo "  2. Current view: Jan 19-26"
echo "  3. Assign a collection to Jan 15 (before current view)"
echo ""
echo "Expected Result:"
echo "  ✅ View should change to Jan 15-22 (shows assigned date)"
echo "  ✅ Auto-scroll to Jan 15 and expand"
echo "  ✅ Console shows: 'adjusting to: 2026-01-15'"
echo ""
read -p "Can you test this later? (y/n/skip): " test3
echo ""

if [[ "$test3" == "y" ]]; then
    echo "✅ Test 3 NOTED - Test later when possible"
elif [[ "$test3" == "skip" ]]; then
    echo "⏭️  Test 3 SKIPPED - Not critical for now"
else
    echo "⚠️  Test 3 - Keep this in mind for edge case testing"
fi

echo ""
read -p "Press ENTER to continue to Test 4..."
clear

# Test 4: Compare with Meal Planner modal
echo "═══════════════════════════════════════════════════"
echo "TEST 4: Meal Planner Modal (Should Always Work)"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Setup:"
echo "  1. Go to Meal Planner tab"
echo "  2. Current view: Jan 19-26"
echo "  3. Click 'Assign Collection' button on ANY meal slot"
echo "  4. Select a collection and assign"
echo ""
echo "Expected Result:"
echo "  ✅ View should ALWAYS stay on Jan 19-26"
echo "  ✅ Never changes when using this modal"
echo "  ✅ Auto-scroll to assigned date"
echo ""
read -p "Did the Meal Planner modal work correctly? (y/n): " test4
echo ""

if [[ "$test4" == "y" ]]; then
    echo "✅ Test 4 PASSED"
else
    echo "❌ Test 4 FAILED"
    echo "   This should always work (wasn't changed in this fix)"
fi

echo ""
read -p "Press ENTER for summary..."
clear

# Summary
echo "╔═══════════════════════════════════════════════════╗"
echo "║         📊 Planner View Test Results             ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

passed=0
failed=0

[[ "$test1" == "y" ]] && ((passed++)) || ((failed++))
[[ "$test2" == "y" ]] && ((passed++)) || ((failed++))
[[ "$test3" == "skip" ]] && skip=1 || { [[ "$test3" == "y" ]] && ((passed++)) || ((failed++)); }
[[ "$test4" == "y" ]] && ((passed++)) || ((failed++))

echo "Test 1 (Assign Within View):    $([[ "$test1" == "y" ]] && echo "✅ PASS" || echo "❌ FAIL")"
echo "Test 2 (Assign to Future):      $([[ "$test2" == "y" ]] && echo "✅ PASS" || echo "❌ FAIL")"
echo "Test 3 (Assign to Past):        $([[ "$test3" == "skip" ]] && echo "⏭️  SKIP" || ([[ "$test3" == "y" ]] && echo "✅ NOTED" || echo "⚠️  LATER"))"
echo "Test 4 (Meal Planner Modal):    $([[ "$test4" == "y" ]] && echo "✅ PASS" || echo "❌ FAIL")"
echo ""
echo "───────────────────────────────────────────────────"

if [[ $failed -eq 0 ]]; then
    echo "🎉 PLANNER VIEW FIX WORKING!"
    echo ""
    echo "✅ View preservation works correctly"
    echo "✅ Today stays visible when appropriate"
    echo "✅ Auto-scroll and expand work as expected"
else
    echo "⚠️  SOME TESTS FAILED"
    echo ""
    [[ "$test1" != "y" ]] && echo "  - Fix: Assign within current view"
    [[ "$test2" != "y" ]] && echo "  - Fix: Keep today visible for future dates"
    [[ "$test4" != "y" ]] && echo "  - Fix: Meal Planner modal (regression?)"
    echo ""
    echo "Check console logs for debug messages:"
    echo "  - 'Assigned date within current view, keeping view'"
    echo "  - 'Assigned date outside view, adjusting to'"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo ""
echo "Next: Test the collection inclusion in shopping list"
echo "Run: ./test-desktop-interactive.sh"
