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
    disposalGains: 0,
    capitalGains: 0,
    dividendIncome: 0,
    costOfSales: 0,
    staffCosts: 0,
    depreciation: 0,
    otherCharges: 0,
    disallowableExpenses: 0,
    otherAdjustments: 0,
    aiaTradeAdditions: 0,
    aiaNonTradeAdditions: 0,
    aiaAdditions: 0,
    tradingLossBF: 0,
    tradingLossUseRequested: undefined,
    propertyLossBF: 0,
    ...overrides
  };
}

function checkFy2022Flat19Rate() {
  const out = run(baseInput({
    apStart: '2023-01-01',
    apEnd: '2023-12-31',
    assocCompanies: 0,
    turnover: 300000,
    dividendIncome: 0
  }));

  const fy2022Slice = (out.result.byFY || []).find((x) => {
    const years = Array.isArray(x.fy_years) ? x.fy_years : [x.fy_year];
    return years.includes(2022);
  });
  assert(!!fy2022Slice, 'Expected FY2022 slice/group for 2023-01-01 to 2023-12-31.');
  assert(
    Math.abs((fy2022Slice.main_rate || 0) - 0.19) < 1e-9,
    `FY2022 main rate should be 19%, got ${fy2022Slice.main_rate}`
  );
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
      result.accounts.totalIncome ===
        input.turnover +
        input.govtGrants +
        input.rentalIncome +
        input.interestIncome +
        input.disposalGains +
        input.capitalGains,
      `Dividend leaked into taxable income: ${keyOf(input)}`
    );

    if (profileName === 'single_fy_no_straddle') {
      assert(result.metadata.ap_split === false, `Unexpected AP split for single FY: ${keyOf(input)}`);
      assert(result.byFY.length === 1, `Unexpected FY straddle for single FY: ${keyOf(input)}`);
    }
    if (profileName === 'straddle_no_split') {
      assert(result.metadata.ap_split === false, `Unexpected AP split for straddle-no-split: ${keyOf(input)}`);
      assert(result.byFY.length >= 1, `Expected at least one tax slice: ${keyOf(input)}`);
    }
    if (profileName === 'split_and_straddle') {
      assert(result.metadata.ap_split === true, `Expected AP split for >12 months: ${keyOf(input)}`);
      assert((result.metadata.periods || []).length === 2, `Expected 2 AP periods: ${keyOf(input)}`);
      assert(result.byFY.length >= 1, `Expected at least one tax slice: ${keyOf(input)}`);
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
  assert(fullCombo.out.result.byFY.length >= 1, 'Full combination should have tax slices.');
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

function checkNoChangeRegimeCollapsesStraddle() {
  const out = run(baseInput({
    apStart: '2023-07-01',
    apEnd: '2024-06-29',
    assocCompanies: 0,
    turnover: 120000,
    dividendIncome: 0
  }));

  assert(out.result.metadata.ap_split === false, 'Expected no AP split for <=12 months.');
  assert(
    out.result.byFY.length === 1,
    'Expected one effective tax slice when regime is unchanged across FY boundary.'
  );
}

function checkShortPeriodThresholdProration() {
  const out = run(baseInput({
    apStart: '2024-04-01',
    apEnd: '2024-09-29',
    assocCompanies: 0,
    turnover: 120000,
    dividendIncome: 0
  }));

  assert(out.result.byFY.length === 1, 'Expected one slice for single-FY short period.');
  const th = out.result.byFY[0].thresholds || {};
  const expectedLower = 50000 * (182 / 365);
  const expectedUpper = 250000 * (182 / 365);
  const lowerDiff = Math.abs((th.small_threshold_for_AP_in_this_FY || 0) - expectedLower);
  const upperDiff = Math.abs((th.upper_threshold_for_AP_in_this_FY || 0) - expectedUpper);

  assert(lowerDiff < 1, `Short-period lower threshold not pro-rated correctly. diff=${lowerDiff}`);
  assert(upperDiff < 1, `Short-period upper threshold not pro-rated correctly. diff=${upperDiff}`);

  const outAssoc = run(baseInput({
    apStart: '2024-04-01',
    apEnd: '2024-09-29',
    assocCompanies: 3,
    turnover: 120000,
    dividendIncome: 0
  }));
  const thAssoc = outAssoc.result.byFY[0].thresholds || {};
  const expectedUpperAssoc = expectedUpper / 4;
  const upperAssocDiff = Math.abs((thAssoc.upper_threshold_for_AP_in_this_FY || 0) - expectedUpperAssoc);
  assert(upperAssocDiff < 1, `Associated-company divisor not applied to pro-rated upper threshold. diff=${upperAssocDiff}`);
}

function checkShortPeriodThresholdProrationLeapFY() {
  // FY2023 runs 2023-04-01 to 2024-03-31 and has 366 days.
  // HMRC-style short period example should use denominator 366, not 365.
  const out = run(baseInput({
    apStart: '2023-04-01',
    apEnd: '2023-12-31', // 275 days in FY2023
    assocCompanies: 0,
    turnover: 120000,
    dividendIncome: 0
  }));

  assert(out.result.byFY.length === 1, 'Expected one slice for single-FY leap-year short period.');
  const th = out.result.byFY[0].thresholds || {};
  const expectedLower366 = 50000 * (275 / 366);
  const expectedUpper366 = 250000 * (275 / 366);
  const expectedUpper365 = 250000 * (275 / 365);
  const lowerDiff = Math.abs((th.small_threshold_for_AP_in_this_FY || 0) - expectedLower366);
  const upperDiff = Math.abs((th.upper_threshold_for_AP_in_this_FY || 0) - expectedUpper366);
  const upperDiffFrom365 = Math.abs((th.upper_threshold_for_AP_in_this_FY || 0) - expectedUpper365);

  assert(lowerDiff < 1, `Leap-year short-period lower threshold should use /366. diff=${lowerDiff}`);
  assert(upperDiff < 1, `Leap-year short-period upper threshold should use /366. diff=${upperDiff}`);
  assert(upperDiffFrom365 > 100, 'Leap-year threshold appears to still be using /365.');

  const outAssoc = run(baseInput({
    apStart: '2023-04-01',
    apEnd: '2023-12-31',
    assocCompanies: 3,
    turnover: 120000,
    dividendIncome: 0
  }));
  const thAssoc = outAssoc.result.byFY[0].thresholds || {};
  const expectedUpperAssoc = expectedUpper366 / 4;
  const upperAssocDiff = Math.abs((thAssoc.upper_threshold_for_AP_in_this_FY || 0) - expectedUpperAssoc);
  assert(upperAssocDiff < 1, `Associated-company divisor not applied to leap-year upper threshold. diff=${upperAssocDiff}`);
}

function checkAiaProrationAndAssociates() {
  const base = baseInput({
    apStart: '2024-04-01',
    apEnd: '2024-09-29', // 182 days
    turnover: 300000,
    aiaAdditions: 10000000 // force cap to bind
  });

  const out0 = run({ ...base, assocCompanies: 0 });
  const expectedCap0 = 1000000 * (182 / 365);
  const claim0 = out0.result.computation.capitalAllowances;
  assert(Math.abs(claim0 - Math.round(expectedCap0)) <= 1, `AIA cap/claim mismatch (assoc=0). got=${claim0}`);

  const out3 = run({ ...base, assocCompanies: 3 });
  const expectedCap3 = expectedCap0 / 4;
  const claim3 = out3.result.computation.capitalAllowances;
  assert(Math.abs(claim3 - Math.round(expectedCap3)) <= 1, `AIA cap/claim mismatch (assoc=3). got=${claim3}`);

  const p0 = (out0.result.metadata.periods || [])[0] || {};
  const p3 = (out3.result.metadata.periods || [])[0] || {};
  assert(typeof p0.aia_cap_total === 'number', 'Missing period AIA cap metadata for assoc=0.');
  assert(typeof p3.aia_cap_total === 'number', 'Missing period AIA cap metadata for assoc=3.');
}

function checkAiaProrationLeapFY() {
  const base = baseInput({
    apStart: '2023-04-01',
    apEnd: '2023-12-31', // 275 days in FY2023 (366-day FY)
    turnover: 300000,
    aiaAdditions: 10000000 // force cap to bind
  });

  const out0 = run({ ...base, assocCompanies: 0 });
  const expectedCap366 = 1000000 * (275 / 366);
  const expectedCap365 = 1000000 * (275 / 365);
  const claim0 = out0.result.computation.capitalAllowances;
  assert(Math.abs(claim0 - Math.round(expectedCap366)) <= 1, `Leap-year AIA cap/claim should use /366 (assoc=0). got=${claim0}`);
  assert(Math.abs(claim0 - Math.round(expectedCap365)) > 100, 'Leap-year AIA appears to still be using /365.');

  const out3 = run({ ...base, assocCompanies: 3 });
  const expectedCap3 = expectedCap366 / 4;
  const claim3 = out3.result.computation.capitalAllowances;
  assert(Math.abs(claim3 - Math.round(expectedCap3)) <= 1, `Leap-year AIA cap/claim should use /366 with assoc divisor (assoc=3). got=${claim3}`);
}

function checkLossBfSequentialAcrossApPeriods() {
  const out = run(baseInput({
    apStart: '2024-01-01',
    apEnd: '2025-06-30', // >12 months, AP split expected
    assocCompanies: 0,
    turnover: 80000,
    tradingLossBF: 120000
  }));

  const periods = out.result.metadata.periods || [];
  assert(periods.length === 2, 'Expected two AP periods for loss split check.');
  const p1 = periods[0] || {};
  const p2 = periods[1] || {};
  const openingLoss = 120000;
  assert(Math.abs((p1.loss_pool || 0) - openingLoss) <= 1, 'Period 1 opening loss pool should equal full losses brought forward.');

  const expectedP2Pool = Math.max(0, (p1.loss_pool || 0) - (p1.loss_used || 0));
  assert(
    Math.abs((p2.loss_pool || 0) - expectedP2Pool) <= 1,
    'Period 2 opening loss pool should equal unused loss carried forward from Period 1.'
  );

  const daySplitPool = openingLoss * ((p1.days || 0) / (out.inputs.apDays || 1));
  assert(
    Math.abs((p1.loss_pool || 0) - daySplitPool) > 1000,
    'Loss pool appears day-apportioned instead of sequential carry-forward.'
  );
}

function checkPropertyLossBfSequentialAcrossApPeriods() {
  const openingPropertyLoss = 100000;
  const out = run(baseInput({
    apStart: '2024-01-01',
    apEnd: '2025-06-30', // >12 months, AP split expected
    assocCompanies: 0,
    turnover: 0,
    rentalIncome: 180000,
    propertyLossBF: openingPropertyLoss
  }));

  const periods = out.result.metadata.periods || [];
  assert(periods.length === 2, 'Expected two AP periods for property loss split check.');
  const p1 = periods[0] || {};
  const p2 = periods[1] || {};

  assert(
    Math.abs((p1.property_loss_pool || 0) - openingPropertyLoss) <= 1,
    'Period 1 opening property loss pool should equal full property loss b/fwd.'
  );

  const expectedP2Pool = Math.max(0, (p1.property_loss_pool || 0) - (p1.property_loss_used || 0));
  assert(
    Math.abs((p2.property_loss_pool || 0) - expectedP2Pool) <= 1,
    'Period 2 opening property loss pool should equal unused property loss from Period 1.'
  );

  const daySplitPool = openingPropertyLoss * ((p1.days || 0) / (out.inputs.apDays || 1));
  assert(
    Math.abs((p1.property_loss_pool || 0) - daySplitPool) > 1000,
    'Property loss pool appears day-apportioned instead of sequential carry-forward.'
  );
}

function checkLossUseRequestedCap() {
  const out = run(baseInput({
    apStart: '2024-04-01',
    apEnd: '2025-03-31',
    assocCompanies: 0,
    turnover: 200000,
    tradingLossBF: 120000,
    tradingLossUseRequested: 30000
  }));

  assert(
    out.result.computation.tradingLossUsed === 30000,
    'Trading loss usage should be capped by user-requested amount.'
  );
}

function checkDisposalAndCapitalGainsTaxable() {
  const out = run(baseInput({
    apStart: '2024-04-01',
    apEnd: '2025-03-31',
    assocCompanies: 0,
    turnover: 0,
    rentalIncome: 0,
    interestIncome: 0,
    disposalGains: 40000,
    capitalGains: 60000,
    dividendIncome: 0
  }));

  assert(out.result.accounts.totalIncome === 100000, 'Disposal/capital gains should be included in accounting income.');
  assert(out.result.computation.taxableTotalProfits === 100000, 'Disposal/capital gains should be taxable.');
}

function checkDisposalGainsClassifiedAsTradingForLossRelief() {
  const out = run(baseInput({
    apStart: '2024-04-01',
    apEnd: '2025-03-31',
    assocCompanies: 0,
    turnover: 0,
    disposalGains: 10000,
    capitalGains: 0,
    tradingLossBF: 10000,
    tradingLossUseRequested: 10000
  }));

  assert(
    out.result.computation.tradingLossUsed === 10000,
    'Trading loss should be able to offset disposal gains treated as trading balancing charges.'
  );
  assert(
    out.result.computation.taxableTotalProfits === 0,
    'Taxable profits should be nil when trading loss fully offsets disposal balancing charges.'
  );
}

function checkCapitalGainsRemainNonTradingForLossRelief() {
  const out = run(baseInput({
    apStart: '2024-04-01',
    apEnd: '2025-03-31',
    assocCompanies: 0,
    turnover: 0,
    disposalGains: 0,
    capitalGains: 10000,
    tradingLossBF: 10000,
    tradingLossUseRequested: 10000
  }));

  assert(
    out.result.computation.tradingLossUsed === 0,
    'Trading loss should not offset capital gains (non-trading).'
  );
  assert(
    out.result.computation.taxableTotalProfits === 10000,
    'Capital gains should remain taxable when there is no taxable trading profit.'
  );
}

function checkSeparateTradeNonTradeAiaBuckets() {
  const common = baseInput({
    apStart: '2024-04-01',
    apEnd: '2025-03-31',
    assocCompanies: 0,
    turnover: 100000,
    interestIncome: 0,
    rentalIncome: 100000,
    propertyLossBF: 0
  });

  const tradeOnly = run({
    ...common,
    aiaTradeAdditions: 100000,
    aiaNonTradeAdditions: 0,
    aiaAdditions: 0
  });
  const nonTradeOnly = run({
    ...common,
    aiaTradeAdditions: 0,
    aiaNonTradeAdditions: 100000,
    aiaAdditions: 0
  });
  const both = run({
    ...common,
    aiaTradeAdditions: 100000,
    aiaNonTradeAdditions: 100000,
    aiaAdditions: 0
  });

  const ttpTradeOnly = tradeOnly.result.computation.taxableTotalProfits;
  const ttpNonTradeOnly = nonTradeOnly.result.computation.taxableTotalProfits;
  const ttpBoth = both.result.computation.taxableTotalProfits;

  assert(ttpTradeOnly < 200000, 'Trade AIA should reduce total taxable profits.');
  assert(ttpNonTradeOnly < 200000, 'Rental/property AIA should reduce total taxable profits.');
  assert(ttpBoth <= Math.min(ttpTradeOnly, ttpNonTradeOnly), 'Both AIA buckets should not increase taxable profits.');
}

function checkAiaCanCreateLoss() {
  const out = run(baseInput({
    apStart: '2024-04-01',
    apEnd: '2025-03-31',
    assocCompanies: 0,
    turnover: 30000,
    aiaTradeAdditions: 100000,
    aiaNonTradeAdditions: 0,
    aiaAdditions: 0
  }));

  const p1 = ((out.result.metadata || {}).periods || [])[0] || {};
  assert((p1.trade_aia_claim || 0) > 30000, 'AIA claim should be allowed above current-period trade profit.');
  assert((p1.taxable_before_loss || 0) < 0, 'AIA should be able to create an overall period loss before loss relief.');
  assert(out.result.computation.taxableTotalProfits === 0, 'Negative period result should cap taxable total profits at 0.');
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
  const th = (leapYearTwelveMonths.result.byFY[0] || {}).thresholds || {};
  assert(
    Math.abs((th.small_threshold_for_AP_in_this_FY || 0) - 50000) < 1,
    'Exact 12-month period should use strict 50,000 lower threshold.'
  );
  assert(
    Math.abs((th.upper_threshold_for_AP_in_this_FY || 0) - 250000) < 1,
    'Exact 12-month period should use strict 250,000 upper threshold.'
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
    disposalGains: 2500,
    capitalGains: 1500,
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

  const expectedTotalIncome =
    input.turnover +
    input.govtGrants +
    input.rentalIncome +
    input.interestIncome +
    input.disposalGains +
    input.capitalGains;
  assert(r.accounts.totalIncome === expectedTotalIncome, 'Total income mismatch with source fields.');

  const expectedNetProperty = Math.max(0, input.rentalIncome - input.propertyLossBF);
  assert(r.property.propertyProfitAfterLossOffset === expectedNetProperty, 'Net property income mismatch.');

  const recomposedTTP =
    r.computation.taxableTradingProfit +
    input.interestIncome +
    input.capitalGains +
    r.property.propertyProfitAfterLossOffset;

  assert(
    r.computation.taxableTotalProfits === recomposedTTP,
    'Taxable Total Profits is not equal to trading + interest + capital gains + net property (possible double counting).'
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
  checkFy2022Flat19Rate();
  checkTwelveMonthBoundary();
  checkIncomeNotDoubleCounted();
  checkNoChangeRegimeCollapsesStraddle();
  checkShortPeriodThresholdProration();
  checkShortPeriodThresholdProrationLeapFY();
  checkAiaProrationAndAssociates();
  checkAiaProrationLeapFY();
  checkLossBfSequentialAcrossApPeriods();
  checkPropertyLossBfSequentialAcrossApPeriods();
  checkLossUseRequestedCap();
  checkDisposalAndCapitalGainsTaxable();
  checkDisposalGainsClassifiedAsTradingForLossRelief();
  checkCapitalGainsRemainNonTradingForLossRelief();
  checkSeparateTradeNonTradeAiaBuckets();
  checkAiaCanCreateLoss();
  printSummary(rows);
  console.log('\nPASS: all matrix checks passed.');
}

try {
  main();
} catch (err) {
  console.error('FAIL:', err.message);
  process.exitCode = 1;
}
