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
  // other tax parameters per financial year (6 Apr to 5 Apr).
  //
  // Structure:
  //   fy_year: The financial year (e.g., 2024 = FY ending 5 Apr 2024)
  //   start_date: FY start date (YYYY-MM-DD, typically 6 Apr or 1 Apr for Companies House filing)
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
    // FY 2022: flat 19% CT rate (no marginal relief regime)
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
    },
    // SAMPLE FUTURE YEAR (replace with actual rates when announced by HMRC)
    // Uncomment and update when FY 2025/26 rates are confirmed
    // {
    //   fy_year: 2025,
    //   start_date: '2025-04-01',
    //   end_date: '2026-03-31',
    //   tiers: [
    //     { index: 1, threshold: 0, rate: 0.19, relief_fraction: 0, aia_limit: 1000000 },
    //     { index: 2, threshold: 50000, rate: 0.25, relief_fraction: 0.015, aia_limit: 1000000 },
    //     { index: 3, threshold: 250000, rate: 0.25, relief_fraction: 0, aia_limit: 1000000 }
    //   ]
    // }
  ];

  function getTier(tiers, idx) {
    const t = (tiers || []).find((x) => x.index === idx);
    if (!t) throw new Error(`Missing tier index ${idx}`);
    return t;
  }

  function buildAccountingPeriodSplits(inputs, corpTaxYears) {
    // HMRC RULE: Accounting periods longer than 12 months must be split at 12-month mark.
    // Do not use a fixed 365-day cutoff because exact 12-month periods can be 366 days.
    const apDays = inputs.apDays;
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
    const divisor = (inputs.assocCompanies || 0) + 1;
    const periodDays = inputs.apDays || 1;
    const periodFactor = inputs.isShortPeriod ? (periodDays / 365) : 1;
    // AIA master cap is shared across trade/non-trade.
    // Slice cap shares sum to the period cap.
    const parts = fyOverlaps.map((fy) => {
      const annualAiaLimit = getTier(fy.tiers, 1).aia_limit;
      const periodCapFromThisFY = (annualAiaLimit * periodFactor) / divisor;
      const sliceShare = periodDays > 0 ? (fy.ap_days_in_fy / periodDays) : 0;
      const sliceMasterCap = periodCapFromThisFY * sliceShare;
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
    const divisor = (inputs.assocCompanies || 0) + 1;
    const periodDays = inputs.apDays || 1;
    const periodFactor = inputs.isShortPeriod ? (periodDays / 365) : 1;

    return fyOverlaps.map((fy) => {
      const small = getTier(fy.tiers, 2).threshold;
      const upper = getTier(fy.tiers, 3).threshold;
      // Threshold rule:
      // - full 12-month period: strict annual thresholds (50k/250k, then associates divisor)
      // - short period: annual thresholds x (period days / 365), then associates divisor
      // Slice thresholds are proportional shares of the period-level thresholds.
      const periodSmall = (small * periodFactor) / divisor;
      const periodUpper = (upper * periodFactor) / divisor;
      const sliceShare = periodDays > 0 ? (fy.ap_days_in_fy / periodDays) : 0;
      const smallForAP = periodSmall * sliceShare;
      const upperForAP = periodUpper * sliceShare;

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
    rawSlices.forEach((slice) => {
      const lower = slice.thresholds ? slice.thresholds.small_threshold_for_AP_in_this_FY : 0;
      const upper = slice.thresholds ? slice.thresholds.upper_threshold_for_AP_in_this_FY : 0;
      const signature = getRegimeSignature(slice.tiers);
      const last = grouped[grouped.length - 1];
      if (!last || last.signature !== signature) {
        grouped.push({
          signature,
          fy_years: [slice.fy_year],
          ap_days: slice.ap_days_in_fy,
          thresholds: slice.thresholds || null,
          aia_cap_for_fy: slice.aia_cap_for_fy || 0,
          taxableProfit: slice.taxableProfit || 0,
          augmentedProfit: slice.augmentedProfit || 0,
          lower_limit_sum: lower,
          upper_limit_sum: upper,
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
    });
    return grouped;
  }

  function run(userInputs, options) {
    const cfg = options || {};
    const corpTaxYears = cfg.corpTaxYears || defaultCorpTaxYears;

    const inputs = TaxModel.createInputs(userInputs);
    const result = TaxModel.createEmptyResult();

    // HMRC RULE: Split AP if > 12 months
    const apSplits = buildAccountingPeriodSplits(inputs, corpTaxYears);
    const hasMultiplePeriods = apSplits.length > 1;

    // Allocate profit and income proportionally across periods
    const allocateToPeriods = (value) => {
      return apSplits.map((period) => ({
        periodName: period.periodName,
        days: period.days,
        isShortPeriod: period.isShortPeriod,
        amount: value * (period.days / inputs.apDays)
      }));
    };

    // 1) Accounts P&L -> PBT (allocate to periods)
    // CRITICAL: Do NOT include dividend in totalIncome - dividend affects rate, not taxable profit
    const pnl = inputs.pnl;
    result.accounts.totalIncome = TaxModel.roundPounds(
      pnl.turnover + pnl.govtGrants + pnl.rentalIncome + pnl.interestIncome
      // NOTE: pnl.dividendIncome is NOT included here - handled separately for augmented profit
    );
    result.accounts.totalExpenses = TaxModel.roundPounds(
      pnl.costOfSales + pnl.staffCosts + pnl.depreciation + pnl.otherCharges
    );
    result.accounts.profitBeforeTax = TaxModel.roundPounds(result.accounts.totalIncome - result.accounts.totalExpenses);

    // 2) Property loss offset
    result.property.rentalIncome = pnl.rentalIncome;
    result.property.propertyLossBF = pnl.propertyLossBF;
    result.property.propertyProfitAfterLossOffset = Math.max(0, pnl.rentalIncome - pnl.propertyLossBF);
    result.property.propertyLossCF = Math.max(0, pnl.propertyLossBF - pnl.rentalIncome);

    // 3) Split trading losses b/fwd across AP periods (day apportionment)
    const lossPoolByPeriod = apSplits.map((period, idx) => {
      if (idx === apSplits.length - 1) return 0;
      return inputs.losses.tradingLossBF * (period.days / (inputs.apDays || 1));
    });
    if (apSplits.length) {
      const allocatedBeforeLast = lossPoolByPeriod.reduce((s, x) => s + x, 0);
      lossPoolByPeriod[apSplits.length - 1] = Math.max(0, inputs.losses.tradingLossBF - allocatedBeforeLast);
    }

    // 4) Allocate profit to each AP split period and calculate tax per period
    const periodResults = apSplits.map((period, periodIndex) => {
      // Build FY overlaps FOR THIS PERIOD ONLY
      const tmpInputs = {
        apStartUTC: period.startUTC,
        apEndUTC: period.endUTC,
        apDays: period.days,
        assocCompanies: inputs.assocCompanies,
        isShortPeriod: period.isShortPeriod
      };
      const fyOverlaps = buildFYOverlaps(tmpInputs, corpTaxYears);
      const thresholdParts = buildThresholdParts(tmpInputs, fyOverlaps);
      const aiaAlloc = buildAIAAllocation(tmpInputs, fyOverlaps, corpTaxYears);

      // Allocate inputs to this period
      const periodProfitBeforeTax = result.accounts.profitBeforeTax * (period.days / inputs.apDays);
      const periodRatio = (period.days / (inputs.apDays || 1));
      const periodDividendIncome = pnl.dividendIncome * periodRatio;
      const periodInterestIncome = pnl.interestIncome * periodRatio;
      const periodPropertyProfit = result.property.propertyProfitAfterLossOffset * periodRatio;
      // PBT already includes gross rental income and interest income.
      // Only adjust rental to net property profit after property loss offset.
      const periodPropertyAdjustment = (result.property.propertyProfitAfterLossOffset - pnl.rentalIncome) * periodRatio;

      // Add-backs
      const periodAddBacks = TaxModel.roundPounds(
        (pnl.depreciation + inputs.adjustments.disallowableExpenses + inputs.adjustments.otherAdjustments) * periodRatio
      );

      // Capital allowances (AIA) - separate trade/non-trade buckets and caps
      const periodAIACapTotal = aiaAlloc.totalCap;
      const periodTradeAIAAdditionsShare = inputs.capitalAllowances.aiaTradeAdditions * periodRatio;
      const periodNonTradeAIAAdditionsShare = inputs.capitalAllowances.aiaNonTradeAdditions * periodRatio;
      const periodAIAAdditionsShare = periodTradeAIAAdditionsShare + periodNonTradeAIAAdditionsShare;

      // Taxable total profit base (before losses), then apply AIA to trade/non-trade separately.
      const periodTaxableBeforeAIA = TaxModel.roundPounds(
        periodProfitBeforeTax + periodAddBacks + periodPropertyAdjustment
      );
      const periodNonTradingBeforeAIA = TaxModel.roundPounds(periodInterestIncome + periodPropertyProfit);
      const periodTradingBeforeAIA = TaxModel.roundPounds(periodTaxableBeforeAIA - periodNonTradingBeforeAIA);
      const tradePotentialClaim = Math.min(periodTradeAIAAdditionsShare, Math.max(0, periodTradingBeforeAIA));
      const nonTradePotentialClaim = Math.min(periodNonTradeAIAAdditionsShare, Math.max(0, periodNonTradingBeforeAIA));
      const sharedCapClaims = allocateSharedCap(tradePotentialClaim, nonTradePotentialClaim, periodAIACapTotal);
      const periodTradeAIAClaim = TaxModel.roundPounds(sharedCapClaims.tradeClaim);
      const periodNonTradeAIAClaim = TaxModel.roundPounds(sharedCapClaims.nonTradeClaim);
      const periodAIAClaim = periodTradeAIAClaim + periodNonTradeAIAClaim;
      const periodTradingAfterAIA = TaxModel.roundPounds(periodTradingBeforeAIA - periodTradeAIAClaim);
      const periodNonTradingAfterAIA = TaxModel.roundPounds(periodNonTradingBeforeAIA - periodNonTradeAIAClaim);
      const periodTaxableBeforeLoss = TaxModel.roundPounds(periodTradingAfterAIA + periodNonTradingAfterAIA);

      // Trading losses b/fwd (split by AP period) reduce trading profits only.
      const periodLossPool = lossPoolByPeriod[periodIndex] || 0;
      const periodLossUsed = Math.min(periodLossPool, Math.max(0, periodTradingAfterAIA));
      const periodTradingAfterLoss = TaxModel.roundPounds(periodTradingAfterAIA - periodLossUsed);

      const periodTaxableAfterLoss = TaxModel.roundPounds(periodTradingAfterLoss + periodNonTradingAfterAIA);
      const periodTaxableTotal = Math.max(0, periodTaxableAfterLoss);
      // Augmented profit includes taxable profit + dividend income (for rate banding)
      const periodAugmentedProfit = TaxModel.roundPounds(periodTaxableTotal + periodDividendIncome);

      // Build raw FY slices first, then collapse contiguous slices when tax regime is unchanged.
      // This enforces whole-period MR logic when rates/thresholds are unchanged across FY boundaries.
      const rawPeriodByFY = fyOverlaps.map((fy) => {
        const th = thresholdParts.find((t) => t.fy_year === fy.fy_year);
        const tp = periodTaxableTotal * (fy.ap_days_in_fy / period.days);
        const ap = periodAugmentedProfit * (fy.ap_days_in_fy / period.days);

        return {
          period_index: periodIndex + 1,
          period_name: period.periodName,
          fy_year: fy.fy_year,
          ap_days_in_fy: fy.ap_days_in_fy,
          thresholds: th || null,
          aia_cap_for_fy: aiaAlloc.parts.find((p) => p.fy_year === fy.fy_year)?.aia_cap_for_fy || 0,
          taxableProfit: tp,
          augmentedProfit: ap,
          tiers: fy.tiers
        };
      });

      const groupedPeriodByFY = collapseSlicesByRegime(rawPeriodByFY);
      const periodByFY = groupedPeriodByFY.map((grp) => {
        const lower = grp.lower_limit_sum || 0;
        const upper = grp.upper_limit_sum || 0;
        const computed = computeTaxPerFY({
          fy_year: grp.fy_years[0],
          taxableProfit: grp.taxableProfit,
          augmentedProfit: grp.augmentedProfit,
          lowerLimit: lower,
          upperLimit: upper,
          tiers: grp.tiers
        });
        return {
          period_index: periodIndex + 1,
          period_name: period.periodName,
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
          small_rate: getTier(grp.tiers, 1).rate,
          main_rate: getTier(grp.tiers, 3).rate,
          relief_fraction: getTier(grp.tiers, 2).relief_fraction,
          regime_grouped: grp.fy_years.length > 1
        };
      });

      return {
        periodName: period.periodName,
        days: period.days,
        isShortPeriod: period.isShortPeriod,
        profitBeforeTax: TaxModel.roundPounds(periodProfitBeforeTax),
        taxableProfit: periodTaxableTotal,
        tradingProfitAfterLoss: periodTradingAfterLoss,
        nonTradingProfitAfterAIA: periodNonTradingAfterAIA,
        augmentedProfit: periodAugmentedProfit,
        lossPool: TaxModel.roundPounds(periodLossPool),
        lossUsed: TaxModel.roundPounds(periodLossUsed),
        propertyAdjustment: TaxModel.roundPounds(periodPropertyAdjustment),
        taxableBeforeLoss: TaxModel.roundPounds(periodTaxableBeforeLoss),
        addBacks: TaxModel.roundPounds(periodAddBacks),
        tradeAIACapTotal: TaxModel.roundPounds(periodAIACapTotal),
        nonTradeAIACapTotal: TaxModel.roundPounds(periodAIACapTotal),
        aiaCapTotal: TaxModel.roundPounds(periodAIACapTotal),
        tradeAIAPotentialClaim: TaxModel.roundPounds(tradePotentialClaim),
        nonTradeAIAPotentialClaim: TaxModel.roundPounds(nonTradePotentialClaim),
        tradeAIAAdditionsShare: TaxModel.roundPounds(periodTradeAIAAdditionsShare),
        nonTradeAIAAdditionsShare: TaxModel.roundPounds(periodNonTradeAIAAdditionsShare),
        aiaAdditionsShare: TaxModel.roundPounds(periodAIAAdditionsShare),
        tradeAIAClaimed: TaxModel.roundPounds(periodTradeAIAClaim),
        nonTradeAIAClaimed: TaxModel.roundPounds(periodNonTradeAIAClaim),
        aiaClaimed: TaxModel.roundPounds(periodAIAClaim),
        byFY: periodByFY,
        ctCharge: TaxModel.roundPounds(periodByFY.reduce((s, x) => s + (x.ctCharge || 0), 0)),
        marginalRelief: TaxModel.roundPounds(periodByFY.reduce((s, x) => s + (x.marginalRelief || 0), 0))
      };
    });

    // Aggregate results across all periods
    result.byFY = periodResults.flatMap((p) => p.byFY);
    result.computation.addBacks = TaxModel.roundPounds(periodResults.reduce((s, p) => s + (pnl.depreciation + inputs.adjustments.disallowableExpenses + inputs.adjustments.otherAdjustments) * (p.days / inputs.apDays), 0));
    result.computation.capitalAllowances = TaxModel.roundPounds(periodResults.reduce((s, p) => s + p.aiaClaimed, 0));
    result.computation.deductions = result.computation.capitalAllowances;
    result.computation.tradingLossUsed = TaxModel.roundPounds(periodResults.reduce((s, p) => s + (p.lossUsed || 0), 0));
    
    // taxableTradingProfit is the trading income only (after P&L, before adding interest/property)
    // This is for reporting/transparency only
    result.computation.taxableTradingProfit = TaxModel.roundPounds(Math.max(0, periodResults.reduce((s, p) => s + (p.tradingProfitAfterLoss || 0), 0)));
    
    // Total taxable profit = ALL sources (trading, interest, property after loss)
    // periodResults already includes all of these
    result.computation.taxableTotalProfits = Math.max(0, periodResults.reduce((s, p) => s + p.taxableProfit, 0));
    
    // For reporting: break down the non-trading portion
    result.computation.taxableNonTradingProfits = TaxModel.roundPounds(
      Math.max(0, periodResults.reduce((s, p) => s + (p.nonTradingProfitAfterAIA || 0), 0))
    );
    
    // Augmented profit (for rate banding) = Taxable Total + Dividend Income
    result.computation.augmentedProfits = TaxModel.roundPounds(result.computation.taxableTotalProfits + pnl.dividendIncome);

    result.tax.corporationTaxCharge = TaxModel.roundPounds(periodResults.reduce((s, p) => s + p.ctCharge, 0));
    result.tax.marginalRelief = TaxModel.roundPounds(periodResults.reduce((s, p) => s + p.marginalRelief, 0));
    result.tax.taxPayable = result.tax.corporationTaxCharge;

    // Metadata: note if AP was split
    result.metadata = {
      ap_days: inputs.apDays,
      ap_split: hasMultiplePeriods,
      periods: periodResults.map((p) => ({
        name: p.periodName,
        days: p.days,
        profit_before_tax: p.profitBeforeTax,
        taxable_profit: p.taxableProfit,
        augmented_profit: p.augmentedProfit,
        taxable_before_loss: p.taxableBeforeLoss,
        property_adjustment: p.propertyAdjustment,
        add_backs: p.addBacks,
        loss_used: p.lossUsed,
        loss_pool: p.lossPool,
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
        by_fy: p.byFY
      }))
    };

    return { inputs, result, corpTaxYears };
  }

  root.TaxEngine = { run, defaultCorpTaxYears };
})(typeof window !== 'undefined' ? window : globalThis);
