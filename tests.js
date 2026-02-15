#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');

function loadEngine() {
  global.window = undefined;
  global.globalThis = global;
  vm.runInThisContext(fs.readFileSync('./taxModel.js', 'utf8'));
  vm.runInThisContext(fs.readFileSync('./taxEngine.js', 'utf8'));
  if (!global.TaxEngine) throw new Error('TaxEngine failed to load.');
}

function run(input) {
  return TaxEngine.run(input, {});
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function baseInput(overrides) {
  return {
    apStart: '2024-04-01',
    apEnd: '2025-03-31',
    assocCompanies: 0,
    turnover: 0,
    govtGrants: 0,
    rentalIncome: 0,
    interestIncome: 0,
    dividendIncome: 0,
    costOfSales: 0,
    staffCosts: 0,
    depreciation: 0,
    otherCharges: 0,
    disallowableExpenses: 0,
    otherAdjustments: 0,
    aiaAdditions: 0,
    tradingLossBF: 0,
    propertyLossBF: 0,
    ...overrides
  };
}

function keyOf(input) {
  return [
    input.apStart,
    input.apEnd,
    `assoc=${input.assocCompanies}`,
    `turnover=${input.turnover}`,
    `div=${input.dividendIncome}`
  ].join('|');
}

function runMatrix() {
  const profiles = {
    single_fy_no_straddle: { apStart: '2024-04-01', apEnd: '2025-03-31', expectSplit: false, expectStraddle: false },
    straddle_no_split: { apStart: '2023-07-01', apEnd: '2024-06-29', expectSplit: false, expectStraddle: true },
    split_and_straddle: { apStart: '2024-01-01', apEnd: '2025-06-30', expectSplit: true, expectStraddle: true }
  };
  const assocOptions = [0, 3];
  const turnoverOptions = [45000, 120000];
  const dividendOptions = [0, 15000];

  const rows = [];
  for (const [profileName, profile] of Object.entries(profiles)) {
    for (const assocCompanies of assocOptions) {
      for (const turnover of turnoverOptions) {
        for (const dividendIncome of dividendOptions) {
          const input = baseInput({ ...profile, assocCompanies, turnover, dividendIncome });
          const out = run(input);
          rows.push({ profileName, input, out });
        }
      }
    }
  }
  return rows;
}

function checkCoreRules(rows) {
  for (const row of rows) {
    const { profileName, input, out } = row;
    const result = out.result;

    assert(
      result.computation.augmentedProfits === result.computation.taxableTotalProfits + input.dividendIncome,
      `Augmented profit mismatch: ${keyOf(input)}`
    );
    assert(
      result.accounts.totalIncome === input.turnover + input.govtGrants + input.rentalIncome + input.interestIncome,
      `Dividend leaked into taxable income: ${keyOf(input)}`
    );

    if (profileName === 'single_fy_no_straddle') {
      assert(result.metadata.ap_split === false, `Unexpected AP split for single FY: ${keyOf(input)}`);
      assert(result.byFY.length === 1, `Unexpected FY straddle for single FY: ${keyOf(input)}`);
    }
    if (profileName === 'straddle_no_split') {
      assert(result.metadata.ap_split === false, `Unexpected AP split for straddle-no-split: ${keyOf(input)}`);
      assert(result.byFY.length >= 2, `Expected FY straddle but got one slice: ${keyOf(input)}`);
    }
    if (profileName === 'split_and_straddle') {
      assert(result.metadata.ap_split === true, `Expected AP split for >12 months: ${keyOf(input)}`);
      assert((result.metadata.periods || []).length === 2, `Expected 2 AP periods: ${keyOf(input)}`);
      assert(result.byFY.length >= 2, `Expected multiple FY slices: ${keyOf(input)}`);
    }
  }
}

function checkCombinations(rows) {
  const byKey = new Map(rows.map((r) => [keyOf(r.input), r]));

  for (const row of rows) {
    const noDivKey = keyOf({ ...row.input, dividendIncome: 0 });
    const withDivKey = keyOf({ ...row.input, dividendIncome: 15000 });
    const noDiv = byKey.get(noDivKey);
    const withDiv = byKey.get(withDivKey);
    if (!noDiv || !withDiv) continue;

    assert(
      noDiv.out.result.computation.taxableTotalProfits === withDiv.out.result.computation.taxableTotalProfits,
      `Taxable profits changed when only dividend changed: ${keyOf(row.input)}`
    );
  }

  for (const profileName of ['single_fy_no_straddle', 'straddle_no_split', 'split_and_straddle']) {
    for (const turnover of [45000, 120000]) {
      for (const dividendIncome of [0, 15000]) {
        const assoc0 = byKey.get(keyOf(baseInput({
          ...({ single_fy_no_straddle: { apStart: '2024-04-01', apEnd: '2025-03-31' }, straddle_no_split: { apStart: '2023-07-01', apEnd: '2024-06-29' }, split_and_straddle: { apStart: '2024-01-01', apEnd: '2025-06-30' } }[profileName]),
          assocCompanies: 0,
          turnover,
          dividendIncome
        })));
        const assoc3 = byKey.get(keyOf(baseInput({
          ...({ single_fy_no_straddle: { apStart: '2024-04-01', apEnd: '2025-03-31' }, straddle_no_split: { apStart: '2023-07-01', apEnd: '2024-06-29' }, split_and_straddle: { apStart: '2024-01-01', apEnd: '2025-06-30' } }[profileName]),
          assocCompanies: 3,
          turnover,
          dividendIncome
        })));
        if (!assoc0 || !assoc3) continue;

        const minLower0 = Math.min(...assoc0.out.result.byFY.map((x) => x.thresholds.small_threshold_for_AP_in_this_FY));
        const minLower3 = Math.min(...assoc3.out.result.byFY.map((x) => x.thresholds.small_threshold_for_AP_in_this_FY));
        assert(minLower3 < minLower0, `Associated companies did not reduce thresholds: ${profileName}|turnover=${turnover}|div=${dividendIncome}`);
      }
    }
  }

  const mrOnly = rows.find((r) =>
    r.profileName === 'single_fy_no_straddle' &&
    r.input.assocCompanies === 0 &&
    r.input.turnover === 120000 &&
    r.input.dividendIncome === 0
  );
  assert(mrOnly && mrOnly.out.result.tax.marginalRelief > 0, 'Expected MR case not found (single FY).');

  const fullCombo = rows.find((r) =>
    r.profileName === 'split_and_straddle' &&
    r.input.assocCompanies === 3 &&
    r.input.turnover === 45000 &&
    r.input.dividendIncome === 15000
  );
  assert(fullCombo, 'Full combination case missing.');
  assert(fullCombo.out.result.metadata.ap_split === true, 'Full combination should split AP.');
  assert(fullCombo.out.result.byFY.length >= 2, 'Full combination should straddle FYs.');
  assert(fullCombo.out.result.tax.marginalRelief > 0, 'Full combination should trigger marginal relief.');

  const fullComboNoDiv = run(baseInput({
    apStart: '2024-01-01',
    apEnd: '2025-06-30',
    assocCompanies: 3,
    turnover: 45000,
    dividendIncome: 0
  }));
  assert(
    fullComboNoDiv.result.computation.taxableTotalProfits === fullCombo.out.result.computation.taxableTotalProfits,
    'Dividend changed taxable profits in full combination case.'
  );
  assert(
    fullComboNoDiv.result.tax.corporationTaxCharge !== fullCombo.out.result.tax.corporationTaxCharge,
    'Dividend did not affect CT rate/charge in full combination case.'
  );
}

function checkTwelveMonthBoundary() {
  // Exact 12-month AP that is 366 days (leap year) must NOT be split.
  const leapYearTwelveMonths = run(baseInput({
    apStart: '2024-01-01',
    apEnd: '2024-12-31',
    assocCompanies: 0,
    turnover: 100000,
    dividendIncome: 0
  }));

  assert(
    leapYearTwelveMonths.inputs.apDays === 366,
    'Expected 366 days for 2024-01-01 to 2024-12-31.'
  );
  assert(
    leapYearTwelveMonths.result.metadata.ap_split === false,
    'Exact 12-month leap-year AP should not split.'
  );
  assert(
    (leapYearTwelveMonths.result.metadata.periods || []).length === 1,
    'Exact 12-month leap-year AP should have one period.'
  );
}

function checkIncomeNotDoubleCounted() {
  const input = baseInput({
    apStart: '2024-04-01',
    apEnd: '2025-03-31',
    turnover: 100000,
    govtGrants: 5000,
    rentalIncome: 20000,
    propertyLossBF: 3000,
    interestIncome: 4000,
    dividendIncome: 7000,
    costOfSales: 25000,
    staffCosts: 15000,
    depreciation: 2000,
    otherCharges: 3000,
    disallowableExpenses: 1000,
    otherAdjustments: 500,
    aiaAdditions: 4000,
    tradingLossBF: 2000
  });

  const out = run(input);
  const r = out.result;

  const expectedTotalIncome = input.turnover + input.govtGrants + input.rentalIncome + input.interestIncome;
  assert(r.accounts.totalIncome === expectedTotalIncome, 'Total income mismatch with source fields.');

  const expectedNetProperty = Math.max(0, input.rentalIncome - input.propertyLossBF);
  assert(r.property.propertyProfitAfterLossOffset === expectedNetProperty, 'Net property income mismatch.');

  const recomposedTTP =
    r.computation.taxableTradingProfit +
    input.interestIncome +
    r.property.propertyProfitAfterLossOffset;

  assert(
    r.computation.taxableTotalProfits === recomposedTTP,
    'Taxable Total Profits is not equal to trading + interest + net property (possible double counting).'
  );

  assert(
    r.computation.augmentedProfits === r.computation.taxableTotalProfits + input.dividendIncome,
    'Augmented profits mismatch in non-trading income scenario.'
  );
}

function printSummary(rows) {
  console.log('HMRC v2 test matrix summary');
  console.log('profile | assoc | turnover | dividend | days | split | fy_slices | MR | CT');
  for (const row of rows) {
    const r = row.out.result;
    console.log([
      row.profileName,
      row.input.assocCompanies,
      row.input.turnover,
      row.input.dividendIncome,
      row.out.inputs.apDays,
      r.metadata.ap_split ? 'Y' : 'N',
      r.byFY.length,
      r.tax.marginalRelief,
      r.tax.corporationTaxCharge
    ].join(' | '));
  }
}

function main() {
  loadEngine();
  const rows = runMatrix();
  checkCoreRules(rows);
  checkCombinations(rows);
  checkTwelveMonthBoundary();
  checkIncomeNotDoubleCounted();
  printSummary(rows);
  console.log('\nPASS: all matrix checks passed.');
}

try {
  main();
} catch (err) {
  console.error('FAIL:', err.message);
  process.exitCode = 1;
}
