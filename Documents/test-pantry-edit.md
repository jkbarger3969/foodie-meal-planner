# Pantry Edit Fix Applied

## Issue
When editing pantry items (especially those added via iPhone scanner), the fields Unit, QtyNum, and QtyText could not be edited and changes were not saved.

## Root Cause
**Parameter name case mismatch:**
- Frontend sends: `ItemId`, `Name`, `QtyNum`, `Unit`, `QtyText`, `StoreId`, `Notes`
- API expected: `itemId`, `name`, `qtyNum`, `unit`, `qtyText`, `storeId`, `notes`

Result: API received undefined values for all fields except name, so updates failed silently.

## Fix Applied
Updated `upsertPantryItem()` in `src/main/api.js` (lines 2311-2330) to accept BOTH cases:

```javascript
const itemId = String(payload && (payload.itemId || payload.ItemId) || '').trim()
const name = String(payload && (payload.name || payload.Name) || '').trim()
const qtyText = String(payload && (payload.qtyText || payload.QtyText) || '').trim()
const qtyNum = (payload.qtyNum !== null ? Number(payload.qtyNum) : 
                payload.QtyNum !== null ? Number(payload.QtyNum) : null)
const unit = String(payload && (payload.unit || payload.Unit) || '').trim()
const storeId = String(payload && (payload.storeId || payload.StoreId) || '').trim()
const expiresAt = String(payload && (payload.expiresAt || payload.expiration_date) || '').trim()
const minQty = (payload.minQty || payload.low_stock_threshold)
```

## Testing
1. Restart desktop app
2. Add item via iPhone scanner
3. Go to Pantry tab on desktop
4. Click "Edit" on the scanned item
5. Change QtyNum, Unit, and QtyText fields
6. Click Save
7. Verify changes persist in the list

All fields should now be editable and save correctly.
