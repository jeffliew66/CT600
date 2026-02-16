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

  function buildCTPackage(userInputs, options) {
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
        schemaVersion: 'HMRC CT600 2024'
      }
    };
  }

  root.buildCTPackage = buildCTPackage;
})(typeof window !== 'undefined' ? window : globalThis);
