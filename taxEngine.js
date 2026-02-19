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
  function formatISODate(dateUTC) {
    if (!(dateUTC instanceof Date) || Number.isNaN(dateUTC.getTime())) return '';
    const y = dateUTC.getUTCFullYear();
    const m = String(dateUTC.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateUTC.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function addMonthsUTC(dateUTC, months) {
    const year = dateUTC.getUTCFullYear();
    const month = dateUTC.getUTCMonth();
    const day = dateUTC.getUTCDate();
    const targetMonthIndex = month + months;
    const targetYear = year + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(day, daysInTargetMonth);
    return new Date(Date.UTC(targetYear, targetMonth, safeDay));
  }
  function daysInclusive(startUTC, endUTC) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((endUTC - startUTC) / msPerDay) + 1;
  }

  // ==============================================================================
  // CORPORATION TAX RATE CONFIGURATION
  // ==============================================================================
  // 
  // This array defines CT rates, marginal relief thresholds, AIA limits, and
  // other tax parameters per UK financial year for corporation tax (1 Apr to 31 Mar).
  //
  // Structure:
  //   fy_year: The financial year label (e.g., 2024 = FY from 1 Apr 2024 to 31 Mar 2025)
  //   start_date: FY start date (YYYY-MM-DD, typically 1 Apr)
  //   end_date: FY end date (YYYY-MM-DD)
  //   tiers: Array of 3 tax tiers (ordered by threshold)
  //
  // Each tier has:
  //   index: 1, 2, or 3 (tier sequence; do not change)
  //   threshold: Augmented profit threshold (£) for this tier
  //   rate: Corporation tax rate (decimal; 0.19 = 19%, 0.25 = 25%)
  //   relief_fraction: Marginal relief factor (0.015 = 1.5% per £ above lower threshold)
  //   aia_limit: Annual Investment Allowance cap (£)
  //
  // Tier definitions (current 2024 onwards):
  //   Tier 1: Small profits rate (AP ≤ £50k) → 19% CT, no MR
  //   Tier 2: Marginal relief band (£50k < AP < £250k) → 25% CT minus MR
  //   Tier 3: Main rate (AP ≥ £250k) → 25% CT, no MR
  //
  // FUTURE RATES: To add a new FY with different rates, copy a tier set and update:
  //   - fy_year, start_date, end_date
  //   - threshold (if lower/upper limits change)
  //   - rate (if CT% changes)
  //   - relief_fraction (if MR % changes)
  //   - aia_limit (if AIA cap changes)
  //
  // IMPORTANT: Thresholds are further divided by (associated_companies + 1).
  //
  // ==============================================================================
  const defaultCorpTaxYears = [
    // FY 2020-2022: flat 19% CT rate (no marginal relief regime)
    {
      fy_year: 2020,
      start_date: '2020-04-01',
      end_date: '2021-03-31',
      tiers: [
        { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 2, threshold: 50000, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 3, threshold: 250000, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 }
      ]
    },
    {
      fy_year: 2021,
      start_date: '2021-04-01',
      end_date: '2022-03-31',
      tiers: [
        { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 2, threshold: 50000, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 3, threshold: 250000, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 }
      ]
    },
    {
      fy_year: 2022,
      start_date: '2022-04-01',
      end_date: '2023-03-31',
      tiers: [
        { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 2, threshold: 50000, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 3, threshold: 250000, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 }
      ]
    },
    // FY 2023: 19% small profits rate (unchanged), 25% main rate (unchanged)
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
    // FY 2024: Same rates continue (19% small, 25% main)
    {
      fy_year: 2024,
      start_date: '2024-04-01',
      end_date: '2025-03-31',
      tiers: [
        { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 2, threshold: 50000, rate: 0.25, relief_fraction: 0.015, aia_limit: 1000000 },
        { index: 3, threshold: 250000, rate: 0.25, relief_fraction: 0, aia_limit: 1000000 }
      ]
    },
    // FY 2025 onwards: Assuming rates unchanged (19% small, 25% main) until HMRC announces change
    {
      fy_year: 2025,
      start_date: '2025-04-01',
      end_date: '2026-03-31',
      tiers: [
        { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 2, threshold: 50000, rate: 0.25, relief_fraction: 0.015, aia_limit: 1000000 },
        { index: 3, threshold: 250000, rate: 0.25, relief_fraction: 0, aia_limit: 1000000 }
      ]
    },
    {
      fy_year: 2026,
      start_date: '2026-04-01',
      end_date: '2027-03-31',
      tiers: [
        { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 2, threshold: 50000, rate: 0.25, relief_fraction: 0.015, aia_limit: 1000000 },
        { index: 3, threshold: 250000, rate: 0.25, relief_fraction: 0, aia_limit: 1000000 }
      ]
    },
    {
      fy_year: 2027,
      start_date: '2027-04-01',
      end_date: '2028-03-31',
      tiers: [
        { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 2, threshold: 50000, rate: 0.25, relief_fraction: 0.015, aia_limit: 1000000 },
        { index: 3, threshold: 250000, rate: 0.25, relief_fraction: 0, aia_limit: 1000000 }
      ]
    },
    {
      fy_year: 2028,
      start_date: '2028-04-01',
      end_date: '2029-03-31',
      tiers: [
        { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 2, threshold: 50000, rate: 0.25, relief_fraction: 0.015, aia_limit: 1000000 },
        { index: 3, threshold: 250000, rate: 0.25, relief_fraction: 0, aia_limit: 1000000 }
      ]
    },
    {
      fy_year: 2029,
      start_date: '2029-04-01',
      end_date: '2030-03-31',
      tiers: [
        { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
        { index: 2, threshold: 50000, rate: 0.25, relief_fraction: 0.015, aia_limit: 1000000 },
        { index: 3, threshold: 250000, rate: 0.25, relief_fraction: 0, aia_limit: 1000000 }
      ]
    },
    {
      fy_year: 2030,
      start_date: '2030-04-01',
      end_date: '2031-03-31',
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

  function buildAccountingPeriodSplits(inputs, corpTaxYears) {
    // HMRC RULE: Accounting periods longer than 12 months must be split at 12-month mark.
    // Do not use a fixed 365-day cutoff because exact 12-month periods can be 366 days.
    const apDays = inputs.accountingPeriodDays;
    const apStart = inputs.apStartUTC;
    const apEnd = inputs.apEndUTC;
    const msPerDay = 24 * 60 * 60 * 1000;
    const twelveMonthsLater = addMonthsUTC(apStart, 12);
    const period1End = new Date(twelveMonthsLater.getTime() - msPerDay);

    // AP up to 12 months: no split
    if (apEnd <= period1End) {
      const isShortPeriod = apEnd < period1End;
      return [{
        periodName: 'Full Period',
        startUTC: apStart,
        endUTC: apEnd,
        days: apDays,
        isShortPeriod
      }];
    }

    // AP > 12 months: split at 12-month boundary
    // Period 1: apStart to day before same date next year
    // Period 2: next day to apEnd
    const period1Days = daysInclusive(apStart, period1End);
    const period2Start = new Date(period1End.getTime() + msPerDay);
    const period2Days = daysInclusive(period2Start, apEnd);

    return [
      {
        periodName: 'Period 1 (12 months)',
        startUTC: apStart,
        endUTC: period1End,
        days: period1Days,
        isShortPeriod: false
      },
      {
        periodName: 'Period 2 (short period)',
        startUTC: period2Start,
        endUTC: apEnd,
        days: period2Days,
        isShortPeriod: true
      }
    ];
  }

  function buildFYOverlaps(inputs, corpTaxYears) {
    const apStart = inputs.apStartUTC;
    const apEnd = inputs.apEndUTC;

    const overlaps = (corpTaxYears || []).map((fy) => {
      const fyStart = parseDate(fy.start_date);
      const fyEnd = parseDate(fy.end_date);

      const overlapStart = apStart > fyStart ? apStart : fyStart;
      const overlapEnd = apEnd < fyEnd ? apEnd : fyEnd;

      let apDaysInFY = 0;
      if (overlapStart <= overlapEnd) apDaysInFY = daysInclusive(overlapStart, overlapEnd);

      const fyTotalDays = daysInclusive(fyStart, fyEnd);

      return {
        fy_year: fy.fy_year,
        fyStart,
        fyEnd,
        overlap_start_utc: overlapStart,
        overlap_end_utc: overlapEnd,
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
    // CRITICAL: Apply associates divisor to AIA cap (same as thresholds)
    const divisor = (inputs.associatedCompanyCount || 0) + 1;
    const periodDays = inputs.accountingPeriodDays || 1;
    // AIA master cap is shared across trade/non-trade.
    // Short-period rule: pro-rate by days in the relevant FY slice (365/366 as applicable).
    // Full 12-month period rule: use strict annual cap then apportion by slice share.
    const parts = fyOverlaps.map((fy) => {
      const annualAiaLimit = getTier(fy.tiers, 1).aia_limit;
      let sliceMasterCap = 0;
      if (inputs.isShortPeriod) {
        const fyDays = fy.fy_total_days || 365;
        sliceMasterCap = (annualAiaLimit * (fy.ap_days_in_fy / fyDays)) / divisor;
      } else {
        const periodCapFromThisFY = annualAiaLimit / divisor;
        const sliceShare = periodDays > 0 ? (fy.ap_days_in_fy / periodDays) : 0;
        sliceMasterCap = periodCapFromThisFY * sliceShare;
      }
      return {
        fy_year: fy.fy_year,
        ap_days_in_fy: fy.ap_days_in_fy,
        aia_annual_limit: annualAiaLimit,
        aia_cap_for_fy: sliceMasterCap
      };
    });
    const totalCap = parts.reduce((s, p) => s + (p.aia_cap_for_fy || 0), 0);

    return { totalCap, parts };
  }

  function allocateSharedCap(tradePotential, nonTradePotential, masterCap) {
    const cap = Math.max(0, masterCap || 0);
    const trade = Math.max(0, tradePotential || 0);
    const nonTrade = Math.max(0, nonTradePotential || 0);
    const total = trade + nonTrade;
    if (cap <= 0 || total <= 0) {
      return { tradeClaim: 0, nonTradeClaim: 0 };
    }
    if (total <= cap) {
      return { tradeClaim: trade, nonTradeClaim: nonTrade };
    }

    // Proportional split when total requested claim exceeds master cap.
    let tradeClaim = cap * (trade / total);
    let nonTradeClaim = cap - tradeClaim;
    tradeClaim = Math.min(trade, tradeClaim);
    nonTradeClaim = Math.min(nonTrade, nonTradeClaim);

    // Top-up remainder to whichever side still has unmet potential.
    let remainder = cap - (tradeClaim + nonTradeClaim);
    if (remainder > 0) {
      const tradeHeadroom = trade - tradeClaim;
      const nonTradeHeadroom = nonTrade - nonTradeClaim;
      const tradeTopUp = Math.min(remainder, Math.max(0, tradeHeadroom));
      tradeClaim += tradeTopUp;
      remainder -= tradeTopUp;
      if (remainder > 0) {
        const nonTradeTopUp = Math.min(remainder, Math.max(0, nonTradeHeadroom));
        nonTradeClaim += nonTradeTopUp;
      }
    }

    return { tradeClaim, nonTradeClaim };
  }

  function buildThresholdParts(inputs, fyOverlaps) {
    const divisor = (inputs.associatedCompanyCount || 0) + 1;
    const periodDays = inputs.accountingPeriodDays || 1;

    return fyOverlaps.map((fy) => {
      const small = getTier(fy.tiers, 2).threshold;
      const upper = getTier(fy.tiers, 3).threshold;
      // Threshold rule:
      // - full 12-month period: strict annual thresholds (50k/250k, then associates divisor)
      // - short period: pro-rate by FY slice days / FY total days (365/366 as applicable), then associates divisor
      // Slice thresholds are then summed across slices.
      let smallForAP = 0;
      let upperForAP = 0;
      if (inputs.isShortPeriod) {
        const fyDays = fy.fy_total_days || 365;
        smallForAP = (small * (fy.ap_days_in_fy / fyDays)) / divisor;
        upperForAP = (upper * (fy.ap_days_in_fy / fyDays)) / divisor;
      } else {
        const periodSmall = small / divisor;
        const periodUpper = upper / divisor;
        const sliceShare = periodDays > 0 ? (fy.ap_days_in_fy / periodDays) : 0;
        smallForAP = periodSmall * sliceShare;
        upperForAP = periodUpper * sliceShare;
      }

      return {
        fy_year: fy.fy_year,
        ap_days_in_fy: fy.ap_days_in_fy,
        fy_total_days: fy.fy_total_days,
        small_threshold_for_AP_in_this_FY: smallForAP,
        upper_threshold_for_AP_in_this_FY: upperForAP
      };
    });
  }

  function prorateByFY(value, inputs, fyOverlaps) {
    const totalDays = inputs.accountingPeriodDays || 1;
    return fyOverlaps.map((fy) => ({
      fy_year: fy.fy_year,
      amount: value * (fy.ap_days_in_fy / totalDays),
      ap_days_in_fy: fy.ap_days_in_fy
    }));
  }

  function allocateByWeightForDisplay(total, rows, valueKey, outKey) {
    let remaining = TaxModel.roundPounds(total);
    const out = rows.map((row, idx) => {
      const isLast = idx === rows.length - 1;
      const weight = rows.length > 0
        ? (Number(row[valueKey] || 0) / Math.max(1, rows.reduce((s, r) => s + Number(r[valueKey] || 0), 0)))
        : 0;
      const allocated = isLast ? remaining : TaxModel.roundPounds(total * weight);
      remaining -= allocated;
      return allocated;
    });
    return rows.map((row, idx) => ({ ...row, [outKey]: out[idx] }));
  }

  function computeTaxPerFY({ fy_year, taxableProfit, augmentedProfit, lowerLimit, upperLimit, tiers }) {
    // Uses your marginal relief model:
    // if augmented <= lower => small profits rate (19%)
    // if augmented >= upper => main rate (25%)
    // else MR = relief_fraction*(upper-augmented)*(taxable/augmented)
    // 
    // Keep full decimal precision during computation.
    // Rounding is applied at reporting/output boundaries, not per-slice math.
    const smallRate = getTier(tiers, 1).rate;
    const mainRate = getTier(tiers, 3).rate;
    const reliefFraction = getTier(tiers, 2).relief_fraction;

    const tp = Math.max(0, taxableProfit);  // Keep as-is, no rounding
    const ap = Math.max(0, augmentedProfit);  // Keep as-is, no rounding
    const lower = Math.max(0, lowerLimit);
    const upper = Math.max(0, upperLimit);

    let ctChargeRaw = 0;
    let marginalReliefRaw = 0;

    if (ap <= lower) {
      ctChargeRaw = tp * smallRate;
    } else if (ap >= upper) {
      ctChargeRaw = tp * mainRate;
    } else {
      // Start at main rate then deduct marginal relief (all in decimal precision)
      const main = tp * mainRate;
      const ratio = ap > 0 ? (tp / ap) : 0;
      marginalReliefRaw = reliefFraction * (upper - ap) * ratio;
      ctChargeRaw = main - marginalReliefRaw;
    }

    return {
      fy_year,
      taxableProfit: tp,
      augmentedProfit: ap,
      ctCharge: ctChargeRaw,
      marginalRelief: marginalReliefRaw,
      ctChargeRaw,
      marginalReliefRaw,
      ctChargeRounded: TaxModel.roundPounds(ctChargeRaw),
      marginalReliefRounded: TaxModel.roundPounds(marginalReliefRaw)
    };
  }

  function getRegimeSignature(tiers) {
    const smallRate = getTier(tiers, 1).rate;
    const mainRate = getTier(tiers, 3).rate;
    const reliefFraction = getTier(tiers, 2).relief_fraction;
    const smallThresholdBase = getTier(tiers, 2).threshold;
    const upperThresholdBase = getTier(tiers, 3).threshold;
    return [
      String(smallRate),
      String(mainRate),
      String(reliefFraction),
      String(smallThresholdBase),
      String(upperThresholdBase)
    ].join('|');
  }

  function collapseSlicesByRegime(rawSlices) {
    const grouped = [];
    const orderedSlices = [...(rawSlices || [])].sort((a, b) => {
      const aStart = a?.overlap_start_utc instanceof Date ? a.overlap_start_utc.getTime() : 0;
      const bStart = b?.overlap_start_utc instanceof Date ? b.overlap_start_utc.getTime() : 0;
      return aStart - bStart;
    });
    orderedSlices.forEach((slice) => {
      const lower = slice.thresholds ? slice.thresholds.small_threshold_for_AP_in_this_FY : 0;
      const upper = slice.thresholds ? slice.thresholds.upper_threshold_for_AP_in_this_FY : 0;
      const signature = getRegimeSignature(slice.tiers);
      const last = grouped[grouped.length - 1];
      if (!last || last.signature !== signature) {
        grouped.push({
          signature,
          fy_years: [slice.fy_year],
          fy_components: [{
            fy_year: slice.fy_year,
            ap_days_in_fy: slice.ap_days_in_fy || 0,
            taxableProfit: slice.taxableProfit || 0,
            augmentedProfit: slice.augmentedProfit || 0,
            thresholds: slice.thresholds || null,
            aia_cap_for_fy: slice.aia_cap_for_fy || 0,
            overlap_start_utc: slice.overlap_start_utc,
            overlap_end_utc: slice.overlap_end_utc
          }],
          ap_days: slice.ap_days_in_fy,
          thresholds: slice.thresholds || null,
          aia_cap_for_fy: slice.aia_cap_for_fy || 0,
          taxableProfit: slice.taxableProfit || 0,
          augmentedProfit: slice.augmentedProfit || 0,
          lower_limit_sum: lower,
          upper_limit_sum: upper,
          start_utc: slice.overlap_start_utc,
          end_utc: slice.overlap_end_utc,
          tiers: slice.tiers
        });
        return;
      }
      last.fy_years.push(slice.fy_year);
      last.ap_days += slice.ap_days_in_fy || 0;
      last.aia_cap_for_fy += slice.aia_cap_for_fy || 0;
      last.taxableProfit += slice.taxableProfit || 0;
      last.augmentedProfit += slice.augmentedProfit || 0;
      last.lower_limit_sum += lower;
      last.upper_limit_sum += upper;
      last.end_utc = slice.overlap_end_utc;
      last.fy_components.push({
        fy_year: slice.fy_year,
        ap_days_in_fy: slice.ap_days_in_fy || 0,
        taxableProfit: slice.taxableProfit || 0,
        augmentedProfit: slice.augmentedProfit || 0,
        thresholds: slice.thresholds || null,
        aia_cap_for_fy: slice.aia_cap_for_fy || 0,
        overlap_start_utc: slice.overlap_start_utc,
        overlap_end_utc: slice.overlap_end_utc
      });
    });
    return grouped;
  }

  function hasSmallProfitsOrMarginalReliefEntitlement(slice) {
    const taxableProfit = Math.max(0, Number(slice?.taxableProfit || 0));
    if (taxableProfit <= 0) return false;

    const smallRate = Number(slice?.small_rate ?? 0);
    const mainRate = Number(slice?.main_rate ?? 0);
    if (!(smallRate > 0 && mainRate > smallRate)) return false;

    const upperThreshold = Number(slice?.thresholds?.upper_threshold_for_AP_in_this_FY || 0);
    if (upperThreshold <= 0) {
      // Defensive fallback: if thresholds are unavailable, MR > 0 still proves entitlement.
      return Number(slice?.marginalRelief || 0) > 0;
    }

    // Entitlement applies where augmented profits are below the upper limit.
    const augmentedProfit = Math.max(0, Number(slice?.augmentedProfit || 0));
    return augmentedProfit < upperThreshold;
  }

  function run(userInputs, options) {
    const cfg = options || {};
    const corpTaxYears = cfg.corpTaxYears || defaultCorpTaxYears;

    const inputs = TaxModel.createInputs(userInputs);
    const result = TaxModel.createEmptyResult();
    const accountingPeriodDays = inputs.accountingPeriodDays;
    const associatedCompanyCount = inputs.associatedCompanyCount;

    // HMRC RULE: Split AP if > 12 months
    const apSplits = buildAccountingPeriodSplits(inputs, corpTaxYears);
    const hasMultiplePeriods = apSplits.length > 1;

    // Allocate profit and income proportionally across periods
    const allocateToPeriods = (value) => {
      return apSplits.map((period) => ({
        periodName: period.periodName,
        days: period.days,
        isShortPeriod: period.isShortPeriod,
        amount: value * (period.days / accountingPeriodDays)
      }));
    };

    // 1) Accounts P&L -> PBT (allocate to periods)
    // CRITICAL: Do NOT include dividend in totalIncome - dividend affects rate, not taxable profit
    const pnl = inputs.pnl;
    const tradingTurnover = pnl.tradingTurnover;
    const governmentGrants = pnl.governmentGrants;
    const propertyIncome = pnl.propertyIncome;
    const propertyLossBroughtForward = pnl.propertyLossBroughtForward;
    const tradingBalancingCharges = pnl.tradingBalancingCharges;
    const chargeableGains = pnl.chargeableGains;
    const dividendIncome = pnl.dividendIncome;
    const costOfGoodsSold = pnl.costOfGoodsSold;
    const staffEmploymentCosts = pnl.staffEmploymentCosts;
    const depreciationExpense = pnl.depreciationExpense;
    const otherOperatingCharges = pnl.otherOperatingCharges;
    const disallowableExpenditure = inputs.adjustments.disallowableExpenditure;
    const otherTaxAdjustmentsAddBack = inputs.adjustments.otherTaxAdjustmentsAddBack;
    const annualInvestmentAllowanceTradeAdditions = inputs.capitalAllowances.annualInvestmentAllowanceTradeAdditions;
    const annualInvestmentAllowanceNonTradeAdditions = inputs.capitalAllowances.annualInvestmentAllowanceNonTradeAdditions;
    const tradingLossBroughtForward = inputs.losses.tradingLossBroughtForward;
    const tradingLossUsageRequested = inputs.losses.tradingLossUsageRequested;
    const propertyLossUsageRequested = inputs.losses.propertyLossUsageRequested;
    const ct600 = inputs.ct600 || {};
    const communityInvestmentTaxRelief = Number(ct600.communityInvestmentTaxRelief || 0);
    const doubleTaxationRelief = Number(ct600.doubleTaxationRelief || 0);
    const advanceCorporationTax = Number(ct600.advanceCorporationTax || 0);
    const loansToParticipatorsTax = Number(ct600.loansToParticipatorsTax || 0);
    const controlledForeignCompaniesTax = Number(ct600.controlledForeignCompaniesTax || 0);
    const bankLevyPayable = Number(ct600.bankLevyPayable || 0);
    const bankSurchargePayable = Number(ct600.bankSurchargePayable || 0);
    const residentialPropertyDeveloperTax = Number(ct600.residentialPropertyDeveloperTax || 0);
    const eogplPayable = Number(ct600.eogplPayable || 0);
    const eglPayable = Number(ct600.eglPayable || 0);
    const supplementaryChargePayable = Number(ct600.supplementaryChargePayable || 0);
    const incomeTaxDeductedFromGrossIncome = Number(ct600.incomeTaxDeductedFromGrossIncome || 0);
    const coronavirusSupportPaymentOverpaymentNowDue = Number(ct600.coronavirusSupportPaymentOverpaymentNowDue || 0);
    const restitutionTax = Number(ct600.restitutionTax || 0);
    const totalIncomeRaw =
      tradingTurnover + governmentGrants + propertyIncome + pnl.interestIncome + tradingBalancingCharges + chargeableGains;
      // NOTE: pnl.dividendIncome is NOT included here - handled separately for augmented profit
    const totalExpensesRaw =
      costOfGoodsSold + staffEmploymentCosts + depreciationExpense + otherOperatingCharges;
    const accountProfitBeforeTaxRaw = totalIncomeRaw - totalExpensesRaw;
    result.accounts.totalIncome = TaxModel.roundPounds(totalIncomeRaw);
    result.accounts.totalExpenses = TaxModel.roundPounds(totalExpensesRaw);
    result.accounts.profitBeforeTax = TaxModel.roundPounds(accountProfitBeforeTaxRaw);

    // 2) Property inputs (property loss b/fwd is applied sequentially per AP below)
    result.property.rentalIncome = propertyIncome;
    result.property.propertyLossBF = propertyLossBroughtForward;
    result.property.propertyProfitAfterLossOffset = 0;
    result.property.propertyLossAvailable = Math.max(0, propertyLossBroughtForward);
    result.property.propertyLossCF = Math.max(0, propertyLossBroughtForward);

    // 3) Loss pools available at start of first AP (then carried sequentially).
    let remainingPropertyLossPool = Math.max(0, Number(propertyLossBroughtForward) || 0);
    const requestedPropertyLossTotal =
      propertyLossUsageRequested == null
        ? remainingPropertyLossPool
        : Math.min(remainingPropertyLossPool, Math.max(0, Number(propertyLossUsageRequested) || 0));
    let remainingPropertyLossUseRequested = requestedPropertyLossTotal;
    // Trading losses b/fwd flow sequentially across APs:
    // opening pool is available to AP1, unused balance carries forward to AP2, etc.
    let remainingLossPool = Math.max(0, Number(tradingLossBroughtForward) || 0);
    result.computation.tradingLossBroughtForwardAvailable = TaxModel.roundPounds(tradingLossBroughtForward);
    result.computation.tradingLossBroughtForwardRemaining = TaxModel.roundPounds(remainingLossPool);
    result.computation.tradingLossCurrentPeriodIncurred = 0;
    // Legacy alias kept for backward compatibility (means b/fwd remaining, not total carried-forward).
    result.computation.tradingLossAvailable = TaxModel.roundPounds(remainingLossPool);
    const requestedLossTotal =
      tradingLossUsageRequested == null
        ? remainingLossPool
        : Math.min(remainingLossPool, Math.max(0, Number(tradingLossUsageRequested) || 0));
    let remainingLossUseRequested = requestedLossTotal;

    // 4) Allocate profit to each AP split period and calculate tax per period
    const periodResults = apSplits.map((period, periodIndex) => {
      // Build FY overlaps FOR THIS PERIOD ONLY
      const tmpInputs = {
        apStartUTC: period.startUTC,
        apEndUTC: period.endUTC,
        accountingPeriodDays: period.days,
        associatedCompanyCount,
        isShortPeriod: period.isShortPeriod
      };
      const fyOverlaps = buildFYOverlaps(tmpInputs, corpTaxYears);
      const thresholdParts = buildThresholdParts(tmpInputs, fyOverlaps);
      const aiaAlloc = buildAIAAllocation(tmpInputs, fyOverlaps, corpTaxYears);

      // Allocate inputs to this period
      const periodProfitBeforeTax = accountProfitBeforeTaxRaw * (period.days / accountingPeriodDays);
      const periodRatio = (period.days / (accountingPeriodDays || 1));
      const periodDividendIncome = dividendIncome * periodRatio;
      const periodInterestIncome = pnl.interestIncome * periodRatio;
      // Chargeable gains are ring-fenced for this income computation:
      // capital losses must not reduce interest/property income or leak into trading.
      const rawPeriodCapitalGains = chargeableGains * periodRatio;
      const periodCapitalGains = Math.max(0, rawPeriodCapitalGains);
      const periodCapitalGainRingFenceAdjustment = periodCapitalGains - rawPeriodCapitalGains;
      const periodRentalIncomeGrossRaw = propertyIncome * periodRatio;
      const periodPropertyLossPool = Math.max(0, remainingPropertyLossPool);
      const periodPropertyProfitBeforeLossRaw = periodRentalIncomeGrossRaw;

      // Add-backs
      const periodAddBacksRaw =
        (depreciationExpense + disallowableExpenditure + otherTaxAdjustmentsAddBack) * periodRatio;
      const periodAddBacks = TaxModel.roundPounds(periodAddBacksRaw);

      // Capital allowances (AIA) - separate trade/non-trade buckets and caps
      const periodAIACapTotal = aiaAlloc.totalCap;
      const periodTradeAIAAdditionsShare = annualInvestmentAllowanceTradeAdditions * periodRatio;
      const periodNonTradeAIAAdditionsShare = annualInvestmentAllowanceNonTradeAdditions * periodRatio;
      const periodAIAAdditionsShare = periodTradeAIAAdditionsShare + periodNonTradeAIAAdditionsShare;

      // Taxable total profit base (before losses), then apply AIA to trade/non-trade separately.
      const periodTaxableBeforeAIARaw =
        periodProfitBeforeTax + periodAddBacksRaw + periodCapitalGainRingFenceAdjustment;
      const periodNonTradingBeforeAIARaw =
        periodInterestIncome + periodPropertyProfitBeforeLossRaw + periodCapitalGains;
      // Trading bucket is computed residually from total taxable base, so it includes
      // disposal balancing charges (inputs.pnl.tradingBalancingCharges) by design.
      const periodTradingBeforeAIARaw = periodTaxableBeforeAIARaw - periodNonTradingBeforeAIARaw;
      // AIA claim is driven by qualifying additions (subject to shared cap),
      // and can create/increase a loss. Do not cap claim by current-period profit.
      const tradePotentialClaim = Math.max(0, periodTradeAIAAdditionsShare);
      const nonTradePotentialClaim = Math.max(0, periodNonTradeAIAAdditionsShare);
      const sharedCapClaims = allocateSharedCap(tradePotentialClaim, nonTradePotentialClaim, periodAIACapTotal);
      const periodTradeAIAClaimRaw = sharedCapClaims.tradeClaim;
      const periodNonTradeAIAClaimRaw = sharedCapClaims.nonTradeClaim;
      const periodAIAClaimRaw = periodTradeAIAClaimRaw + periodNonTradeAIAClaimRaw;
      const periodTradingAfterAIARaw = periodTradingBeforeAIARaw - periodTradeAIAClaimRaw;
      // Rental/property AIA offsets the rental/property stream only (not interest).
      const periodPropertyAfterAIARaw = periodPropertyProfitBeforeLossRaw - periodNonTradeAIAClaimRaw;
      const periodCurrentPropertyLossIncurredRaw = Math.max(0, -periodPropertyAfterAIARaw);
      const periodNonTradingAfterAIARaw = periodInterestIncome + periodPropertyAfterAIARaw + periodCapitalGains;
      const periodTaxableBeforeLossRaw = periodTradingAfterAIARaw + periodNonTradingAfterAIARaw;

      // Trading losses b/fwd reduce trading profits only.
      // Opening pool for each AP is the carried-forward balance from prior AP.
      const periodLossPool = Math.max(0, remainingLossPool);
      const periodLossUsed = Math.min(periodLossPool, remainingLossUseRequested, Math.max(0, periodTradingAfterAIARaw));
      remainingLossPool = Math.max(0, periodLossPool - periodLossUsed);
      remainingLossUseRequested = Math.max(0, remainingLossUseRequested - periodLossUsed);
      const periodTradingAfterLossRaw = periodTradingAfterAIARaw - periodLossUsed;

      const periodTaxableAfterLossRaw = periodTradingAfterLossRaw + periodNonTradingAfterAIARaw;
      // Property losses b/fwd are claimable against total profits (capped at available/requested/positive total profits).
      const periodPropertyLossUsed = Math.min(
        periodPropertyLossPool,
        remainingPropertyLossUseRequested,
        Math.max(0, periodTaxableAfterLossRaw)
      );
      remainingPropertyLossPool = Math.max(0, periodPropertyLossPool - periodPropertyLossUsed);
      remainingPropertyLossUseRequested = Math.max(0, remainingPropertyLossUseRequested - periodPropertyLossUsed);
      // Any current-year property loss not absorbed in-period is carried forward.
      const periodProfitAvailableForCurrentPropertyLoss = Math.max(
        0,
        periodTradingAfterLossRaw + periodInterestIncome + periodCapitalGains
      );
      const periodCurrentPropertyLossUsed = Math.min(
        periodCurrentPropertyLossIncurredRaw,
        periodProfitAvailableForCurrentPropertyLoss
      );
      const periodCurrentPropertyLossUnrelieved = Math.max(
        0,
        periodCurrentPropertyLossIncurredRaw - periodCurrentPropertyLossUsed
      );
      remainingPropertyLossPool = Math.max(
        0,
        remainingPropertyLossPool + periodCurrentPropertyLossUnrelieved
      );
      // Keep a property-stream view for disclosures/transparency.
      const periodPropertyLossUsedAgainstProperty = Math.min(
        periodPropertyLossUsed,
        Math.max(0, periodPropertyProfitBeforeLossRaw)
      );
      const periodPropertyProfitRaw = Math.max(0, periodPropertyProfitBeforeLossRaw - periodPropertyLossUsedAgainstProperty);
      const periodPropertyAdjustmentDisplayRaw = periodPropertyProfitRaw - periodRentalIncomeGrossRaw;
      const periodTaxableTotalRaw = Math.max(0, periodTaxableAfterLossRaw - periodPropertyLossUsed);
      // Augmented profit includes taxable profit + dividend income (for rate banding)
      const periodAugmentedProfitRaw = periodTaxableTotalRaw + periodDividendIncome;

      // Build raw FY slices first, then collapse contiguous slices when tax regime is unchanged.
      // This enforces whole-period MR logic when rates/thresholds are unchanged across FY boundaries.
      const rawPeriodByFY = fyOverlaps.map((fy) => {
        const th = thresholdParts.find((t) => t.fy_year === fy.fy_year);
        const tp = periodTaxableTotalRaw * (fy.ap_days_in_fy / period.days);
        const ap = periodAugmentedProfitRaw * (fy.ap_days_in_fy / period.days);

        return {
          period_index: periodIndex + 1,
          period_name: period.periodName,
          fy_year: fy.fy_year,
          ap_days_in_fy: fy.ap_days_in_fy,
          overlap_start_utc: fy.overlap_start_utc,
          overlap_end_utc: fy.overlap_end_utc,
          thresholds: th || null,
          aia_cap_for_fy: aiaAlloc.parts.find((p) => p.fy_year === fy.fy_year)?.aia_cap_for_fy || 0,
          taxableProfit: tp,
          augmentedProfit: ap,
          tiers: fy.tiers
        };
      });

      const groupedPeriodByFY = collapseSlicesByRegime(rawPeriodByFY);
      const periodSlices = groupedPeriodByFY.map((grp, sliceIndex) => {
        const lower = grp.lower_limit_sum || 0;
        const upper = grp.upper_limit_sum || 0;
        const smallRate = getTier(grp.tiers, 1).rate;
        const mainRate = getTier(grp.tiers, 3).rate;
        const computed = computeTaxPerFY({
          fy_year: grp.fy_years[0],
          taxableProfit: grp.taxableProfit,
          augmentedProfit: grp.augmentedProfit,
          lowerLimit: lower,
          upperLimit: upper,
          tiers: grp.tiers
        });
        const taxableProfitRaw = Number(computed.taxableProfit || 0);
        const ctChargeRaw = Number(computed.ctChargeRaw || computed.ctCharge || 0);
        const effectiveTaxRate = taxableProfitRaw > 0 ? (ctChargeRaw / taxableProfitRaw) : 0;
        return {
          period_index: periodIndex + 1,
          period_name: period.periodName,
          slice_index: sliceIndex + 1,
          slice_name: `Slice ${sliceIndex + 1}`,
          slice_start: formatISODate(grp.start_utc),
          slice_end: formatISODate(grp.end_utc),
          fy_year: grp.fy_years[0],
          fy_years: grp.fy_years,
          ap_days_in_fy: grp.ap_days,
          thresholds: {
            small_threshold_for_AP_in_this_FY: lower,
            upper_threshold_for_AP_in_this_FY: upper
          },
          aia_cap_for_fy: grp.aia_cap_for_fy,
          taxableProfit: computed.taxableProfit,
          augmentedProfit: computed.augmentedProfit,
          ctCharge: computed.ctCharge,
          marginalRelief: computed.marginalRelief,
          ctChargeRaw: computed.ctChargeRaw,
          marginalReliefRaw: computed.marginalReliefRaw,
          ctChargeRounded: computed.ctChargeRounded,
          marginalReliefRounded: computed.marginalReliefRounded,
          small_rate: smallRate,
          main_rate: mainRate,
          relief_fraction: getTier(grp.tiers, 2).relief_fraction,
          effective_tax_rate: effectiveTaxRate,
          corporation_tax_at_main_rate: taxableProfitRaw * mainRate,
          regime_grouped: grp.fy_years.length > 1,
          fy_components: (grp.fy_components || []).map((component, compIdx) => ({
            component_index: compIdx + 1,
            fy_year: component.fy_year,
            ap_days_in_fy: component.ap_days_in_fy,
            taxableProfit: component.taxableProfit,
            augmentedProfit: component.augmentedProfit,
            thresholds: component.thresholds || null,
            aia_cap_for_fy: component.aia_cap_for_fy || 0,
            slice_start: formatISODate(component.overlap_start_utc),
            slice_end: formatISODate(component.overlap_end_utc)
          }))
        };
      });

      const periodCTChargeRaw = periodSlices.reduce(
        (sum, slice) => sum + Number(slice.ctChargeRaw ?? slice.ctCharge ?? 0),
        0
      );
      const periodMarginalReliefRaw = periodSlices.reduce(
        (sum, slice) => sum + Number(slice.marginalReliefRaw ?? slice.marginalRelief ?? 0),
        0
      );

      return {
        periodIndex: periodIndex + 1,
        periodName: period.periodName,
        periodStart: formatISODate(period.startUTC),
        periodEnd: formatISODate(period.endUTC),
        days: period.days,
        isShortPeriod: period.isShortPeriod,
        profitBeforeTaxRaw: periodProfitBeforeTax,
        profitBeforeTax: TaxModel.roundPounds(periodProfitBeforeTax),
        taxableProfit: Math.max(0, TaxModel.roundPounds(periodTaxableTotalRaw)),
        taxableProfitRaw: periodTaxableTotalRaw,
        tradingProfitAfterLoss: TaxModel.roundPounds(periodTradingAfterLossRaw),
        tradingProfitAfterLossRaw: periodTradingAfterLossRaw,
        nonTradingProfitAfterAIA: TaxModel.roundPounds(periodNonTradingAfterAIARaw),
        nonTradingProfitAfterAIARaw: periodNonTradingAfterAIARaw,
        augmentedProfit: TaxModel.roundPounds(periodAugmentedProfitRaw),
        augmentedProfitRaw: periodAugmentedProfitRaw,
        lossPoolRaw: periodLossPool,
        lossPool: TaxModel.roundPounds(periodLossPool),
        lossUsedRaw: periodLossUsed,
        lossUsed: TaxModel.roundPounds(periodLossUsed),
        lossCarriedForwardRaw: remainingLossPool,
        lossCarriedForward: TaxModel.roundPounds(remainingLossPool),
        lossUseRequestedRemainingRaw: remainingLossUseRequested,
        lossUseRequestedRemaining: TaxModel.roundPounds(remainingLossUseRequested),
        propertyRentalGrossRaw: periodRentalIncomeGrossRaw,
        propertyRentalGross: TaxModel.roundPounds(periodRentalIncomeGrossRaw),
        propertyLossPoolRaw: periodPropertyLossPool,
        propertyLossPool: TaxModel.roundPounds(periodPropertyLossPool),
        propertyLossUsedRaw: periodPropertyLossUsed,
        propertyLossUsed: TaxModel.roundPounds(periodPropertyLossUsed),
        propertyLossIncurredCurrentPeriodRaw: periodCurrentPropertyLossIncurredRaw,
        propertyLossIncurredCurrentPeriod: TaxModel.roundPounds(periodCurrentPropertyLossIncurredRaw),
        propertyLossUsedCurrentPeriodRaw: periodCurrentPropertyLossUsed,
        propertyLossUsedCurrentPeriod: TaxModel.roundPounds(periodCurrentPropertyLossUsed),
        propertyLossUnrelievedCurrentPeriodRaw: periodCurrentPropertyLossUnrelieved,
        propertyLossUnrelievedCurrentPeriod: TaxModel.roundPounds(periodCurrentPropertyLossUnrelieved),
        propertyLossUsedAgainstPropertyRaw: periodPropertyLossUsedAgainstProperty,
        propertyLossUsedAgainstProperty: TaxModel.roundPounds(periodPropertyLossUsedAgainstProperty),
        propertyLossUseRequestedRemainingRaw: remainingPropertyLossUseRequested,
        propertyLossUseRequestedRemaining: TaxModel.roundPounds(remainingPropertyLossUseRequested),
        propertyLossCarriedForwardRaw: remainingPropertyLossPool,
        propertyLossCarriedForward: TaxModel.roundPounds(remainingPropertyLossPool),
        propertyProfitAfterLossRaw: periodPropertyProfitRaw,
        propertyProfitAfterLoss: TaxModel.roundPounds(periodPropertyProfitRaw),
        propertyProfitAfterAIARaw: periodPropertyAfterAIARaw,
        propertyProfitAfterAIA: TaxModel.roundPounds(periodPropertyAfterAIARaw),
        propertyAdjustmentRaw: periodPropertyAdjustmentDisplayRaw,
        propertyAdjustment: TaxModel.roundPounds(periodPropertyAdjustmentDisplayRaw),
        taxableBeforeLossRaw: periodTaxableBeforeLossRaw,
        taxableBeforeLoss: TaxModel.roundPounds(periodTaxableBeforeLossRaw),
        addBacksRaw: periodAddBacksRaw,
        addBacks: TaxModel.roundPounds(periodAddBacks),
        tradeAIACapTotalRaw: periodAIACapTotal,
        tradeAIACapTotal: TaxModel.roundPounds(periodAIACapTotal),
        nonTradeAIACapTotalRaw: periodAIACapTotal,
        nonTradeAIACapTotal: TaxModel.roundPounds(periodAIACapTotal),
        aiaCapTotalRaw: periodAIACapTotal,
        aiaCapTotal: TaxModel.roundPounds(periodAIACapTotal),
        tradeAIAPotentialClaimRaw: tradePotentialClaim,
        tradeAIAPotentialClaim: TaxModel.roundPounds(tradePotentialClaim),
        nonTradeAIAPotentialClaimRaw: nonTradePotentialClaim,
        nonTradeAIAPotentialClaim: TaxModel.roundPounds(nonTradePotentialClaim),
        tradeAIAAdditionsShareRaw: periodTradeAIAAdditionsShare,
        tradeAIAAdditionsShare: TaxModel.roundPounds(periodTradeAIAAdditionsShare),
        nonTradeAIAAdditionsShareRaw: periodNonTradeAIAAdditionsShare,
        nonTradeAIAAdditionsShare: TaxModel.roundPounds(periodNonTradeAIAAdditionsShare),
        aiaAdditionsShareRaw: periodAIAAdditionsShare,
        aiaAdditionsShare: TaxModel.roundPounds(periodAIAAdditionsShare),
        tradeAIAClaimedRaw: periodTradeAIAClaimRaw,
        tradeAIAClaimed: TaxModel.roundPounds(periodTradeAIAClaimRaw),
        nonTradeAIAClaimedRaw: periodNonTradeAIAClaimRaw,
        nonTradeAIAClaimed: TaxModel.roundPounds(periodNonTradeAIAClaimRaw),
        aiaClaimedRaw: periodAIAClaimRaw,
        aiaClaimed: TaxModel.roundPounds(periodAIAClaimRaw),
        slices: periodSlices,
        byFY: periodSlices,
        ctChargeRaw: periodCTChargeRaw,
        marginalReliefRaw: periodMarginalReliefRaw,
        ctCharge: TaxModel.roundPounds(periodCTChargeRaw),
        marginalRelief: TaxModel.roundPounds(periodMarginalReliefRaw)
      };
    });

    // Aggregate results across all periods
    result.property.propertyProfitAfterLossOffset = TaxModel.roundPounds(
      periodResults.reduce((s, p) => s + Number(p.propertyProfitAfterLossRaw ?? p.propertyProfitAfterLoss ?? 0), 0)
    );
    result.property.propertyBusinessIncomeForCT600 = TaxModel.roundPounds(
      Math.max(0, periodResults.reduce((s, p) => s + Number(p.propertyProfitAfterAIARaw ?? p.propertyProfitAfterAIA ?? 0), 0))
    );
    result.property.propertyLossUsed = TaxModel.roundPounds(
      periodResults.reduce((s, p) => s + Number(p.propertyLossUsedRaw ?? p.propertyLossUsed ?? 0), 0)
    );
    result.property.propertyLossAvailable = TaxModel.roundPounds(remainingPropertyLossPool);
    result.property.propertyLossCF = TaxModel.roundPounds(remainingPropertyLossPool);
    result.periods = periodResults.map((p) => ({
      period_index: p.periodIndex,
      period_name: p.periodName,
      period_start: p.periodStart,
      period_end: p.periodEnd,
      days: p.days,
      is_short_period: !!p.isShortPeriod,
      taxable_profit: p.taxableProfit,
      augmented_profit: p.augmentedProfit,
      ct_charge: p.ctCharge,
      marginal_relief: p.marginalRelief,
      slices: p.slices
    }));
    result.slices = periodResults.flatMap((p) => p.slices);
    // Backward compatibility for existing mappers/UI that still read result.byFY.
    result.byFY = result.slices;
    result.computation.addBacks = TaxModel.roundPounds(periodResults.reduce((s, p) => s + (depreciationExpense + disallowableExpenditure + otherTaxAdjustmentsAddBack) * (p.days / accountingPeriodDays), 0));
    result.computation.capitalAllowances = TaxModel.roundPounds(
      periodResults.reduce((s, p) => s + Number(p.aiaClaimedRaw ?? p.aiaClaimed ?? 0), 0)
    );
    result.computation.deductions = result.computation.capitalAllowances;
    result.computation.tradingLossUsed = TaxModel.roundPounds(
      periodResults.reduce((s, p) => s + Number(p.lossUsedRaw ?? p.lossUsed ?? 0), 0)
    );
    const totalTradingProfitAfterLossRaw = periodResults.reduce(
      (s, p) => s + Number(p.tradingProfitAfterLossRaw ?? p.tradingProfitAfterLoss ?? 0),
      0
    );
    const tradingLossBroughtForwardRemainingRaw = Math.max(0, remainingLossPool);
    const currentYearTradingLossIncurredRaw = Math.max(0, -totalTradingProfitAfterLossRaw);
    const totalTradingLossCarriedForwardRaw =
      tradingLossBroughtForwardRemainingRaw + currentYearTradingLossIncurredRaw;

    result.computation.tradingLossBroughtForwardAvailable = TaxModel.roundPounds(tradingLossBroughtForward);
    result.computation.tradingLossBroughtForwardRemaining = TaxModel.roundPounds(tradingLossBroughtForwardRemainingRaw);
    result.computation.tradingLossCurrentPeriodIncurred = TaxModel.roundPounds(currentYearTradingLossIncurredRaw);
    // Legacy alias kept for backward compatibility.
    result.computation.tradingLossAvailable = result.computation.tradingLossBroughtForwardRemaining;
    
    // taxableTradingProfit is the trading income only (after P&L, before adding interest/property)
    // This is for reporting/transparency only
    result.computation.taxableTradingProfit = TaxModel.roundPounds(totalTradingProfitAfterLossRaw);
    
    // Total taxable profit = ALL sources (trading, interest, property after loss)
    // periodResults already includes all of these.
    const totalTaxableProfitsRaw = Math.max(
      0,
      periodResults.reduce((s, p) => {
        const taxable = (p.taxableProfitRaw ?? p.taxableProfit ?? 0);
        return s + Number(taxable || 0);
      }, 0)
    );
    result.computation.taxableTotalProfits = TaxModel.roundPounds(totalTaxableProfitsRaw);
    
    // For reporting: break down the non-trading portion
    result.computation.taxableNonTradingProfits = TaxModel.roundPounds(
      periodResults.reduce((s, p) => s + Number(p.nonTradingProfitAfterAIARaw ?? p.nonTradingProfitAfterAIA ?? 0), 0)
    );
    result.computation.grossTradingProfit = TaxModel.roundPounds(
      result.computation.taxableTradingProfit + result.computation.tradingLossUsed
    );
    result.computation.profitsSubtotal = TaxModel.roundPounds(
      result.computation.taxableTradingProfit + result.computation.taxableNonTradingProfits
    );
    result.computation.subtotalBeforeDeductions = TaxModel.roundPounds(
      result.accounts.profitBeforeTax + result.computation.addBacks
    );
    result.computation.totalTradingIncome = TaxModel.roundPounds(
      tradingTurnover + governmentGrants + tradingBalancingCharges
    );
    result.computation.nonTradingIncomeExcludedFromTradingView = TaxModel.roundPounds(
      (pnl.interestIncome || 0) + propertyIncome + chargeableGains
    );
    result.computation.totalOtherIncome = TaxModel.roundPounds(
      result.property.propertyBusinessIncomeForCT600 + (pnl.interestIncome || 0) + chargeableGains + dividendIncome
    );
    result.computation.tradingLossCarriedForward = TaxModel.roundPounds(
      totalTradingLossCarriedForwardRaw
    );
    result.computation.miscellaneousIncomeNotElsewhere = 0;
    const allSlices = Array.isArray(result.slices) ? result.slices : [];
    const aiaSliceRows = allSlices.map((slice) => ({
      fy_year: slice.fy_year,
      fy_years: Array.isArray(slice.fy_years) ? slice.fy_years : [slice.fy_year],
      period_index: slice.period_index || 1,
      slice_index: slice.slice_index || 1,
      ap_days_in_fy: slice.ap_days_in_fy || 0,
      aia_limit_pro_rated: Number(slice.aia_cap_for_fy || 0)
    }));
    const aiaTotalCap = aiaSliceRows.reduce((s, row) => s + (row.aia_limit_pro_rated || 0), 0);
    const aiaRequestedTotal = Math.max(
      0,
      Number(
        inputs.capitalAllowances?.annualInvestmentAllowanceTotalAdditions || 0
      )
    );
    const aiaClaimedTotal = Math.max(0, Number(result.computation.capitalAllowances || 0));
    const aiaUnrelievedTotal = Math.max(0, aiaRequestedTotal - aiaClaimedTotal);
    let aiaParts = allocateByWeightForDisplay(aiaRequestedTotal, aiaSliceRows, 'aia_limit_pro_rated', 'aia_claim_requested');
    aiaParts = allocateByWeightForDisplay(aiaClaimedTotal, aiaParts, 'aia_limit_pro_rated', 'aia_allowance_claimed');
    aiaParts = allocateByWeightForDisplay(aiaUnrelievedTotal, aiaParts, 'aia_limit_pro_rated', 'aia_unrelieved_bfwd');
    result.computation.aiaTotalCap = TaxModel.roundPounds(aiaTotalCap);
    result.computation.aiaRequestedTotal = TaxModel.roundPounds(aiaRequestedTotal);
    result.computation.aiaUnrelievedBroughtForwardTotal = TaxModel.roundPounds(aiaUnrelievedTotal);
    result.computation.aiaAllocationNote =
      'Per-slice requested/claimed/unrelieved figures are allocated by AIA cap-share for reporting.';
    result.computation.aiaPartsByFY = aiaParts.map((row) => ({
      fyYear: Number(row.fy_year || 0),
      fyYears: Array.isArray(row.fy_years) ? row.fy_years : [Number(row.fy_year || 0)],
      periodIndex: Number(row.period_index || 1),
      sliceIndex: Number(row.slice_index || 1),
      apDaysInFY: Number(row.ap_days_in_fy || 0),
      aiaLimitProRated: TaxModel.roundPounds(row.aia_limit_pro_rated || 0),
      aiaClaimRequested: TaxModel.roundPounds(row.aia_claim_requested || 0),
      aiaAllowanceClaimed: TaxModel.roundPounds(row.aia_allowance_claimed || 0),
      aiaUnrelievedBroughtForward: TaxModel.roundPounds(row.aia_unrelieved_bfwd || 0)
    }));
    
    // Augmented profit (for rate banding) = Taxable Total + Dividend Income
    result.computation.augmentedProfits = TaxModel.roundPounds(totalTaxableProfitsRaw + dividendIncome);

    const totalCTChargeRaw = periodResults.reduce(
      (s, p) => s + Number(p.ctChargeRaw ?? p.ctCharge ?? 0),
      0
    );
    const totalMarginalReliefRaw = periodResults.reduce(
      (s, p) => s + Number(p.marginalReliefRaw ?? p.marginalRelief ?? 0),
      0
    );
    result.tax.corporationTaxCharge = TaxModel.roundPounds(totalCTChargeRaw);
    result.tax.marginalRelief = TaxModel.roundPounds(totalMarginalReliefRaw);
    result.tax.corporationTaxChargeable = result.tax.corporationTaxCharge;
    result.tax.corporationTaxTableTotal = TaxModel.roundPounds(totalCTChargeRaw + totalMarginalReliefRaw);
    result.tax.totalReliefsAndDeductions = TaxModel.roundPounds(
      communityInvestmentTaxRelief + doubleTaxationRelief + advanceCorporationTax
    );
    result.tax.totalBox500Charges = TaxModel.roundPounds(
      controlledForeignCompaniesTax +
      bankLevyPayable +
      bankSurchargePayable +
      residentialPropertyDeveloperTax
    );
    result.tax.netCTLiability = TaxModel.roundPounds(
      Math.max(0, result.tax.corporationTaxChargeable - result.tax.totalReliefsAndDeductions)
    );
    result.tax.totalTaxChargeable = TaxModel.roundPounds(
      result.tax.netCTLiability +
      loansToParticipatorsTax +
      result.tax.totalBox500Charges +
      eogplPayable +
      eglPayable +
      supplementaryChargePayable
    );
    result.tax.incomeTaxRepayable = TaxModel.roundPounds(
      Math.max(0, incomeTaxDeductedFromGrossIncome - result.tax.totalTaxChargeable)
    );
    result.tax.selfAssessmentTaxPayable = TaxModel.roundPounds(
      Math.max(0, result.tax.totalTaxChargeable - incomeTaxDeductedFromGrossIncome)
    );
    result.tax.totalSelfAssessmentTaxPayable = TaxModel.roundPounds(
      result.tax.selfAssessmentTaxPayable +
      coronavirusSupportPaymentOverpaymentNowDue +
      restitutionTax
    );
    result.tax.smallProfitsRateOrMarginalReliefEntitlement = (
      Array.isArray(result.slices) && result.slices.some(hasSmallProfitsOrMarginalReliefEntitlement)
    ) ? 'X' : '';
    result.tax.taxPayable = result.tax.totalSelfAssessmentTaxPayable;

    // Metadata: note if AP was split
    result.metadata = {
      ap_days: accountingPeriodDays,
      ap_split: hasMultiplePeriods,
      period_slice_structure_note: 'Period 1/2 are submission periods (>12 months only). Slice 1/2 are tax-regime slices within each period.',
      loss_relief_note: 'Trading losses brought forward are applied against taxable trading profits only. Unrelieved current-period trading losses are carried forward. Property losses are claimable against total profits (subject to availability and claim).',
      trading_loss_bf_available: TaxModel.roundPounds(tradingLossBroughtForward),
      trading_loss_bf_available_remaining: TaxModel.roundPounds(remainingLossPool),
      trading_loss_current_period_incurred: TaxModel.roundPounds(currentYearTradingLossIncurredRaw),
      trading_loss_cf_total: TaxModel.roundPounds(totalTradingLossCarriedForwardRaw),
      trading_loss_use_requested: TaxModel.roundPounds(requestedLossTotal),
      trading_loss_use_remaining: TaxModel.roundPounds(remainingLossUseRequested),
      property_loss_bf_available: TaxModel.roundPounds(propertyLossBroughtForward),
      property_loss_bf_available_remaining: TaxModel.roundPounds(remainingPropertyLossPool),
      property_loss_use_requested: TaxModel.roundPounds(requestedPropertyLossTotal),
      property_loss_use_remaining: TaxModel.roundPounds(remainingPropertyLossUseRequested),
      periods: periodResults.map((p) => ({
        period_index: p.periodIndex,
        name: p.periodName,
        start_date: p.periodStart,
        end_date: p.periodEnd,
        days: p.days,
        profit_before_tax: p.profitBeforeTax,
        taxable_profit: p.taxableProfit,
        augmented_profit: p.augmentedProfit,
        taxable_before_loss: p.taxableBeforeLoss,
        property_adjustment: p.propertyAdjustment,
        add_backs: p.addBacks,
        loss_used: p.lossUsed,
        loss_pool: p.lossPool,
        loss_cf: p.lossCarriedForward,
        loss_use_requested_remaining: p.lossUseRequestedRemaining,
        rental_income_gross: p.propertyRentalGross,
        property_loss_pool: p.propertyLossPool,
        property_loss_used: p.propertyLossUsed,
        property_loss_incurred_current_period: p.propertyLossIncurredCurrentPeriod,
        property_loss_used_current_period: p.propertyLossUsedCurrentPeriod,
        property_loss_unrelieved_current_period: p.propertyLossUnrelievedCurrentPeriod,
        property_loss_used_against_property_stream: p.propertyLossUsedAgainstProperty,
        property_loss_use_requested_remaining: p.propertyLossUseRequestedRemaining,
        property_loss_cf: p.propertyLossCarriedForward,
        property_profit_after_loss: p.propertyProfitAfterLoss,
        property_profit_after_aia: p.propertyProfitAfterAIA,
        trade_aia_cap_total: p.tradeAIACapTotal,
        non_trade_aia_cap_total: p.nonTradeAIACapTotal,
        aia_cap_total: p.aiaCapTotal,
        trade_aia_additions_share: p.tradeAIAAdditionsShare,
        non_trade_aia_additions_share: p.nonTradeAIAAdditionsShare,
        trade_aia_potential_claim: p.tradeAIAPotentialClaim,
        non_trade_aia_potential_claim: p.nonTradeAIAPotentialClaim,
        aia_additions_share: p.aiaAdditionsShare,
        trade_aia_claim: p.tradeAIAClaimed,
        non_trade_aia_claim: p.nonTradeAIAClaimed,
        aia_claim: p.aiaClaimed,
        marginal_relief: p.marginalRelief,
        ct_charge: p.ctCharge,
        slices: p.slices,
        by_fy: p.slices
      }))
    };

    return { inputs, result, corpTaxYears };
  }

  root.TaxEngine = { run, defaultCorpTaxYears };
})(typeof window !== 'undefined' ? window : globalThis);
