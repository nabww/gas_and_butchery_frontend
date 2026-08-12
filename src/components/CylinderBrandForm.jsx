import { useEffect, useState } from "react";
import {
  getCylinderBrands,
  createCylinderBrand,
  updateCylinderBrand,
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
  const [filledQty, setFilledQty] = useState(defaults.filled_qty ?? '0');
  const [emptyQty, setEmptyQty] = useState(defaults.empty_qty ?? '0');
  const [lowStockThreshold, setLowStockThreshold] = useState(
    defaults.low_stock_threshold ?? '3',
  );
  const [isActive, setIsActive] = useState(Boolean(defaults.is_active));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

    if (!Number.isFinite(weight) || weight <= 0) {
      setError('Weight must be a positive number');
      return;
    }
    if (!Number.isFinite(refill) || refill < 0) {
      setError('Refill price must be valid');
      return;
    }
    if (!Number.isFinite(cylinder) || cylinder < 0) {
      setError('Cylinder value must be valid');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (editing) {
        const payload = {
          brand: brand.trim(),
          weight_kg: weight,
          refill_price: refill,
          cylinder_value: cylinder,
          low_stock_threshold: Number(lowStockThreshold || 0),
          filled_qty: Number(filledQty || 0),
          empty_qty: Number(emptyQty || 0),
          is_active: isActive,
        };
        await updateCylinderBrand(editing.cylinder_brand_id, payload, activeLocationId);
      } else if (isNewBrand) {
        const payload = {
          brand: brand.trim(),
          weight_kg: weight,
          refill_price: refill,
          cylinder_value: cylinder,
          low_stock_threshold: Number(lowStockThreshold || 0),
          filled_qty: Number(filledQty || 0),
          empty_qty: Number(emptyQty || 0),
          is_active: isActive,
        };
        await createCylinderBrand(payload, activeLocationId);
      } else {
        const selected = existingBrands.find(
          (b) => String(b.id) === selectedBrandId,
        );
        if (!selected) {
          setError('Please select an existing brand');
          setSaving(false);
          return;
        }
        const payload = {
          filled_qty: Number(filledQty || 0),
          empty_qty: Number(emptyQty || 0),
          low_stock_threshold: Number(lowStockThreshold || 0),
          is_active: isActive,
        };
        await updateCylinderBrand(selected.id, payload, activeLocationId);
      }

      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save cylinder brand');
    } finally {
      setSaving(false);
    }
  };

  const isBrandLocked = !isNewBrand && !editing;
  const isPropertyReadOnly = isBrandLocked;
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
              Refill price
            </label>
            <input
              className={inputClass}
              type='number'
              min='0'
              step='0.01'
              value={refillPrice}
              onChange={(e) => setRefillPrice(e.target.value)}
              disabled={isPropertyReadOnly}
            />
          </div>
          <div>
            <label className='text-textMuted text-xs block mb-1'>
              Cylinder value
            </label>
            <input
              className={inputClass}
              type='number'
              min='0'
              step='0.01'
              value={cylinderValue}
              onChange={(e) => setCylinderValue(e.target.value)}
              disabled={isPropertyReadOnly}
            />
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
        </div>
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
