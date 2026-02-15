# HMRC v2 Test Matrix

`tests.js` covers all core combinations requested:

- Straddling periods
- Marginal relief
- Associated companies (dependent companies divisor effect)
- Dividend impacts rate banding but is not taxable
- Combined scenarios where all of the above interact

## Profiles

1. `single_fy_no_straddle`
2. `straddle_no_split`
3. `split_and_straddle` (> 12 months, two AP periods)

## Dimensions

1. Associated companies: `0`, `3`
2. Turnover/profit proxy: `45,000`, `120,000`
3. Dividend: `0`, `15,000`

Total matrix size: `3 x 2 x 2 x 2 = 24 cases`.

## Assertions

1. `augmentedProfits = taxableTotalProfits + dividendIncome`
2. `totalIncome` excludes dividend
3. Expected AP split behavior by profile
4. Expected FY straddling behavior by profile
5. Taxable profits unchanged when only dividend changes
6. Thresholds reduce when associated companies increase
7. Marginal relief appears in expected baseline MR case
8. Full-combination case passes:
   `split + straddle + associated companies + dividend + MR`
9. In full-combination pair (`dividend=0` vs `dividend>0`):
   taxable profits stay the same, CT charge changes

## Run

```bash
node tests.js
```

If `node` is unavailable in your environment, run the same command on any machine with Node.js installed.
