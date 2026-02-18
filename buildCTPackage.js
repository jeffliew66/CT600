/**
 * buildCTPackage.js
 * One public entry point:
 *   buildCTPackage(userInputs, { corpTaxYears?, balanceSheetData? }) 
 *   -> { inputs, taxModel, ct600Boxes, taxComputation, frs105Statements }
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

  function buildCTPackage(userInputs, options) {
    const startStr = String(userInputs?.accountingPeriodStart ?? userInputs?.apStart ?? '');
    const endStr = String(userInputs?.accountingPeriodEnd ?? userInputs?.apEnd ?? '');
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
    const fyOverlaps = result.byFY ? 
      result.byFY.map((fy) => ({ fy_year: fy.fy_year, ap_days_in_fy: fy.ap_days_in_fy, fy_total_days: fy.fy_total_days })) 
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

  root.buildCTPackage = buildCTPackage;
})(typeof window !== 'undefined' ? window : globalThis);
