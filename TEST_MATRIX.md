# Complete Tax Calculation Test Matrix

## Critical Interactions to Verify

### 1. **Dividends + Tax Rate Banding (No Straddling)**
- Dividend increases augmented profit, pushing into MR band
- Dividend increases effective tax rate (MR relief cost)
- BUT dividend is NOT in taxable profit

**Test 1A: Profit £100k, No Dividend**
- Turnover: 100000, Expenses: 0, Dividend: 0
- 365 days, No associates
- Expected: Augmented = £100k → MR applies → CT should be less than 25%

**Test 1B: Profit £100k, WITH £100k Dividend**
- Turnover: 100000, Expenses: 0, Dividend: 100000
- 365 days, No associates
- Expected: Taxable = £100k (unchanged), Augmented = £200k → MR applies → CT% goes UP due to less relief available

---

### 2. **Dividend + Straddling Period**
- Dividend should be pro-rated across periods
- Each period gets own MR calculation based on its augmented profit

**Test 2A: Profit £200k over 548 days, Dividend £100k**
- Turnover: 200000, Expenses: 0, Dividend: 100000
- 548 days split (365 + 183), No associates
- Expected: Period 1 gets ~£130,657 dividend, Period 2 gets ~£69,343 dividend
- Period 1 MR based on (trading + div), Period 2 MR based on (trading + div)

---

### 3. **Interest Income + Straddling Period**
- Interest is separately taxed but NOT at differential rates
- Interest should be pro-rated across periods when AP splits
- Interest affects TOTAL taxable profits (not just trading)

**Test 3A: Trading £200k + Interest £100k over 548 days**
- Turnover: 200000, Interest: 100000, Expenses: 0, No Dividend, No Associates
- 548 days split
- Expected: Total taxable = £300k, split across 2 periods
- Period 1: ~£200k + ~£65k interest = ~£265k taxable, threshold applies
- Period 2: ~£100k + ~£35k interest = ~£135k taxable, threshold applies

---

### 4. **Property Revenue + Loss Offset + Straddling**
- Property loss bf offsets against rental income (same period only)
- Remaining property profit gets added to taxable total
- Should be pro-rated across periods

**Test 4A: Trading £200k + Rental £100k, Loss BF £40k, over 548 days**
- Turnover: 200000, Rental: 100000, Rental Loss BF: 40000, Expenses: 0
- 548 days split
- Expected: Property profit = £100k - £40k = £60k
- Total taxable = £200k + £60k = £260k split across periods
- Period 1: ~£174k + ~£40k property = ~£214k
- Period 2: ~£87k + ~£20k property = ~£107k

---

### 5. **Dividend + Associates (affects thresholds, not dividend)**
- Associates divide thresholds (£50k/div, £250k/div)
- Dividend NOT affected by associates
- Augmented profit = taxable + dividend (full amount, no divisor)

**Test 5A: Profit £100k + Dividend £50k, 2 Associates (div=3)**
- Turnover: 100000, Dividend: 50000, Expenses: 0
- 365 days, Associates: 2
- Expected: Thresholds = £16.67k and £83.33k
- Taxable = £100k, Augmented = £150k
- Augmented > £83.33k → main rate applies

---

### 6. **Interest + Associates + Straddling (complex interaction)**
- Interest gets taxed at normal rates
- Thresholds are divided by associates
- Interest is pro-rated across periods
- Each period recalculates with reduced thresholds

**Test 6A: Trading £150k + Interest £75k, 2 Associates, 548 days**
- Turnover: 150000, Interest: 75000, Expenses: 0, Dividend: 0, Associates: 2
- 548 days split
- Expected: Divisor = 3, thresholds = £16.67k / £83.33k
- Total taxable = £225k split across periods with small thresholds

---

### 7. **Depreciation Add-back + Straddling**
- Depreciation is added back (not deductible)
- Should be pro-rated across periods when AP splits

**Test 7A: Trading £200k (incl £30k depreciation) + 548 days**
- Turnover: 200000, Depreciation: 30000, Expenses: 170000 (other), Dividend: 0
- 548 days split
- Expected: PBT = £0 before add-back
- After add-back: ~£30k × (period.days/548) per period
- Period 1 gets ~£19,618 (365/548), Period 2 gets ~£10,382 (183/548)

---

### 8. **Trading Loss Carry Forward + Straddling**
- Loss applied only in Period 1
- Period 2 does NOT get fresh loss offset

**Test 8A: Profit £150k, Loss BF £50k, 548 days**
- Turnover: 150000, Trading Loss BF: 50000, Expenses: 0
- 548 days split
- Expected: Period 1 gets £50k offset (applied only once)
- Period 1 taxable: £82.3k - £50k = £32.3k
- Period 2 taxable: £67.7k (no loss)
- Total: £100k (not £150k)

---

### 9. **AIA + Associates + Straddling (complex)**
- AIA cap divided by associates
- AIA cap allocated by FY days within period
- Each period claims against its allocated cap

**Test 9A: Trading £200k + AIA £600k, 2 Associates, 548 days**
- Turnover: 200000, AIA Additions: 600000, Associates: 2
- 548 days split
- Expected: AIA cap = £1m ÷ 3 = £333.33k
- Period 1 (365 days): Claim min(£219.18k AIA input, allocated cap)
- Period 2 (183 days): Claim min(£109.64k AIA input, allocated cap)
- After AIA: Taxable profit should be very low/zero

---

### 10. **Disallowable + Other Adjustments + Straddling**
- Both add-backs should be pro-rated across periods

**Test 10A: Trading £200k + Expenses £150k + Disallowable £20k + Adjustments £10k, 548 days**
- Turnover: 200000, Expenses: 150000, Disallowable: 20000, Other Adj: 10000
- 548 days split
- Expected: PBT = £50k
- Add-backs: £30k
- Adjusted profit = £80k split: Period 1 = ~£52.3k, Period 2 = ~£26.7k

---

### 11. **Everything Combined: The Ultimate Test**
All factors together in one scenario

**Test 11: Full Kitchen Sink**
```
Turnover:            £300,000
Rental Income:       £50,000
Interest Income:     £25,000
Dividend Income:     £50,000
Expenses:            £100,000
Depreciation:        £20,000
Other Charges:       £30,000
Disallowable:        £15,000
Other Adjustments:   £10,000
AIA Additions:       £200,000
Trading Loss BF:     £30,000
Rental Loss BF:      £10,000
Associates:          2
Period:              2023-01-01 to 2024-07-01 (548 days)
```

Expected Logic Flow:
1. P&L: £300k - £150k = £150k PBT
2. Period split: Prd1 = £98.2k, Prd2 = £51.8k
3. Rental: (£50k - £10k) × days = £26.4k + £13.6k
4. Interest: £25k × days = £16.4k + £8.6k
5. Add-backs across periods: Depreciation + Disallowable + Adj
6. AIA: Allocated by FY, capped at £333k (÷3 divisor)
7. Loss: Prd1 only gets £30k offset
8. Threshold: £16.67k / £83.33k per FY
9. Dividend: Not in taxable, adds to augmented for rate
10. Final: Each FY calculates MR independently

---

## Verification Checklist

- [ ] Test 1A: Dividend increases CT rate
- [ ] Test 1B: Dividend NOT in taxable (£100k), IS in augmented (£200k)
- [ ] Test 2A: Dividend pro-rated across periods
- [ ] Test 3A: Interest pro-rated, taxable total includes interest
- [ ] Test 4A: Property loss offset works, profit pro-rated
- [ ] Test 5A: Associates divisor NOT applied to dividend
- [ ] Test 6A: Interest + associates + straddling all interact correctly
- [ ] Test 7A: Depreciation add-back pro-rated
- [ ] Test 8A: Loss only applied to Period 1
- [ ] Test 9A: AIA cap divided and allocated correctly
- [ ] Test 10A: All add-backs pro-rated
- [ ] Test 11: Full scenario works end-to-end
