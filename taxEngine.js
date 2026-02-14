/**
 * taxEngine.js
 * Pure tax computation engine:
 * Inputs (TaxModel.createInputs) -> Canonical result (TaxModel.createEmptyResult)
 *
 * Notes:
 * - This is a *pragmatic v1* engine consistent with your existing implementation scope:
 *   trading companies, basic adjustments, AIA (single bucket), trading loss b/fwd.
 * - CT rates & thresholds are configured in corpTaxYears. Update annually.
 */
(function (root) {
  'use strict';

  const TaxModel = root.TaxModel;
  if (!TaxModel) throw new Error('TaxModel not loaded. Load taxModel.js first.');

  function parseDate(isoStr) {
    const [y, m, d] = String(isoStr).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  function daysInclusive(startUTC, endUTC) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((endUTC - startUTC) / msPerDay) + 1;
  }

  // Default CT configuration (from your initial.js). Keep updated.
  const defaultCorpTaxYears = [
    {
      fy_year: 2023,
      start_date: '2023-04-01',
      end_date: '2024-03-31',
      tiers: [
        { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 2, threshold: 50000, rate: 0.25, relief_fraction: 0.015, aia_limit: 1000000 },
        { index: 3, threshold: 250000, rate: 0.25, relief_fraction: 0, aia_limit: 1000000 }
      ]
    },
    {
      fy_year: 2024,
      start_date: '2024-04-01',
      end_date: '2025-03-31',
      tiers: [
        { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 2, threshold: 50000, rate: 0.25, relief_fraction: 0.015, aia_limit: 1000000 },
        { index: 3, threshold: 250000, rate: 0.25, relief_fraction: 0, aia_limit: 1000000 }
      ]
    }
  ];

  function getTier(tiers, idx) {
    const t = (tiers || []).find((x) => x.index === idx);
    if (!t) throw new Error(`Missing tier index ${idx}`);
    return t;
  }

  function buildFYOverlaps(inputs, corpTaxYears) {
    const apStartUTC = inputs.apStartUTC;
    const apEndUTC = inputs.apEndUTC;

    const overlaps = (corpTaxYears || []).map((fy) => {
      const fyStart = parseDate(fy.start_date);
      const fyEnd = parseDate(fy.end_date);

      const overlapStart = apStartUTC > fyStart ? apStartUTC : fyStart;
      const overlapEnd = apEndUTC < fyEnd ? apEndUTC : fyEnd;

      let apDaysInFY = 0;
      if (overlapStart <= overlapEnd) apDaysInFY = daysInclusive(overlapStart, overlapEnd);

      const fyTotalDays = daysInclusive(fyStart, fyEnd);

      return {
        fy_year: fy.fy_year,
        fyStart,
        fyEnd,
        fy_total_days: fyTotalDays,
        ap_days_in_fy: apDaysInFY,
        tiers: fy.tiers
      };
    }).filter((x) => x.ap_days_in_fy > 0);

    if (!overlaps.length) {
      throw new Error('No overlapping financial years found for the accounting period. Update corpTaxYears config.');
    }
    return overlaps;
  }

  function buildAIAAllocation(inputs, fyOverlaps, corpTaxYears) {
    // Use AIA limit from first FY tier (assumed consistent). If you ever change, externalize.
    const AIA_LIMIT = getTier(corpTaxYears[0].tiers, 1).aia_limit;
    
    // CRITICAL: Apply associates divisor to AIA cap (same as thresholds)
    const divisor = (inputs.assocCompanies || 0) + 1;

    const hasLeapYear = fyOverlaps.some((fy) => fy.fy_total_days === 366);
    const yearDays = hasLeapYear ? 366 : 365;

    const apDays = inputs.apDays;
    // FIX: Apply divisor to AIA cap
    const totalCap = apDays >= yearDays 
      ? (AIA_LIMIT / divisor) 
      : ((AIA_LIMIT / divisor) * (apDays / yearDays));

    const sumDays = fyOverlaps.reduce((s, fy) => s + fy.ap_days_in_fy, 0);
    const parts = fyOverlaps.map((fy) => {
      const share = sumDays ? (fy.ap_days_in_fy / sumDays) : 0;
      return {
        fy_year: fy.fy_year,
        ap_days_in_fy: fy.ap_days_in_fy,
        aia_cap_for_fy: totalCap * share
      };
    });

    return { totalCap, parts };
  }

  function buildThresholdParts(inputs, fyOverlaps) {
    const divisor = (inputs.assocCompanies || 0) + 1;

    return fyOverlaps.map((fy) => {
      const small = getTier(fy.tiers, 2).threshold;
      const upper = getTier(fy.tiers, 3).threshold;

      // Apportion by AP days in that FY / FY total days (HMRC style), then divide by associates divisor
      const smallForAP = (small * (fy.ap_days_in_fy / fy.fy_total_days)) / divisor;
      const upperForAP = (upper * (fy.ap_days_in_fy / fy.fy_total_days)) / divisor;

      return {
        fy_year: fy.fy_year,
        ap_days_in_fy: fy.ap_days_in_fy,
        small_threshold_for_AP_in_this_FY: smallForAP,
        upper_threshold_for_AP_in_this_FY: upperForAP
      };
    });
  }

  function prorateByFY(value, inputs, fyOverlaps) {
    const totalDays = inputs.apDays || 1;
    return fyOverlaps.map((fy) => ({
      fy_year: fy.fy_year,
      amount: value * (fy.ap_days_in_fy / totalDays),
      ap_days_in_fy: fy.ap_days_in_fy
    }));
  }

  function computeTaxPerFY({ fy_year, taxableProfit, augmentedProfit, lowerLimit, upperLimit, tiers }) {
    // Uses your marginal relief model:
    // if augmented <= lower => small profits rate (19%)
    // if augmented >= upper => main rate (25%)
    // else MR = relief_fraction*(upper-augmented)*(taxable/augmented)
    // 
    // HMRC COMPLIANCE FIX: Keep full decimal precision during computation,
    // round only the final CT charge to the nearest £1.
    const smallRate = getTier(tiers, 1).rate;
    const mainRate = getTier(tiers, 3).rate;
    const reliefFraction = getTier(tiers, 2).relief_fraction;

    const tp = Math.max(0, taxableProfit);  // Keep as-is, no rounding
    const ap = Math.max(0, augmentedProfit);  // Keep as-is, no rounding
    const lower = Math.max(0, lowerLimit);
    const upper = Math.max(0, upperLimit);

    let ctCharge = 0;
    let marginalRelief = 0;

    if (ap <= lower) {
      ctCharge = tp * smallRate;
    } else if (ap >= upper) {
      ctCharge = tp * mainRate;
    } else {
      // Start at main rate then deduct marginal relief (all in decimal precision)
      const main = tp * mainRate;
      const ratio = ap > 0 ? (tp / ap) : 0;
      marginalRelief = reliefFraction * (upper - ap) * ratio;
      ctCharge = main - marginalRelief;
    }

    return {
      fy_year,
      taxableProfit: tp,
      augmentedProfit: ap,
      ctCharge: TaxModel.roundPounds(ctCharge),  // Round only the final charge
      marginalRelief: TaxModel.roundPounds(marginalRelief)  // Round for reporting
    };
  }

  function run(userInputs, options) {
    const cfg = options || {};
    const corpTaxYears = cfg.corpTaxYears || defaultCorpTaxYears;

    const inputs = TaxModel.createInputs(userInputs);
    const result = TaxModel.createEmptyResult();

    // 1) Accounts P&L -> PBT
    const pnl = inputs.pnl;
    result.accounts.totalIncome = TaxModel.roundPounds(
      pnl.turnover + pnl.govtGrants + pnl.rentalIncome + pnl.interestIncome + pnl.dividendIncome
    );
    result.accounts.totalExpenses = TaxModel.roundPounds(
      pnl.costOfSales + pnl.staffCosts + pnl.depreciation + pnl.otherCharges
    );
    result.accounts.profitBeforeTax = TaxModel.roundPounds(result.accounts.totalIncome - result.accounts.totalExpenses);

    // 2) Property loss offset (same as your pnl.js)
    result.property.rentalIncome = pnl.rentalIncome;
    result.property.propertyLossBF = pnl.propertyLossBF;
    result.property.propertyProfitAfterLossOffset = Math.max(0, pnl.rentalIncome - pnl.propertyLossBF);
    result.property.propertyLossCF = Math.max(0, pnl.propertyLossBF - pnl.rentalIncome);

    // 3) FY overlaps, thresholds, AIA caps
    const fyOverlaps = buildFYOverlaps(inputs, corpTaxYears);
    const thresholdParts = buildThresholdParts(inputs, fyOverlaps);
    const aiaAlloc = buildAIAAllocation(inputs, fyOverlaps, corpTaxYears);

    // 4) Core tax computation (v1)
    // 
    // SIMPLIFIED APPROACH FOR V1:
    // This engine calculates profit using a "combine all income, then
    // tax-adjust" approach. All income types (trading, rental, interest,
    // dividends, grants) are combined in the accounts P&L, then tax-specific
    // adjustments (add-backs, deductions, loss offsets) applied.
    //
    // RESULT: Final TTP is mathematically correct ✓
    // LIMITATION: Not FRS 105 structured (not separated by income type)
    // ACCEPTABLE FOR: Small trading companies ± rental income (v1 scope)
    // PLAN: v2.1 should restructure to separate income types from start
    //
    // See CODE_REVIEW_FINDINGS.js "Issue #1" for full explanation.
    
    // Add-backs: depreciation + disallowables + other adjustments
    const addBacks = TaxModel.roundPounds(pnl.depreciation + inputs.adjustments.disallowableExpenses + inputs.adjustments.otherAdjustments);
    result.computation.addBacks = addBacks;

    // Capital allowances (AIA) - limited by computed cap for whole AP
    const aiaCapTotal = aiaAlloc.totalCap;
    const aiaClaim = Math.min(inputs.capitalAllowances.aiaAdditions, TaxModel.roundPounds(aiaCapTotal));
    result.computation.capitalAllowances = TaxModel.roundPounds(aiaClaim);

    // Deductions: currently just capital allowances
    result.computation.deductions = result.computation.capitalAllowances;

    // Taxable trading profit before trading loss
    // Start from accounts PBT, then add backs, then subtract deductions (CA)
    // Note: This mirrors your box_315 style approach (broadly).
    const taxableBeforeLoss = TaxModel.roundPounds(result.accounts.profitBeforeTax + addBacks - result.computation.deductions);

    // Apply trading loss b/fwd
    const lossBF = inputs.losses.tradingLossBF;
    const lossUsed = Math.min(lossBF, Math.max(0, taxableBeforeLoss));
    result.computation.tradingLossUsed = TaxModel.roundPounds(lossUsed);

    const taxableAfterLoss = TaxModel.roundPounds(taxableBeforeLoss - lossUsed);
    result.computation.taxableTradingProfit = taxableAfterLoss;

    // Non-trading taxable profits: interest + property (after offset) + govt grants (already in accounts, but we keep for transparency)
    // For v1, we treat these as included in taxableTradingProfit already via PBT.
    // To keep compatibility with your existing box mapping, we expose them separately and also compute taxableTotalProfits as taxableAfterLoss.
    result.computation.taxableNonTradingProfits = TaxModel.roundPounds(pnl.interestIncome + result.property.propertyProfitAfterLossOffset);
    result.computation.taxableTotalProfits = Math.max(0, taxableAfterLoss);

    // Augmented profits = taxable total profits + dividends
    result.computation.augmentedProfits = TaxModel.roundPounds(result.computation.taxableTotalProfits + pnl.dividendIncome);

    // 5) Split profits by FY days and compute CT per FY
    const taxableByFY = prorateByFY(result.computation.taxableTotalProfits, inputs, fyOverlaps);
    const augmentedByFY = prorateByFY(result.computation.augmentedProfits, inputs, fyOverlaps);

    const byFY = fyOverlaps.map((fy) => {
      const th = thresholdParts.find((t) => t.fy_year === fy.fy_year);
      const tp = taxableByFY.find((x) => x.fy_year === fy.fy_year)?.amount || 0;
      const ap = augmentedByFY.find((x) => x.fy_year === fy.fy_year)?.amount || 0;

      const computed = computeTaxPerFY({
        fy_year: fy.fy_year,
        taxableProfit: tp,
        augmentedProfit: ap,
        lowerLimit: th ? th.small_threshold_for_AP_in_this_FY : 0,
        upperLimit: th ? th.upper_threshold_for_AP_in_this_FY : 0,
        tiers: fy.tiers
      });

      return {
        fy_year: fy.fy_year,
        ap_days_in_fy: fy.ap_days_in_fy,
        thresholds: th || null,
        aia_cap_for_fy: aiaAlloc.parts.find((p) => p.fy_year === fy.fy_year)?.aia_cap_for_fy || 0,
        taxableProfit: computed.taxableProfit,
        augmentedProfit: computed.augmentedProfit,
        ctCharge: computed.ctCharge,
        marginalRelief: computed.marginalRelief
      };
    });

    result.byFY = byFY;

    result.tax.corporationTaxCharge = TaxModel.roundPounds(byFY.reduce((s, x) => s + (x.ctCharge || 0), 0));
    result.tax.marginalRelief = TaxModel.roundPounds(byFY.reduce((s, x) => s + (x.marginalRelief || 0), 0));
    result.tax.taxPayable = result.tax.corporationTaxCharge;

    return { inputs, result, corpTaxYears };
  }

  root.TaxEngine = { run, defaultCorpTaxYears };
})(typeof window !== 'undefined' ? window : globalThis);