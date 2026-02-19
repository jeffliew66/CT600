/**
 * buildCTPackage.js
 * One public entry point:
 *   buildCTPackage(userInputs, { corpTaxYears?, balanceSheetData? }) 
 *   -> { inputs, taxModel, ct600Boxes, taxComputation, frs105Statements }
 *
 * Additional helper:
 *   buildCTPackagesForLongAP(userInputs, { corpTaxYears?, balanceSheetData? })
 *   -> [{...single package...}, ...]
 *   Automatically splits APs longer than 12 months into multiple <=12-month submissions.
 *
 * Works in browser (global) and can be adapted to Node with a bundler.
 * Integrates all three mappers: CT600, Tax Computation, and FRS105 Statements
 */
(function (root) {
  'use strict';

  const TaxEngine = root.TaxEngine;
  const CT600Mapper = root.CT600Mapper;
  const TaxComputationMapper = root.TaxComputationMapper;
  const FRS105StatementMapper = root.FRS105StatementMapper;

  if (!TaxEngine) throw new Error('TaxEngine not loaded. Load taxEngine.js first.');
  if (!CT600Mapper) throw new Error('CT600Mapper not loaded. Load ct600Mapper.js first.');
  if (!TaxComputationMapper) throw new Error('TaxComputationMapper not loaded. Load taxComputationMapper.js first.');
  if (!FRS105StatementMapper) throw new Error('FRS105StatementMapper not loaded. Load frs105StatementMapper.js first.');

  function parseUTCDateStrict(iso, label) {
    const s = String(iso || '').trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new Error(`Invalid ${label}. Use YYYY-MM-DD.`);
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || (dt.getUTCMonth() + 1) !== mo || dt.getUTCDate() !== d) {
      throw new Error(`Invalid ${label}. Use a real calendar date.`);
    }
    return dt;
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

  function formatISODateUTC(dateUTC) {
    const y = dateUTC.getUTCFullYear();
    const m = String(dateUTC.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateUTC.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function daysInclusive(startUTC, endUTC) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((endUTC - startUTC) / msPerDay) + 1;
  }

  function splitIntoSubmissionPeriods(startUTC, endUTC) {
    const periods = [];
    const msPerDay = 24 * 60 * 60 * 1000;
    let cursorStart = startUTC;

    while (true) {
      const twelveMonthsLater = addMonthsUTC(cursorStart, 12);
      const maxEndForThisPeriod = new Date(twelveMonthsLater.getTime() - msPerDay);
      const cursorEnd = endUTC <= maxEndForThisPeriod ? endUTC : maxEndForThisPeriod;
      periods.push({
        startUTC: cursorStart,
        endUTC: cursorEnd,
        days: daysInclusive(cursorStart, cursorEnd)
      });
      if (cursorEnd >= endUTC) break;
      cursorStart = new Date(cursorEnd.getTime() + msPerDay);
    }

    return periods;
  }

  function toFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function toOptionalNonNegative(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, n);
  }

  function apportioned(value, ratio) {
    return toFiniteNumber(value) * ratio;
  }

  function buildSubmissionInputs(baseInputs, period, totalDays, ratio, lossesCtx) {
    const out = { ...baseInputs };

    out.accountingPeriodStart = formatISODateUTC(period.startUTC);
    out.accountingPeriodEnd = formatISODateUTC(period.endUTC);

    // AP-proportioned numeric fields (matches engine's allocation basis).
    [
      'tradingTurnover',
      'governmentGrants',
      'propertyIncome',
      'interestIncome',
      'tradingBalancingCharges',
      'chargeableGains',
      'dividendIncome',
      'costOfGoodsSold',
      'staffEmploymentCosts',
      'depreciationExpense',
      'otherOperatingCharges',
      'disallowableExpenditure',
      'otherTaxAdjustmentsAddBack',
      'annualInvestmentAllowanceTradeAdditions',
      'annualInvestmentAllowanceNonTradeAdditions',
      'annualInvestmentAllowanceTotalAdditions',
      'communityInvestmentTaxRelief',
      'doubleTaxationRelief',
      'advanceCorporationTax',
      'loansToParticipatorsTax',
      'controlledForeignCompaniesTax',
      'bankLevyPayable',
      'bankSurchargePayable',
      'residentialPropertyDeveloperTax',
      'eogplPayable',
      'eglPayable',
      'supplementaryChargePayable',
      'incomeTaxDeductedFromGrossIncome',
      'coronavirusSupportPaymentOverpaymentNowDue',
      'restitutionTax'
    ].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(out, key)) {
        out[key] = apportioned(out[key], ratio);
      }
    });

    // Loss pools flow sequentially across submissions.
    out.tradingLossBroughtForward = Math.max(0, toFiniteNumber(lossesCtx.tradingLossBroughtForward));
    out.propertyLossBroughtForward = Math.max(0, toFiniteNumber(lossesCtx.propertyLossBroughtForward));

    // Respect explicit loss-usage requests by apportioning across submissions.
    // Blank/null remains auto-use per submission.
    if (lossesCtx.tradingLossRequestedRemaining == null) {
      out.tradingLossUsageRequested = null;
    } else {
      const req = lossesCtx.isLastSubmission
        ? lossesCtx.tradingLossRequestedRemaining
        : (lossesCtx.tradingLossRequestedRemaining * (period.days / Math.max(1, lossesCtx.remainingDays)));
      out.tradingLossUsageRequested = Math.max(0, req);
      lossesCtx.tradingLossRequestedRemaining = Math.max(0, lossesCtx.tradingLossRequestedRemaining - out.tradingLossUsageRequested);
    }

    if (lossesCtx.propertyLossRequestedRemaining == null) {
      out.propertyLossUsageRequested = null;
    } else {
      const req = lossesCtx.isLastSubmission
        ? lossesCtx.propertyLossRequestedRemaining
        : (lossesCtx.propertyLossRequestedRemaining * (period.days / Math.max(1, lossesCtx.remainingDays)));
      out.propertyLossUsageRequested = Math.max(0, req);
      lossesCtx.propertyLossRequestedRemaining = Math.max(0, lossesCtx.propertyLossRequestedRemaining - out.propertyLossUsageRequested);
    }

    return out;
  }

  function buildCTPackage(userInputs, options) {
    const startStr = String(userInputs?.accountingPeriodStart || '');
    const endStr = String(userInputs?.accountingPeriodEnd || '');
    const startUTC = parseUTCDateStrict(startStr, 'accountingPeriodStart');
    const endUTC = parseUTCDateStrict(endStr, 'accountingPeriodEnd');

    if (endUTC < startUTC) {
      throw new Error('Accounting period end date must be on/after start date.');
    }

    // HMRC CT600/AP rule: do not build a single submission package for periods > 12 months.
    const msPerDay = 24 * 60 * 60 * 1000;
    const twelveMonthsLater = addMonthsUTC(startUTC, 12);
    const period1End = new Date(twelveMonthsLater.getTime() - msPerDay);
    if (endUTC > period1End) {
      throw new Error('HMRC Submission Error: Accounting Period exceeds 12 months. Split into two separate submissions.');
    }

    const cfg = options || {};
    const runRes = TaxEngine.run(userInputs, cfg);
    
    const inputs = runRes.inputs;
    const result = runRes.result;
    const slices = (Array.isArray(result.slices) && result.slices.length)
      ? result.slices
      : (Array.isArray(result.byFY) ? result.byFY : []);
    const fyOverlaps = slices.length ? 
      slices.map((fy) => ({ fy_year: fy.fy_year, ap_days_in_fy: fy.ap_days_in_fy, fy_total_days: fy.fy_total_days })) 
      : [];

    // 1) CT600 boxes (classic output)
    const ct600Boxes = CT600Mapper.map(inputs, result);
    const ct600_header = {
      company_utr: String(inputs.company_utr || ''),
      company_name: String(inputs.company_name || ''),
      company_registration_number: String(inputs.company_registration_number || ''),
      return_type_or_period_indicator: String(inputs.return_type_or_period_indicator || ''),
      company_address: String(inputs.company_address || '')
    };
    const ct600_attachments = {
      accounts_and_computation_metadata: String(inputs.accounts_and_computation_metadata || '')
    };

    // 2) Tax Computation Schedule (detailed audit trail of CT charge)
    const taxComputation = TaxComputationMapper.map(inputs, result, fyOverlaps);

    // 3) FRS105 Financial Statements (P&L, Balance Sheet, Notes, Disclosures)
    const balanceSheetData = cfg.balanceSheetData || null;
    const frs105Statements = FRS105StatementMapper.map(
      inputs, 
      result, 
      balanceSheetData, 
      taxComputation, 
      { ct_rate: 0.25 }
    );

    return {
      inputs,
      taxModel: result,
      ct600Boxes,
      ct600_header,
      ct600_attachments,
      taxComputation,
      frs105Statements,
      metadata: {
        buildDate: new Date().toISOString(),
        version: '2.0',
        schemaVersion: 'HMRC CT600 v3 (2025)'
      }
    };
  }

  function buildCTPackagesForLongAP(userInputs, options) {
    const cfg = options || {};
    const startStr = String(userInputs?.accountingPeriodStart || '');
    const endStr = String(userInputs?.accountingPeriodEnd || '');
    const startUTC = parseUTCDateStrict(startStr, 'accountingPeriodStart');
    const endUTC = parseUTCDateStrict(endStr, 'accountingPeriodEnd');

    if (endUTC < startUTC) {
      throw new Error('Accounting period end date must be on/after start date.');
    }

    const periods = splitIntoSubmissionPeriods(startUTC, endUTC);
    if (periods.length <= 1) {
      const single = buildCTPackage(userInputs, cfg);
      return [single];
    }

    const totalDays = daysInclusive(startUTC, endUTC);
    const packages = [];

    let runningTradingLossBF = Math.max(0, toFiniteNumber(userInputs?.tradingLossBroughtForward));
    let runningPropertyLossBF = Math.max(0, toFiniteNumber(userInputs?.propertyLossBroughtForward));
    let remainingDays = totalDays;
    const tradingRequestedInitial = toOptionalNonNegative(userInputs?.tradingLossUsageRequested);
    const propertyRequestedInitial = toOptionalNonNegative(userInputs?.propertyLossUsageRequested);
    let tradingRequestedRemaining = tradingRequestedInitial;
    let propertyRequestedRemaining = propertyRequestedInitial;

    periods.forEach((period, idx) => {
      const isLastSubmission = idx === periods.length - 1;
      const ratio = period.days / Math.max(1, totalDays);
      const lossesCtx = {
        tradingLossBroughtForward: runningTradingLossBF,
        propertyLossBroughtForward: runningPropertyLossBF,
        tradingLossRequestedRemaining: tradingRequestedRemaining,
        propertyLossRequestedRemaining: propertyRequestedRemaining,
        remainingDays,
        isLastSubmission
      };
      const submissionInputs = buildSubmissionInputs(userInputs, period, totalDays, ratio, lossesCtx);
      const pkg = buildCTPackage(submissionInputs, cfg);

      // Carry losses into next submission period.
      runningTradingLossBF = Math.max(0, Number(
        pkg?.taxModel?.computation?.tradingLossCarriedForward ??
        pkg?.taxModel?.computation?.tradingLossBroughtForwardRemaining ??
        0
      ));
      runningPropertyLossBF = Math.max(0, Number(
        pkg?.taxModel?.property?.propertyLossCF ??
        pkg?.taxModel?.property?.propertyLossAvailable ??
        0
      ));
      tradingRequestedRemaining = lossesCtx.tradingLossRequestedRemaining;
      propertyRequestedRemaining = lossesCtx.propertyLossRequestedRemaining;
      remainingDays = Math.max(0, remainingDays - period.days);

      pkg.metadata = {
        ...(pkg.metadata || {}),
        submissionIndex: idx + 1,
        submissionCount: periods.length,
        autoSplitFromLongAP: true,
        originalAccountingPeriodStart: startStr,
        originalAccountingPeriodEnd: endStr
      };
      packages.push(pkg);
    });

    return packages;
  }

  root.buildCTPackage = buildCTPackage;
  root.buildCTPackagesForLongAP = buildCTPackagesForLongAP;
  // Alias for convenience.
  root.buildCTPackages = buildCTPackagesForLongAP;
})(typeof window !== 'undefined' ? window : globalThis);
