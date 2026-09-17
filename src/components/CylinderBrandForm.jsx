import { useEffect, useState } from "react";
import {
  getCylinderBrands,
  createCylinderBrand,
  updateCylinderBrand,
  recordStockTake,
} from "../lib/api";
import { useActiveLocation } from "../contexts/LocationContext";

const NEW_BRAND_VALUE = "new";
const inputClass =
  'w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm';

export default function CylinderBrandForm({ editing, onSaved, onCancel }) {
  const { activeLocationId } = useActiveLocation();
  const defaults = editing || {
    brand: '',
    weight_kg: '',
    refill_price: '',
    cylinder_value: '',
    filled_qty: '0',
    empty_qty: '0',
    low_stock_threshold: '3',
    is_active: true,
  };

  const [existingBrands, setExistingBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [isNewBrand, setIsNewBrand] = useState(false);
  const [brand, setBrand] = useState(defaults.brand || '');
  const [weightKg, setWeightKg] = useState(defaults.weight_kg ?? '');
  const [refillPrice, setRefillPrice] = useState(defaults.refill_price ?? '');
  const [cylinderValue, setCylinderValue] = useState(
    defaults.cylinder_value ?? '',
  );
  const [purchaseCost, setPurchaseCost] = useState(defaults.purchase_cost ?? '');
  const [refillCost, setRefillCost] = useState(defaults.refill_cost ?? '');
  const [filledQty, setFilledQty] = useState(defaults.filled_qty ?? '0');
  const [emptyQty, setEmptyQty] = useState(defaults.empty_qty ?? '0');
  const [lowStockThreshold, setLowStockThreshold] = useState(
    defaults.low_stock_threshold ?? '3',
  );
  const [isActive, setIsActive] = useState(Boolean(defaults.is_active));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Added quantities post an opening-stock expense at the brand's declared
  // buy prices (filled = refill_cost + shell, empty = shell cost).
  const [takePaymentMethod, setTakePaymentMethod] = useState('cash');

  useEffect(() => {
    let isMounted = true;
    async function loadBrands() {
      if (editing) return;
      setLoadingBrands(true);
      setError('');
      try {
        const brands = await getCylinderBrands(true, activeLocationId);
        if (isMounted) setExistingBrands(brands);
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load brands');
      } finally {
        if (isMounted) setLoadingBrands(false);
      }
    }
    loadBrands();
    return () => {
      isMounted = false;
    };
  }, [editing, activeLocationId]);

  useEffect(() => {
    if (editing) {
      setSelectedBrandId(String(editing.cylinder_brand_id || editing.id || ''));
      setIsNewBrand(false);
      setBrand(editing.brand || '');
      setWeightKg(editing.weight_kg ?? '');
      setRefillPrice(editing.refill_price ?? '');
      setCylinderValue(editing.cylinder_value ?? '');
      setPurchaseCost(editing.purchase_cost ?? '');
      setRefillCost(editing.refill_cost ?? '');
      setFilledQty(editing.filled_qty ?? '0');
      setEmptyQty(editing.empty_qty ?? '0');
      setLowStockThreshold(editing.low_stock_threshold ?? '3');
      setIsActive(Boolean(editing.is_active));
    }
  }, [editing]);

  const handleBrandSelect = (e) => {
    const value = e.target.value;
    if (value === NEW_BRAND_VALUE) {
      setSelectedBrandId(NEW_BRAND_VALUE);
      setIsNewBrand(true);
      setBrand('');
      setWeightKg('');
      setRefillPrice('');
      setCylinderValue('');
      setPurchaseCost('');
      setRefillCost('');
      setFilledQty('0');
      setEmptyQty('0');
      setLowStockThreshold('3');
      setIsActive(true);
    } else if (value) {
      const selected = existingBrands.find((b) => String(b.id) === value);
      if (selected) {
        setSelectedBrandId(value);
        setIsNewBrand(false);
        setBrand(selected.brand || '');
        setWeightKg(selected.weight_kg ?? '');
        setRefillPrice(selected.refill_price ?? '');
        setCylinderValue(selected.cylinder_value ?? '');
        setPurchaseCost(selected.purchase_cost ?? '');
        setRefillCost(selected.refill_cost ?? '');
        setFilledQty(String(selected.filled_qty ?? '0'));
        setEmptyQty(String(selected.empty_qty ?? '0'));
        setLowStockThreshold(String(selected.low_stock_threshold ?? '3'));
        setIsActive(Boolean(selected.is_active));
      }
    } else {
      setSelectedBrandId('');
      setIsNewBrand(false);
      setBrand('');
      setWeightKg('');
      setRefillPrice('');
      setCylinderValue('');
      setPurchaseCost('');
      setRefillCost('');
      setFilledQty('0');
      setEmptyQty('0');
      setLowStockThreshold('3');
      setIsActive(true);
    }
  };

  const submit = async () => {
    if (isNewBrand && !brand.trim()) {
      setError('Brand name is required');
      return;
    }

    const weight = Number(weightKg);
    const refill = Number(refillPrice);
    const cylinder = Number(cylinderValue);
    const purchase = Number(purchaseCost || 0);
    const refillBuy = Number(refillCost || 0);

    if (!Number.isFinite(weight) || weight <= 0) {
      setError('Weight must be a positive number');
      return;
    }
    if (!Number.isFinite(refill) || refill < 0) {
      setError('Customer refill price must be valid');
      return;
    }
    if (!Number.isFinite(cylinder) || cylinder < 0) {
      setError('Complete cylinder price must be valid');
      return;
    }
    if (!Number.isFinite(purchase) || purchase < 0 || !Number.isFinite(refillBuy) || refillBuy < 0) {
      setError('Purchase and refill costs must be valid numbers');
      return;
    }
    if (purchase < refillBuy) {
      setError('Complete cylinder purchase cost must be at least the gas refill cost — the shell cost can\'t be negative');
      return;
    }

    // Quantities being ADDED post an opening-stock expense at the cost entered
    // (empty shells default to the brand's cylinder value); reductions are
    // plain count corrections, not expenses. Added stock always has a cost —
    // require it so stock can't enter the books valueless.
    const selected = existingBrands.find((b) => String(b.id) === selectedBrandId);
    const base = editing || selected;
    const newFilled = Number(filledQty || 0);
    const newEmpty = Number(emptyQty || 0);
    const addedFilled = Math.max(0, newFilled - Number(base?.filled_qty || 0));
    const addedEmpty = Math.max(0, newEmpty - Number(base?.empty_qty || 0));

    // Buy prices are saved to the brand before the take runs, so the form's
    // entered costs are what the expense will book at — validate against them.
    if (addedFilled > 0 && !(refillBuy > 0)) {
      setError('Set the gas refill purchase cost — added filled stock is expensed at the declared buy prices');
      return;
    }
    if (addedEmpty > 0 && !(purchase - refillBuy > 0)) {
      setError('Set the purchase and refill costs — added empty shells are expensed at the declared shell cost');
      return;
    }

    setSaving(true);
    setError('');

    const buildTakeLines = (brandId) => {
      const lines = [];
      if (addedFilled > 0) {
        lines.push({ kind: 'cylinder_filled', cylinder_brand_id: brandId, quantity: addedFilled, unit_cost: 0 });
      }
      if (addedEmpty > 0) {
        lines.push({ kind: 'cylinder_empty', cylinder_brand_id: brandId, quantity: addedEmpty, unit_cost: 0 });
      }
      return lines;
    };

    const brandPayload = {
      brand: brand.trim(),
      weight_kg: weight,
      refill_price: refill,
      cylinder_value: cylinder,
      purchase_cost: purchase,
      refill_cost: refillBuy,
      low_stock_threshold: Number(lowStockThreshold || 0),
      is_active: isActive,
    };

    try {
      if (isNewBrand) {
        const stockRows = await createCylinderBrand(
          { ...brandPayload, filled_qty: 0, empty_qty: 0 },
          activeLocationId,
        );
        const created = (stockRows || []).find(
          (row) => row.brand === brand.trim() && Number(row.weight_kg) === weight,
        );
        if (!created) throw new Error('Brand was created but could not be located for stock take');
        const takeLines = buildTakeLines(created.cylinder_brand_id);
        if (takeLines.length) {
          await recordStockTake({ location_id: activeLocationId, payment_method: takePaymentMethod, lines: takeLines });
        }
        await updateCylinderBrand(created.cylinder_brand_id, { filled_qty: newFilled, empty_qty: newEmpty }, activeLocationId);
      } else {
        const brandId = editing ? editing.cylinder_brand_id : selected.id;
        // Save the declared buy prices first so the stock take below books
        // additions at the just-entered costs, not the stale stored ones.
        await updateCylinderBrand(brandId, brandPayload, activeLocationId);
        const takeLines = buildTakeLines(brandId);
        if (takeLines.length) {
          await recordStockTake({ location_id: activeLocationId, payment_method: takePaymentMethod, lines: takeLines });
        }
        await updateCylinderBrand(brandId, { filled_qty: newFilled, empty_qty: newEmpty }, activeLocationId);
      }

      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save cylinder brand');
    } finally {
      setSaving(false);
    }
  };

  const isBrandLocked = !isNewBrand && !editing;
  // Prices stay editable when adding stock to an existing brand — refill price
  // and shell value change over time without needing a full brand edit.
  const title = editing
    ? 'Edit cylinder brand'
    : isNewBrand
      ? 'Add new cylinder brand'
      : selectedBrandId
        ? 'Add stock to existing brand'
        : 'Add cylinder brand';

  const buttonLabel = saving
    ? editing
      ? 'Updating...'
      : isNewBrand
        ? 'Creating...'
        : 'Adding stock...'
    : editing
      ? 'Update cylinder'
      : isNewBrand
        ? 'Create cylinder'
        : 'Add stock';

  const hasSelection = editing || isNewBrand || selectedBrandId;

  // Live preview of what's being added vs the current count — additions can
  // carry a cost (posted as an opening-stock expense).
  const selectedNow = existingBrands.find((b) => String(b.id) === selectedBrandId);
  const baseNow = editing || selectedNow;
  const previewAddedFilled = Math.max(0, Number(filledQty || 0) - Number(baseNow?.filled_qty || 0));
  const previewAddedEmpty = Math.max(0, Number(emptyQty || 0) - Number(baseNow?.empty_qty || 0));
  const showTakeFields = previewAddedFilled > 0 || previewAddedEmpty > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!saving && hasSelection) submit();
      }}
      className='rounded-2xl bg-surface2 border border-borderColor p-4 space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <p className='text-textPrimary text-sm font-semibold'>{title}</p>
        {editing && (
          <button
            type='button'
            onClick={onCancel}
            className='px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary'>
            Cancel
          </button>
        )}
      </div>

      {!editing && (
        <div>
          <label className='text-textMuted text-xs block mb-1'>
            Select brand
          </label>
          <select
            className={inputClass}
            value={selectedBrandId}
            onChange={handleBrandSelect}
            disabled={loadingBrands || saving}>
            <option value=''>
              {loadingBrands ? 'Loading brands...' : '-- Select a brand --'}
            </option>
            {existingBrands.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.brand} {b.weight_kg}kg
                {Number(b.filled_qty) > 0 || Number(b.empty_qty) > 0
                  ? ' (stock exists)'
                  : ''}
              </option>
            ))}
            <option value={NEW_BRAND_VALUE}>+ Add new brand</option>
          </select>
        </div>
      )}

      {hasSelection && (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
          <div>
            <label className='text-textMuted text-xs block mb-1'>Brand</label>
            <input
              className={inputClass}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              disabled={isBrandLocked}
            />
          </div>
          <div>
            <label className='text-textMuted text-xs block mb-1'>
              Weight (kg)
            </label>
            <input
              className={inputClass}
              type='number'
              min='0'
              step='0.1'
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              disabled={isBrandLocked}
            />
          </div>
          <div>
            <label className='text-textMuted text-xs block mb-1'>
              Customer refill price (sell)
            </label>
            <input
              className={inputClass}
              type='number'
              min='0'
              step='0.01'
              value={refillPrice}
              onChange={(e) => setRefillPrice(e.target.value)}
            />
          </div>
          <div>
            <label className='text-textMuted text-xs block mb-1'>
              Complete cylinder price (sell)
            </label>
            <input
              className={inputClass}
              type='number'
              min='0'
              step='0.01'
              value={cylinderValue}
              onChange={(e) => setCylinderValue(e.target.value)}
            />
          </div>
          <div>
            <label className='text-textMuted text-xs block mb-1'>
              Complete cylinder purchase cost (buy)
            </label>
            <input
              className={inputClass}
              type='number'
              min='0'
              step='0.01'
              value={purchaseCost}
              onChange={(e) => setPurchaseCost(e.target.value)}
            />
          </div>
          <div>
            <label className='text-textMuted text-xs block mb-1'>
              Gas refill purchase cost (buy)
            </label>
            <input
              className={inputClass}
              type='number'
              min='0'
              step='0.01'
              value={refillCost}
              onChange={(e) => setRefillCost(e.target.value)}
            />
          </div>
          <div className='md:col-span-2 text-textMuted text-xs'>
            Shell cost: KES {Math.max(Number(purchaseCost || 0) - Number(refillCost || 0), 0).toFixed(2)}
            {' · '}Shell sell value: KES {Math.max(Number(cylinderValue || 0) - Number(refillPrice || 0), 0).toFixed(2)}
          </div>
          <div>
            <label className='text-textMuted text-xs block mb-1'>
              Filled stock
            </label>
            <input
              className={inputClass}
              type='number'
              min='0'
              value={filledQty}
              onChange={(e) => setFilledQty(e.target.value)}
            />
          </div>
          <div>
            <label className='text-textMuted text-xs block mb-1'>
              Empty stock
            </label>
            <input
              className={inputClass}
              type='number'
              min='0'
              value={emptyQty}
              onChange={(e) => setEmptyQty(e.target.value)}
            />
          </div>
          <div>
            <label className='text-textMuted text-xs block mb-1'>
              Low-stock threshold
            </label>
            <input
              className={inputClass}
              type='number'
              min='0'
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
            />
          </div>
          <div className='flex items-center pt-6'>
            <label className='flex items-center gap-2 text-xs text-textSecondary'>
              <input
                type='checkbox'
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
          </div>

          {showTakeFields && (
            <div>
              <label className='text-textMuted text-xs block mb-1'>
                Paid by
              </label>
              <select
                className={inputClass}
                value={takePaymentMethod}
                onChange={(e) => setTakePaymentMethod(e.target.value)}>
                <option value='cash'>Cash</option>
                <option value='mpesa'>M-Pesa</option>
                <option value='account'>On account</option>
              </select>
            </div>
          )}
        </div>
      )}

      {showTakeFields && (
        <p className='text-textMuted text-xs'>
          Quantities added above the current count are recorded as an
          opening-stock expense at the brand's declared buy prices — filled
          cylinders at gas cost plus shell cost, empty shells at the shell
          cost. Reducing a count is a correction — no expense.
        </p>
      )}

      {!hasSelection && !editing && (
        <p className='text-textMuted text-xs'>
          Select an existing brand or choose &quot;Add new brand&quot; to
          continue.
        </p>
      )}

      {error && <p className='text-danger text-xs font-semibold'>{error}</p>}

      <div className='flex gap-2'>
        <button
          type='submit'
          disabled={saving || !hasSelection}
          className='px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50'>
          {buttonLabel}
        </button>
      </div>
    </form>
  );
}
