// Web UI for HMRC v2 Tax Calculator
// Uses TaxEngine.run() for HMRC-compliant calculations with AP splitting, MR, thresholds
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  function toNum(v){ return Number(v) || 0; }
  function toOptionalNum(v){
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function roundPounds(n){ return Math.round((Number(n) || 0)); }
  function pct(n){ return (Number(n) * 100).toFixed(2); }
  function pounds(n){ return `GBP ${roundPounds(n).toLocaleString()}`; }
  function isCompleteISODate(v){ return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
  function setStatus(msg, type){
    const el = $('calcStatus');
    if (!el) return;
    el.textContent = msg || '';
    if (type) el.dataset.type = type;
    else delete el.dataset.type;
  }

  const FIELD_TAXONOMY_MAP = {
    apStart: {
      variableName: 'inputs.accountingPeriodStart',
      ct600Mapping: 'box_30_period_start',
      taxComputationMapping: '-'
    },
    apEnd: {
      variableName: 'inputs.accountingPeriodEnd',
      ct600Mapping: 'box_35_period_end',
      taxComputationMapping: '-'
    },
    assocCompanies: {
      variableName: 'inputs.associatedCompanyCount',
      ct600Mapping: 'box_326_assoc_companies, box_327_assoc_companies, box_328_assoc_companies (as applicable by FY overlap)',
      taxComputationMapping: '-'
    },
    turnover: {
      variableName: 'inputs.pnl.tradingTurnover',
      ct600Mapping: 'box_145_trade_turnover',
      taxComputationMapping: 'profit_adjustment_schedule.trading_income_components.turnover'
    },
    govtGrants: {
      variableName: 'inputs.pnl.governmentGrants',
      ct600Mapping: '-',
      taxComputationMapping: 'profit_adjustment_schedule.trading_income_components.govt_grants'
    },
    disposalGains: {
      variableName: 'inputs.pnl.tradingBalancingCharges',
      ct600Mapping: '_trading_balancing_charges (custom)',
      taxComputationMapping: 'profit_adjustment_schedule.trading_income_components.asset_disposal_proceeds_balancing_charges'
    },
    rawMaterials: {
      variableName: 'inputs.pnl.costOfGoodsSold',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    staffCosts: {
      variableName: 'inputs.pnl.staffEmploymentCosts',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    depreciation: {
      variableName: 'inputs.pnl.depreciationExpense',
      ct600Mapping: '-',
      taxComputationMapping: 'profit_adjustment_schedule.add_backs.depreciation_disallowed'
    },
    otherCharges: {
      variableName: 'inputs.pnl.otherOperatingCharges',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    disallowableExpenses: {
      variableName: 'inputs.adjustments.disallowableExpenditure',
      ct600Mapping: '-',
      taxComputationMapping: 'profit_adjustment_schedule.add_backs.disallowable_expenses'
    },
    otherAdjustments: {
      variableName: 'inputs.adjustments.otherTaxAdjustmentsAddBack',
      ct600Mapping: '-',
      taxComputationMapping: 'profit_adjustment_schedule.add_backs.other_adjustments_add_back'
    },
    aiaTrade: {
      variableName: 'inputs.capitalAllowances.annualInvestmentAllowanceTradeAdditions',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    tradingLossUseRequested: {
      variableName: 'inputs.losses.tradingLossUsageRequested',
      ct600Mapping: '-',
      taxComputationMapping: 'trading_loss_schedule.trading_loss_use_requested'
    },
    outTradingLossAvailableRemaining: {
      variableName: 'result.computation.tradingLossAvailable',
      ct600Mapping: '- (internal display only)',
      taxComputationMapping: '-'
    },
    propertyLossUseRequested: {
      variableName: 'inputs.losses.propertyLossUsageRequested',
      ct600Mapping: 'box_250_property_business_losses_used (used figure after engine caps; claimed against total profits)',
      taxComputationMapping: '-'
    },
    interestIncome: {
      variableName: 'inputs.pnl.interestIncome',
      ct600Mapping: 'box_170_non_trading_loan_relationship_profits (disclosure heading; not net taxable-interest)',
      taxComputationMapping: 'profit_adjustment_schedule.other_income.interest_income'
    },
    rentalIncome: {
      variableName: 'inputs.pnl.propertyIncome',
      ct600Mapping: '- (CT600 uses derived property business income in box_190)',
      taxComputationMapping: '-'
    },
    aiaNonTrade: {
      variableName: 'inputs.capitalAllowances.annualInvestmentAllowanceNonTradeAdditions',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    dividendIncome: {
      variableName: 'inputs.pnl.dividendIncome',
      ct600Mapping: 'box_620_franked_investment_income_exempt_abgh',
      taxComputationMapping: 'profit_adjustment_schedule.other_income.dividend_income'
    },
    outTradingIncomeTotal: {
      variableName: '<derived: total trading income components>',
      ct600Mapping: '-',
      taxComputationMapping: 'profit_adjustment_schedule.trading_income_components.total_trading_income'
    },
    outTradingExpenseTotal: {
      variableName: '<derived: total trading expenses>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outTradingProfits: {
      variableName: '<derived: accounting trading result>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outTradingProfitsTaxable: {
      variableName: 'result.computation.taxableTradingProfit',
      ct600Mapping: 'box_165_net_trading_profits',
      taxComputationMapping: 'profit_adjustment_schedule.net_trading_profit'
    },
    outTradingLossBFAvailable: {
      variableName: 'inputs.losses.tradingLossBroughtForward',
      ct600Mapping: '-',
      taxComputationMapping: 'trading_loss_schedule.trading_loss_bfwd_available'
    },
    outPropertyLossBFAvailable: {
      variableName: 'inputs.pnl.propertyLossBroughtForward',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outPropertyLossAvailableRemaining: {
      variableName: 'result.property.propertyLossAvailable',
      ct600Mapping: '- (internal display only)',
      taxComputationMapping: '-'
    },
    outRentalPropertyTotal: {
      variableName: '<derived: rental/property stream after offsets>',
      ct600Mapping: '-',
      taxComputationMapping: 'profit_adjustment_schedule.other_income.rental_income_net'
    },
    outNonTradingProfits: {
      variableName: '<derived: non-trading + dividends display total>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outNonTradingProfitsTaxable: {
      variableName: 'result.computation.taxableNonTradingProfits',
      ct600Mapping: 'box_235_profits_subtotal (derived component)',
      taxComputationMapping: '-'
    },
    outTotalProfitsCTTrade: {
      variableName: 'result.computation.taxableTradingProfit',
      ct600Mapping: 'box_165_net_trading_profits',
      taxComputationMapping: 'profit_adjustment_schedule.net_trading_profit'
    },
    outTotalProfitsCTNonTrade: {
      variableName: 'result.computation.taxableNonTradingProfits',
      ct600Mapping: 'box_235_profits_subtotal (derived component)',
      taxComputationMapping: '-'
    },
    ttProfitsChargeable: {
      variableName: 'result.computation.taxableTotalProfits',
      ct600Mapping: 'box_315_taxable_profit',
      taxComputationMapping: 'summary.taxable_total_profits'
    },
    corpTaxPayable: {
      variableName: 'result.tax.taxPayable',
      ct600Mapping: 'box_528_total_self_assessment_tax_payable (formula chain dependent)',
      taxComputationMapping: 'summary.tax_payable'
    },
    outApDays: {
      variableName: 'inputs.accountingPeriodDays',
      ct600Mapping: '-',
      taxComputationMapping: 'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].ap_days_in_fy'
    },
    outAssocDivisor: {
      variableName: '<derived: inputs.associatedCompanyCount + 1>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outLowerBracket: {
      variableName: '<derived: effective lower threshold>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outLowerRate: {
      variableName: '<derived: small profits rate>',
      ct600Mapping: '-',
      taxComputationMapping: 'tax_calculation_table.computation_by_fy[].main_rate (context dependent)'
    },
    outUpperBracket: {
      variableName: '<derived: effective upper threshold>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outUpperRate: {
      variableName: '<derived: main rate>',
      ct600Mapping: '-',
      taxComputationMapping: 'tax_calculation_table.computation_by_fy[].main_rate'
    },
    outP1RevenueShare: {
      variableName: '<derived: period 1 apportioned accounting income>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outP1ProfitBeforeTax: {
      variableName: '<derived: period 1 profit before tax>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outP1LowerBracket: {
      variableName: '<derived: period 1 lower threshold>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outP1UpperBracket: {
      variableName: '<derived: period 1 upper threshold>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outP1TaxableProfit: {
      variableName: '<derived: period 1 taxable profit>',
      ct600Mapping: '-',
      taxComputationMapping: 'tax_calculation_table.computation_by_fy[].taxable_profit'
    },
    outP1AIAClaimed: {
      variableName: '<derived: period 1 AIA claimed>',
      ct600Mapping: '-',
      taxComputationMapping: 'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_allowance_claimed'
    },
    outP1MarginalRelief: {
      variableName: '<derived: period 1 marginal relief>',
      ct600Mapping: '-',
      taxComputationMapping: 'tax_calculation_table.computation_by_fy[].marginal_relief_reduction'
    },
    outP2RevenueShare: {
      variableName: '<derived: period 2 apportioned accounting income>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outP2ProfitBeforeTax: {
      variableName: '<derived: period 2 profit before tax>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outP2LowerBracket: {
      variableName: '<derived: period 2 lower threshold>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outP2UpperBracket: {
      variableName: '<derived: period 2 upper threshold>',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    },
    outP2TaxableProfit: {
      variableName: '<derived: period 2 taxable profit>',
      ct600Mapping: '-',
      taxComputationMapping: 'tax_calculation_table.computation_by_fy[].taxable_profit'
    },
    outP2AIAClaimed: {
      variableName: '<derived: period 2 AIA claimed>',
      ct600Mapping: '-',
      taxComputationMapping: 'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_allowance_claimed'
    },
    outP2MarginalRelief: {
      variableName: '<derived: period 2 marginal relief>',
      ct600Mapping: '-',
      taxComputationMapping: 'tax_calculation_table.computation_by_fy[].marginal_relief_reduction'
    },
    outTTPVar: {
      variableName: 'result.computation.taxableTotalProfits',
      ct600Mapping: 'box_315_taxable_profit',
      taxComputationMapping: 'summary.taxable_total_profits'
    },
    outAugmentedProfitsVar: {
      variableName: 'result.computation.augmentedProfits',
      ct600Mapping: '-',
      taxComputationMapping: 'summary.augmented_profits'
    },
    outTotalAIAClaimedVar: {
      variableName: 'result.computation.capitalAllowances',
      ct600Mapping: '-',
      taxComputationMapping: 'capital_allowances_schedule.total_capital_allowances'
    },
    outTotalMarginalReliefVar: {
      variableName: 'result.tax.marginalRelief',
      ct600Mapping: 'box_435_marginal_relief',
      taxComputationMapping: 'summary.marginal_relief_total'
    }
  };

  function getFieldTaxonomyInfo(fieldId){
    const mapped = FIELD_TAXONOMY_MAP[fieldId];
    if (mapped) return mapped;
    return {
      variableName: '-',
      ct600Mapping: '-',
      taxComputationMapping: '-'
    };
  }

  function compute(opts){
    const options = opts || {};
    try {
    const apStartValue = $("apStart").value;
    const apEndValue = $("apEnd").value;
    if (!isCompleteISODate(apStartValue) || !isCompleteISODate(apEndValue)) {
      setStatus('Enter complete start and end dates (YYYY-MM-DD) to calculate.', 'warn');
      return;
    }

    // Collect all form inputs
    const capitalGainsFileInput = $("capitalGainsFile") || $("chargeableGainsFile");
    const capitalGainsFileName = (capitalGainsFileInput && capitalGainsFileInput.files && capitalGainsFileInput.files[0])
      ? capitalGainsFileInput.files[0].name
      : '';
    const legacyChargeableGainsInput = $("chargeableGains") ? toNum($("chargeableGains").value) : 0;
    const capitalGainsInput = $("capitalGains") ? toNum($("capitalGains").value) : legacyChargeableGainsInput;
    const tradingLossBFInput = toNum($("tradingLossBF").value);
    const propertyLossBFInput = toNum($("rentalLossBF").value);
    const userInputs = {
      apStart: apStartValue,
      apEnd: apEndValue,
      assocCompanies: toNum($("assocCompanies").value),
      // P&L income
      turnover: toNum($("turnover").value),
      govtGrants: toNum($("govtGrants").value),
      rentalIncome: toNum($("rentalIncome").value),
      interestIncome: toNum($("interestIncome").value),
      disposalGains: $("disposalGains") ? toNum($("disposalGains").value) : 0,
      capitalGains: capitalGainsInput,
      capitalGainsFileName,
      dividendIncome: toNum($("dividendIncome").value),
      // P&L expenses
      costOfSales: toNum($("rawMaterials").value),
      staffCosts: toNum($("staffCosts").value),
      depreciation: toNum($("depreciation").value),
      otherCharges: toNum($("otherCharges").value),
      // Tax adjustments
      disallowableExpenses: toNum($("disallowableExpenses").value),
      otherAdjustments: toNum($("otherAdjustments").value),
      aiaTradeAdditions: toNum($("aiaTrade").value),
      aiaNonTradeAdditions: toNum($("aiaNonTrade").value),
      aiaAdditions: toNum($("aiaTrade").value) + toNum($("aiaNonTrade").value),
      // Loss carry-forward
      tradingLossBF: tradingLossBFInput,
      tradingLossUseRequested: toOptionalNum($("tradingLossUseRequested").value),
      propertyLossUseRequested: toOptionalNum($("propertyLossUseRequested").value),
      propertyLossBF: propertyLossBFInput
    };
    const engineInputs = {
      accountingPeriodStart: userInputs.apStart,
      accountingPeriodEnd: userInputs.apEnd,
      associatedCompanyCount: userInputs.assocCompanies,
      tradingTurnover: userInputs.turnover,
      governmentGrants: userInputs.govtGrants,
      propertyIncome: userInputs.rentalIncome,
      propertyLossBroughtForward: userInputs.propertyLossBF,
      propertyLossUsageRequested: userInputs.propertyLossUseRequested,
      interestIncome: userInputs.interestIncome,
      tradingBalancingCharges: userInputs.disposalGains,
      chargeableGains: userInputs.capitalGains,
      chargeableGainsComputationFileName: userInputs.capitalGainsFileName,
      dividendIncome: userInputs.dividendIncome,
      costOfGoodsSold: userInputs.costOfSales,
      staffEmploymentCosts: userInputs.staffCosts,
      depreciationExpense: userInputs.depreciation,
      otherOperatingCharges: userInputs.otherCharges,
      disallowableExpenditure: userInputs.disallowableExpenses,
      otherTaxAdjustmentsAddBack: userInputs.otherAdjustments,
      annualInvestmentAllowanceTradeAdditions: userInputs.aiaTradeAdditions,
      annualInvestmentAllowanceNonTradeAdditions: userInputs.aiaNonTradeAdditions,
      annualInvestmentAllowanceTotalAdditions: userInputs.aiaAdditions,
      tradingLossBroughtForward: userInputs.tradingLossBF,
      tradingLossUsageRequested: userInputs.tradingLossUseRequested
    };

    // Call TaxEngine (HMRC-compliant with AP splitting, thresholds, MR)
    const { inputs, result, corpTaxYears } = TaxEngine.run(engineInputs, {});
    
    // DEBUG: Full calculation output
    console.log('----------------------------------------------------------------');
    console.log('TAX CALCULATION DEBUG OUTPUT');
    console.log('----------------------------------------------------------------');
    console.log('AP:', userInputs.apStart, 'to', userInputs.apEnd);
    console.log('AP Days:', inputs.accountingPeriodDays, '| Associates:', userInputs.assocCompanies, '| Divisor:', (userInputs.assocCompanies || 0) + 1);
    console.log('Turnover:', userInputs.turnover, '| Expenses:', userInputs.costOfSales + userInputs.staffCosts + userInputs.depreciation + userInputs.otherCharges);
    console.log('');
    console.log('PERIODS:');
    result.metadata.periods.forEach((p, i) => {
      console.log(`  Prd${i+1}: ${p.days}d | TxPrf=GBP ${p.taxable_profit.toLocaleString()} | CT=GBP ${p.ct_charge.toLocaleString()}`);
    });
    console.log('');
    console.log('BY FY:');
    result.byFY.forEach(fy => {
      const thresholds = result.metadata.thresholds?.[fy.fy_year] || {};
      console.log(`  FY${fy.fy_year}: Thresholds[Lower/Upper]=GBP ${(thresholds.small || '?').toLocaleString?.()}/GBP ${(thresholds.upper || '?').toLocaleString?.()}`);
      console.log(`    TaxPrf=GBP ${Math.round(fy.taxableProfit).toLocaleString()} | AugPrf=GBP ${Math.round(fy.augmentedProfit).toLocaleString()} | CT=GBP ${Math.round(fy.ctCharge).toLocaleString()} | MR=GBP ${Math.round(fy.marginalRelief).toLocaleString()}`);
    });
    console.log('');
    console.log('TOTAL CT: GBP ' + result.tax.corporationTaxCharge.toLocaleString());
    console.log('----------------------------------------------------------------');
    
    const totalIncome = result.accounts.totalIncome;
    const totalExpenses = result.accounts.totalExpenses;
    const profitBeforeTax = result.accounts.profitBeforeTax;
    const taxableTradingProfit = result.computation.taxableTradingProfit;
    const taxableNonTradeIncome = result.computation.taxableNonTradingProfits;
    const taxableTotalProfits = result.computation.taxableTotalProfits;
    const augmentedProfits = result.computation.augmentedProfits;
    const corporationTaxCharge = result.tax.corporationTaxCharge;
    const marginalRelief = result.tax.marginalRelief;
    const profitForPeriod = profitBeforeTax - corporationTaxCharge;

    // Helper to set readonly output fields
    const setOut = (id, value, formula, details) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value;
      el.dataset.formula = formula || '';
      el.dataset.details = details || '';
      el.classList.add('clickable');
    };
    const setOutNumeric = (id, value, formula, details) => {
      setOut(id, roundPounds(value), formula, details);
      const el = document.getElementById(id);
      if (!el) return;
      el.dataset.raw = String(value);
      el.dataset.orig = String(roundPounds(value));
    };
    const setRawMeta = (id, raw, orig) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.dataset.raw = String(raw);
      el.dataset.orig = String(orig);
    };

    // Populate P&L fields
    const tradeAccountingIncome = userInputs.turnover + userInputs.govtGrants + userInputs.disposalGains;
    const otherAccountingIncome =
      userInputs.interestIncome +
      userInputs.rentalIncome +
      userInputs.capitalGains;
    setOut(
      "totalIncome",
      roundPounds(totalIncome),
      "Total accounting income = trade income + other income (dividends excluded)",
      `Trade income = Turnover + Govt grants + Asset disposal proceeds\n` +
      `= ${pounds(userInputs.turnover)} + ${pounds(userInputs.govtGrants)} + ${pounds(userInputs.disposalGains)} = ${pounds(tradeAccountingIncome)}\n` +
      `Other income = Interest + Rental + Capital gains\n` +
      `= ${pounds(userInputs.interestIncome)} + ${pounds(userInputs.rentalIncome)} + ${pounds(userInputs.capitalGains)} = ${pounds(otherAccountingIncome)}\n` +
      `Total accounting income = ${pounds(tradeAccountingIncome)} + ${pounds(otherAccountingIncome)} = ${pounds(totalIncome)}`
    );
    setRawMeta('totalIncome', totalIncome, roundPounds(totalIncome));

    setOut(
      'totalExpenses',
      roundPounds(totalExpenses),
      'Total expenses = Raw materials + Staff + Depreciation + Other charges',
      `Raw materials ${pounds(userInputs.costOfSales)} + Staff ${pounds(userInputs.staffCosts)} + Depreciation ${pounds(userInputs.depreciation)} + Other charges ${pounds(userInputs.otherCharges)} = ${pounds(totalExpenses)}`
    );
    setRawMeta('totalExpenses', totalExpenses, roundPounds(totalExpenses));

    // Detailed PBT formula
    const pbtDetail = `STEP-BY-STEP CALCULATION:\n\nTotal Income (accounting, excludes dividends)\n  = Turnover + Govt Grants + Asset disposal proceeds + Interest + Rental + Capital gains\n  = GBP ${roundPounds(userInputs.turnover).toLocaleString()} + GBP ${roundPounds(userInputs.govtGrants).toLocaleString()} + GBP ${roundPounds(userInputs.disposalGains).toLocaleString()} + GBP ${roundPounds(userInputs.interestIncome).toLocaleString()} + GBP ${roundPounds(userInputs.rentalIncome).toLocaleString()} + GBP ${roundPounds(userInputs.capitalGains).toLocaleString()}\n  = GBP ${roundPounds(totalIncome).toLocaleString()}\n\nTotal Expenses\n  = Raw Materials + Staff + Depreciation + Other\n  = GBP ${roundPounds(userInputs.costOfSales).toLocaleString()} + GBP ${roundPounds(userInputs.staffCosts).toLocaleString()} + GBP ${roundPounds(userInputs.depreciation).toLocaleString()} + GBP ${roundPounds(userInputs.otherCharges).toLocaleString()}\n  = GBP ${roundPounds(totalExpenses).toLocaleString()}\n\nProfit Before Tax\n  = Total Income - Total Expenses\n  = GBP ${roundPounds(totalIncome).toLocaleString()} - GBP ${roundPounds(totalExpenses).toLocaleString()}\n  = GBP ${roundPounds(profitBeforeTax).toLocaleString()}`;
    setOut('profitBeforeTax', roundPounds(profitBeforeTax), 'Total Income - Total Expenses', pbtDetail);
    setRawMeta('profitBeforeTax', profitBeforeTax, roundPounds(profitBeforeTax));

    // Tax calculation with AP split info
    const apDays = inputs.accountingPeriodDays;
    const isSplit = !!(result.metadata && result.metadata.ap_split);
    const divisor = (userInputs.assocCompanies || 0) + 1;
    const annualSmallThreshold = 50000 / divisor;
    const annualUpperThreshold = 250000 / divisor;
    const sliceSource = (Array.isArray(result.slices) && result.slices.length) ? result.slices : (result.byFY || []);
    const fySlices = sliceSource.map((fy, idx) => ({
      idx: idx + 1,
      fyYear: fy.fy_year,
      fyYears: fy.fy_years || [fy.fy_year],
      days: fy.ap_days_in_fy || 0,
      taxableProfit: fy.taxableProfit || 0,
      augmentedProfit: fy.augmentedProfit || 0,
      ctCharge: fy.ctCharge || 0,
      marginalRelief: fy.marginalRelief || 0,
      smallRate: Number(fy.small_rate ?? 0.19),
      mainRate: Number(fy.main_rate ?? 0.25),
      reliefFraction: Number(fy.relief_fraction ?? 0.015),
      regimeGrouped: !!fy.regime_grouped,
      lower: fy.thresholds ? fy.thresholds.small_threshold_for_AP_in_this_FY : 0,
      upper: fy.thresholds ? fy.thresholds.upper_threshold_for_AP_in_this_FY : 0
    }));
    const effectiveLowerThreshold = fySlices.reduce((s, x) => s + (x.lower || 0), 0);
    const effectiveUpperThreshold = fySlices.reduce((s, x) => s + (x.upper || 0), 0);
    const hasStraddling = fySlices.length > 1;
    const hasMarginalRelief = fySlices.some((s) => s.marginalRelief > 0);
    let taxDetail = ``;
    if (isSplit) {
      taxDetail += `WARNING: ACCOUNTING PERIOD SPLIT (HMRC Rule)\n\n`;
      const p1 = (result.metadata && result.metadata.periods && result.metadata.periods[0]) || null;
      const p2 = (result.metadata && result.metadata.periods && result.metadata.periods[1]) || null;
      taxDetail += `AP Length: ${apDays} days (> 12 months)\n`;
      taxDetail += `  Period 1: 12 months (${p1 ? p1.days : '?'} days)\n`;
      taxDetail += `  Period 2: Short period (${p2 ? p2.days : '?'} days)\n\n`;
      taxDetail += `Each period is taxed separately with its own thresholds and AIA cap calculation.\n\n`;
    }
    
    taxDetail += `TAXABLE PROFIT & AUGMENTED PROFIT:\n`;
    taxDetail += `  Taxable Total Profits: GBP ${roundPounds(taxableTotalProfits).toLocaleString()}\n`;
    taxDetail += `  Dividend Income (NOT in TTP): GBP ${roundPounds(userInputs.dividendIncome).toLocaleString()}\n`;
    taxDetail += `  Augmented Profit (for rate banding): GBP ${roundPounds(augmentedProfits).toLocaleString()}\n\n`;
    
    taxDetail += `THRESHOLDS (with associates divisor ${divisor}):\n`;
    taxDetail += `  Annual lower threshold (before day proration): GBP 50,000 / ${divisor} = GBP ${roundPounds(annualSmallThreshold).toLocaleString()}\n`;
    taxDetail += `  Annual upper threshold (before day proration): GBP 250,000 / ${divisor} = GBP ${roundPounds(annualUpperThreshold).toLocaleString()}\n`;
    taxDetail += `  Effective lower threshold for this period: ${pounds(effectiveLowerThreshold)}\n`;
    taxDetail += `  Effective upper threshold for this period: ${pounds(effectiveUpperThreshold)}\n\n`;

    if (fySlices.length === 1) {
      const slice = fySlices[0];
      const smallRate = slice.smallRate || 0.19;
      const mainRate = slice.mainRate || 0.25;
      const reliefFraction = slice.reliefFraction || 0.015;

      if (augmentedProfits <= effectiveLowerThreshold) {
        taxDetail += `Augmented profit ${pounds(augmentedProfits)} <= ${pounds(effectiveLowerThreshold)}\n`;
        taxDetail += `-> Apply SMALL PROFITS RATE (${(smallRate * 100).toFixed(2)}%)\n\n`;
        taxDetail += `CT = ${pounds(taxableTotalProfits)} x ${smallRate.toFixed(2)} = ${pounds(corporationTaxCharge)}`;
      } else if (augmentedProfits >= effectiveUpperThreshold) {
        taxDetail += `Augmented profit ${pounds(augmentedProfits)} >= ${pounds(effectiveUpperThreshold)}\n`;
        taxDetail += `-> Apply MAIN RATE (${(mainRate * 100).toFixed(2)}%)\n\n`;
        taxDetail += `CT = ${pounds(taxableTotalProfits)} x ${mainRate.toFixed(2)} = ${pounds(corporationTaxCharge)}`;
      } else {
        const mainCT = taxableTotalProfits * mainRate;
        const ratio = augmentedProfits > 0 ? (taxableTotalProfits / augmentedProfits) : 0;
        taxDetail += `Augmented profit ${pounds(augmentedProfits)} is BETWEEN effective thresholds\n`;
        taxDetail += `-> Apply MARGINAL RELIEF\n\n`;
        taxDetail += `Step 1: CT at main rate = ${pounds(taxableTotalProfits)} x ${mainRate.toFixed(2)} = ${pounds(mainCT)}\n`;
        taxDetail += `Step 2: Relief ratio = ${pounds(taxableTotalProfits)} / ${pounds(augmentedProfits)} = ${ratio.toFixed(6)}\n`;
        taxDetail += `Step 3: MR = ${reliefFraction.toFixed(3)} x (${pounds(effectiveUpperThreshold)} - ${pounds(augmentedProfits)}) x ${ratio.toFixed(6)}\n`;
        taxDetail += `       = ${pounds(marginalRelief)}\n`;
        taxDetail += `Step 4: Final CT = ${pounds(mainCT)} - ${pounds(marginalRelief)} = ${pounds(corporationTaxCharge)}`;
      }
    } else {
      taxDetail += `Multiple effective tax-regime slices apply.\n`;
      taxDetail += `Final CT and MR are computed slice-by-slice and summed.\n`;
      taxDetail += `See Detailed Calculation for full slice formulas.\n`;
    }
    let verificationDetail = `FULL VERIFIABLE TAX BREAKDOWN\n\n`;
    verificationDetail += `Accounting period: ${userInputs.apStart} to ${userInputs.apEnd} (${apDays} days)\n`;
    verificationDetail += `Associated companies: ${userInputs.assocCompanies} (divisor ${divisor})\n`;
    verificationDetail += `Taxable Total Profits: ${pounds(taxableTotalProfits)}\n`;
    verificationDetail += `Dividend Income used for augmented profit: ${pounds(userInputs.dividendIncome)}\n`;
    verificationDetail += `Augmented Profits: ${pounds(augmentedProfits)}\n\n`;
    verificationDetail += `FORMULA TEMPLATE (SYMBOLIC):\n`;
    verificationDetail += `  Total Income = Turnover + Govt Grants + Asset disposal proceeds + Interest + Rental + Capital gains\n`;
    verificationDetail += `  Profit Before Tax = Total Income - Total Expenses\n`;
    verificationDetail += `  Taxable Trading Profit = trading component after trade AIA and trading loss relief\n`;
    verificationDetail += `  Taxable Total Profits (TTP) = max(0, Taxable Trading Profit + Taxable Non-Trading Income - Property losses used)\n`;
    verificationDetail += `  Taxable Non-Trading Income = Interest + Capital gains + (Rental/Property after rental/property AIA)\n`;
    verificationDetail += `  Augmented Profits = TTP + Dividends\n`;
    verificationDetail += `  For a complete 12-month period:\n`;
    verificationDetail += `    Threshold(slice) = (Annual threshold / (Associated Companies + 1)) x (slice days / period days)\n`;
    verificationDetail += `  For a short period:\n`;
    verificationDetail += `    Threshold(slice) = (Annual threshold x slice days / FY total days) / (Associated Companies + 1)\n`;
    verificationDetail += `    FY total days uses the relevant FY (365 or 366)\n`;
    verificationDetail += `  Effective thresholds = sum of slice thresholds within each effective tax-regime slice\n`;
    verificationDetail += `  If Augmented <= Lower: CT = TTP x 19%\n`;
    verificationDetail += `  If Augmented >= Upper: CT = TTP x 25%\n`;
    verificationDetail += `  If Lower < Augmented < Upper:\n`;
    verificationDetail += `    Main CT = TTP x 25%\n`;
    verificationDetail += `    MR = 0.015 x (Upper - Augmented) x (TTP / Augmented)\n`;
    verificationDetail += `    CT = Main CT - MR\n\n`;
    verificationDetail += `WITH YOUR FIGURES:\n`;
    verificationDetail += `Profit build-up (independently checkable):\n`;
    verificationDetail += `  Accounting income (excludes dividends): ${pounds(totalIncome)}\n`;
    verificationDetail += `    Includes asset disposal proceeds ${pounds(userInputs.disposalGains)} and capital gains ${pounds(userInputs.capitalGains)}\n`;
    if (userInputs.capitalGains) {
      verificationDetail += `    Capital gains source file: ${userInputs.capitalGainsFileName || 'No file selected'}\n`;
    }
    verificationDetail += `  Less accounting expenses: ${pounds(totalExpenses)}\n`;
    verificationDetail += `  Profit before tax: ${pounds(profitBeforeTax)}\n`;
    verificationDetail += `  Add-backs (depreciation + disallowables + adjustments): ${pounds(result.computation.addBacks)}\n`;
    verificationDetail += `  Less capital allowances (AIA used): ${pounds(result.computation.capitalAllowances)}\n`;
    verificationDetail += `  Trading losses available b/f: ${pounds(userInputs.tradingLossBF)}\n`;
    verificationDetail += `  Trading losses requested to use: ${userInputs.tradingLossUseRequested == null ? 'Auto (up to available)' : pounds(userInputs.tradingLossUseRequested)}\n`;
    verificationDetail += `  Less trading losses used: ${pounds(result.computation.tradingLossUsed)}\n`;
    verificationDetail += `  Property losses available b/f: ${pounds(userInputs.propertyLossBF)}\n`;
    verificationDetail += `  Property losses requested to use: ${userInputs.propertyLossUseRequested == null ? 'Auto (up to available)' : pounds(userInputs.propertyLossUseRequested)}\n`;
    verificationDetail += `  Less property losses used: ${pounds(result.property.propertyLossUsed)}\n`;
    verificationDetail += `  Trading losses still available (internal, not CT600) = ${pounds(result.computation.tradingLossAvailable)}\n`;
    verificationDetail += `  Property losses still available (internal, not CT600) = ${pounds(result.property.propertyLossAvailable)}\n`;
    verificationDetail += `  Taxable trading profit: ${pounds(taxableTradingProfit)}\n`;
    verificationDetail += `  Taxable non-trading income (interest + capital gains + rental/property after rental/property AIA): ${pounds(taxableNonTradeIncome)}\n`;
    verificationDetail += `  Taxable Total Profits = max(0, ${pounds(taxableTradingProfit)} + ${pounds(taxableNonTradeIncome)} - ${pounds(result.property.propertyLossUsed)}) = ${pounds(taxableTotalProfits)}\n`;
    verificationDetail += `  Augmented Profits = TTP + dividends = ${pounds(taxableTotalProfits)} + ${pounds(userInputs.dividendIncome)} = ${pounds(augmentedProfits)}\n\n`;

    if (isSplit) {
      verificationDetail += `AP > 12 months split:\n`;
      (result.metadata?.periods || []).forEach((p, i) => {
        verificationDetail += `  Period ${i + 1}: ${p.days} days | Taxable Profit ${pounds(p.taxable_profit)} | CT ${pounds(p.ct_charge)}\n`;
      });
      verificationDetail += `\n`;
    }

    if (hasStraddling) {
      verificationDetail += `Straddling periods (taxed separately by FY slice):\n`;
      fySlices.forEach((slice) => {
        verificationDetail += `  Slice ${slice.idx}: FY${slice.fyYear}, ${slice.days} days\n`;
        verificationDetail += `    Thresholds: lower ${pounds(slice.lower)} | upper ${pounds(slice.upper)}\n`;
        verificationDetail += `    Taxable profit: ${pounds(slice.taxableProfit)}\n`;
        verificationDetail += `    Augmented profit: ${pounds(slice.augmentedProfit)}\n`;
        if (slice.augmentedProfit <= slice.lower) {
          verificationDetail += `    CT = ${pounds(slice.taxableProfit)} x 0.19 = ${pounds(slice.ctCharge)}\n`;
        } else if (slice.augmentedProfit >= slice.upper) {
          verificationDetail += `    CT = ${pounds(slice.taxableProfit)} x 0.25 = ${pounds(slice.ctCharge)}\n`;
        } else {
          const mainCTSlice = slice.taxableProfit * 0.25;
          const ratioSlice = slice.augmentedProfit > 0 ? (slice.taxableProfit / slice.augmentedProfit) : 0;
          verificationDetail += `    Marginal Relief applies\n`;
          verificationDetail += `    Main CT = ${pounds(slice.taxableProfit)} x 0.25 = ${pounds(mainCTSlice)}\n`;
          verificationDetail += `    Ratio = ${pounds(slice.taxableProfit)} / ${pounds(slice.augmentedProfit)} = ${ratioSlice.toFixed(6)}\n`;
          verificationDetail += `    MR = 0.015 x (${pounds(slice.upper)} - ${pounds(slice.augmentedProfit)}) x ${ratioSlice.toFixed(6)} = ${pounds(slice.marginalRelief)}\n`;
          verificationDetail += `    CT = ${pounds(mainCTSlice)} - ${pounds(slice.marginalRelief)} = ${pounds(slice.ctCharge)}\n`;
        }
      });
      verificationDetail += `\n`;
    } else if (hasMarginalRelief && fySlices.length) {
      const mrSlice = fySlices[0];
      const mainCTSlice = mrSlice.taxableProfit * 0.25;
      const ratioSlice = mrSlice.augmentedProfit > 0 ? (mrSlice.taxableProfit / mrSlice.augmentedProfit) : 0;
      verificationDetail += `Marginal Relief details:\n`;
      verificationDetail += `  Thresholds: lower ${pounds(mrSlice.lower)} | upper ${pounds(mrSlice.upper)}\n`;
      verificationDetail += `  Main CT = ${pounds(mrSlice.taxableProfit)} x 0.25 = ${pounds(mainCTSlice)}\n`;
      verificationDetail += `  MR = 0.015 x (${pounds(mrSlice.upper)} - ${pounds(mrSlice.augmentedProfit)}) x ${ratioSlice.toFixed(6)} = ${pounds(mrSlice.marginalRelief)}\n`;
      verificationDetail += `  CT = ${pounds(mainCTSlice)} - ${pounds(mrSlice.marginalRelief)} = ${pounds(mrSlice.ctCharge)}\n\n`;
    }

    verificationDetail += `Final corporation tax payable = ${pounds(corporationTaxCharge)}`;
    
    setOut('taxOnProfit', roundPounds(corporationTaxCharge), 'Corporation Tax (HMRC-compliant with AP split, MR, thresholds)', `${taxDetail}\n\n${verificationDetail}`);
    setRawMeta('taxOnProfit', corporationTaxCharge, Math.round(corporationTaxCharge));

    // Profit for period
    setOut('profitForPeriod', roundPounds(profitForPeriod), 'Profit After Tax', `GBP ${roundPounds(profitBeforeTax).toLocaleString()} - GBP ${roundPounds(corporationTaxCharge).toLocaleString()} = GBP ${roundPounds(profitForPeriod).toLocaleString()}`);
    setRawMeta('profitForPeriod', profitForPeriod, roundPounds(profitForPeriod));

    // Presentation totals for Section 2/3/4 (UI only)
    const periodsMeta = (result.metadata && result.metadata.periods) ? result.metadata.periods : [];
    const nonTradeAIAClaimTotal = periodsMeta.reduce((s, p) => s + Number(p.non_trade_aia_claim || 0), 0);
    const tradingIncomeTotal = userInputs.turnover + userInputs.govtGrants + userInputs.disposalGains;
    const tradingExpenseTotal = totalExpenses;
    const tradingProfits = tradingIncomeTotal - tradingExpenseTotal;
    const tradingProfitsTaxable = taxableTradingProfit;
    const capitalGainsTotal = userInputs.capitalGains;
    const rentalAfterLossBeforeAIA = result.property.propertyProfitAfterLossOffset;
    const rentalPropertyTotal = rentalAfterLossBeforeAIA - nonTradeAIAClaimTotal;
    const nonTradingProfits =
      userInputs.interestIncome +
      capitalGainsTotal +
      rentalPropertyTotal +
      userInputs.dividendIncome;

    setOut(
      'outTradingLossBFAvailable',
      roundPounds(userInputs.tradingLossBF),
      'Trading losses brought forward available at period start',
      `Opening trading losses brought forward = ${pounds(userInputs.tradingLossBF)}\n` +
      `Requested usage this return = ${userInputs.tradingLossUseRequested == null ? 'Auto (up to available)' : pounds(userInputs.tradingLossUseRequested)}\n` +
      `Used this return = ${pounds(result.computation.tradingLossUsed)}\n` +
      `Still available = ${pounds(result.computation.tradingLossAvailable)}\n\n` +
      `You can adjust this amount via slider if you are reconciling prior-year schedules.`
    );
    setRawMeta('outTradingLossBFAvailable', userInputs.tradingLossBF, roundPounds(userInputs.tradingLossBF));
    setOut(
      'outTradingLossAvailableRemaining',
      roundPounds(result.computation.tradingLossAvailable),
      'Trading losses still available after this return (internal display only)',
      `Opening trading losses brought forward = ${pounds(userInputs.tradingLossBF)}\n` +
      `Less trading losses used this return = ${pounds(result.computation.tradingLossUsed)}\n` +
      `Trading losses still available = ${pounds(result.computation.tradingLossAvailable)}\n\n` +
      `This value is for internal display only and is not submitted as a CT600 box.`
    );
    setRawMeta('outTradingLossAvailableRemaining', result.computation.tradingLossAvailable, roundPounds(result.computation.tradingLossAvailable));

    setOut(
      'outPropertyLossBFAvailable',
      roundPounds(userInputs.propertyLossBF),
      'Rental & property losses brought forward available at period start',
      `Opening rental/property losses brought forward = ${pounds(userInputs.propertyLossBF)}\n` +
      `Requested usage this return = ${userInputs.propertyLossUseRequested == null ? 'Auto (up to available)' : pounds(userInputs.propertyLossUseRequested)}\n` +
      `Used this return (claimed against total profits) = ${pounds(result.property.propertyLossUsed)}\n` +
      `Still available = ${pounds(result.property.propertyLossAvailable)}\n\n` +
      `You can adjust this amount via slider if you are reconciling prior-year schedules.`
    );
    setRawMeta('outPropertyLossBFAvailable', userInputs.propertyLossBF, roundPounds(userInputs.propertyLossBF));
    setOut(
      'outPropertyLossAvailableRemaining',
      roundPounds(result.property.propertyLossAvailable),
      'Rental/property losses still available after this return (internal display only)',
      `Opening rental/property losses brought forward = ${pounds(userInputs.propertyLossBF)}\n` +
      `Less rental/property losses used this return (claimed against total profits) = ${pounds(result.property.propertyLossUsed)}\n` +
      `Rental/property losses still available = ${pounds(result.property.propertyLossAvailable)}\n\n` +
      `This value is for internal display only and is not submitted as a CT600 box.`
    );
    setRawMeta('outPropertyLossAvailableRemaining', result.property.propertyLossAvailable, roundPounds(result.property.propertyLossAvailable));

    setOut(
      'outTradingIncomeTotal',
      roundPounds(tradingIncomeTotal),
      'Trading income = Turnover + Government grants & subsidies + Asset disposal proceeds',
      `${pounds(userInputs.turnover)} + ${pounds(userInputs.govtGrants)} + ${pounds(userInputs.disposalGains)} = ${pounds(tradingIncomeTotal)}`
    );
    setRawMeta('outTradingIncomeTotal', tradingIncomeTotal, roundPounds(tradingIncomeTotal));

    setOut(
      'outTradingExpenseTotal',
      roundPounds(tradingExpenseTotal),
      'Trading expenses = Raw materials + Staff cost + Depreciation + Other charges',
      `${pounds(userInputs.costOfSales)} + ${pounds(userInputs.staffCosts)} + ${pounds(userInputs.depreciation)} + ${pounds(userInputs.otherCharges)} = ${pounds(tradingExpenseTotal)}`
    );
    setRawMeta('outTradingExpenseTotal', tradingExpenseTotal, roundPounds(tradingExpenseTotal));

    setOut(
      'outTradingProfits',
      roundPounds(tradingProfits),
      'Trading profits = Trading income - Trading expenses',
      `${pounds(tradingIncomeTotal)} - ${pounds(tradingExpenseTotal)} = ${pounds(tradingProfits)}`
    );
    setRawMeta('outTradingProfits', tradingProfits, roundPounds(tradingProfits));

    setOut(
      'outTradingProfitsTaxable',
      roundPounds(tradingProfitsTaxable),
      'Trading profits subjected to corporation tax = trading component after trade AIA and trading loss usage',
      `Engine taxable trading profit = ${pounds(tradingProfitsTaxable)}`
    );
    setRawMeta('outTradingProfitsTaxable', tradingProfitsTaxable, roundPounds(tradingProfitsTaxable));

    setOut(
      'outChargeableGainsTotal',
      roundPounds(capitalGainsTotal),
      'Capital gains used in computation',
      `Capital gains amount = ${pounds(capitalGainsTotal)}\n` +
      `Attachment: ${userInputs.capitalGainsFileName || 'No file selected'}`
    );
    setRawMeta('outChargeableGainsTotal', capitalGainsTotal, roundPounds(capitalGainsTotal));

    setOut(
      'outRentalPropertyTotal',
      roundPounds(rentalPropertyTotal),
      'Rental & property total = (Rental income after property loss BF) - rental/property AIA used',
      `Rental after property loss BF = ${pounds(rentalAfterLossBeforeAIA)}\n` +
      `Less rental/property AIA used = ${pounds(nonTradeAIAClaimTotal)}\n` +
      `Total = ${pounds(rentalPropertyTotal)}`
    );
    setRawMeta('outRentalPropertyTotal', rentalPropertyTotal, roundPounds(rentalPropertyTotal));

    setOut(
      'outNonTradingProfits',
      roundPounds(nonTradingProfits),
      'Non-trading profits = Interest + Capital gains + Rental/property total + Dividends',
      `${pounds(userInputs.interestIncome)} + ${pounds(capitalGainsTotal)} + ${pounds(rentalPropertyTotal)} + ${pounds(userInputs.dividendIncome)} = ${pounds(nonTradingProfits)}`
    );
    setRawMeta('outNonTradingProfits', nonTradingProfits, roundPounds(nonTradingProfits));

    setOut(
      'outNonTradingProfitsTaxable',
      roundPounds(taxableNonTradeIncome),
      'Non-trading profits subjected to corporation tax = taxable non-trading component from engine',
      `Taxable non-trading component = ${pounds(taxableNonTradeIncome)}\n` +
      `Dividends are excluded from taxable non-trading profits.`
    );
    setRawMeta('outNonTradingProfitsTaxable', taxableNonTradeIncome, roundPounds(taxableNonTradeIncome));

    setOut(
      'outTotalProfitsCTTrade',
      roundPounds(tradingProfitsTaxable),
      'Trade profits subjected to corporation tax',
      `${pounds(tradingProfitsTaxable)}`
    );
    setRawMeta('outTotalProfitsCTTrade', tradingProfitsTaxable, roundPounds(tradingProfitsTaxable));

    setOut(
      'outTotalProfitsCTNonTrade',
      roundPounds(taxableNonTradeIncome),
      'Non-trade profits subjected to corporation tax',
      `${pounds(taxableNonTradeIncome)}`
    );
    setRawMeta('outTotalProfitsCTNonTrade', taxableNonTradeIncome, roundPounds(taxableNonTradeIncome));

    // Section 3 outputs
    setOut('tradingProfitBeforeTax', roundPounds(profitBeforeTax), 'Operating Profit (before tax)', `GBP ${roundPounds(profitBeforeTax).toLocaleString()}`);
    setRawMeta('tradingProfitBeforeTax', profitBeforeTax, roundPounds(profitBeforeTax));

    setOut('addbackDepreciation', roundPounds(userInputs.depreciation), 'Tax add-back (depreciation is not deductible)', `GBP ${roundPounds(userInputs.depreciation).toLocaleString()}`);
    setRawMeta('addbackDepreciation', userInputs.depreciation, roundPounds(userInputs.depreciation));

    setOut('netTradingProfits', roundPounds(taxableTradingProfit), 'Trading profit after adjustments & losses', `GBP ${roundPounds(taxableTradingProfit).toLocaleString()}`);
    setRawMeta('netTradingProfits', taxableTradingProfit, roundPounds(taxableTradingProfit));
    setOut(
      'outTradingLossUsed',
      roundPounds(result.computation.tradingLossUsed),
      'Trading losses used = min(losses available, losses requested, positive trading profit after AIA)',
      `Losses available (BF): ${pounds(userInputs.tradingLossBF)}\n` +
      `Losses requested to use: ${userInputs.tradingLossUseRequested == null ? 'Auto (up to available)' : pounds(userInputs.tradingLossUseRequested)}\n` +
      `Losses used this return: ${pounds(result.computation.tradingLossUsed)}\n` +
      `Losses still available: ${pounds(result.computation.tradingLossAvailable)}`
    );
    setRawMeta('outTradingLossUsed', result.computation.tradingLossUsed, roundPounds(result.computation.tradingLossUsed));

    // Section 4 outputs
    setOut('outInterestIncome', roundPounds(userInputs.interestIncome), 'Interest earned', `GBP ${roundPounds(userInputs.interestIncome).toLocaleString()}`);
    setRawMeta('outInterestIncome', userInputs.interestIncome, roundPounds(userInputs.interestIncome));

    setOut('outGovtGrants', roundPounds(userInputs.govtGrants), 'Government grants', `GBP ${roundPounds(userInputs.govtGrants).toLocaleString()}`);
    setRawMeta('outGovtGrants', userInputs.govtGrants, roundPounds(userInputs.govtGrants));

    setOut('outDividendIncome', roundPounds(userInputs.dividendIncome), 'Dividend income (affects rate, not taxable)', `GBP ${roundPounds(userInputs.dividendIncome).toLocaleString()}`);
    setRawMeta('outDividendIncome', userInputs.dividendIncome, roundPounds(userInputs.dividendIncome));
    setOut(
      'outDisposalGains',
      roundPounds(userInputs.disposalGains),
      'Asset disposal proceeds (AIA disposal context) are treated as taxable trading income',
      `${pounds(userInputs.disposalGains)}\n` +
      `These feed taxable trading profits (not taxable non-trading profits).`
    );
    setRawMeta('outDisposalGains', userInputs.disposalGains, roundPounds(userInputs.disposalGains));
    setOut(
      'outCapitalGains',
      roundPounds(userInputs.capitalGains),
      'Capital gains are taxable and passed through from user-uploaded schedule',
      `Capital gains used in computation: ${pounds(userInputs.capitalGains)}\n` +
      `Source file: ${userInputs.capitalGainsFileName || 'No file selected'}\n` +
      `This tool does not parse the file; it uses the entered figure directly.`
    );
    setRawMeta('outCapitalGains', userInputs.capitalGains, roundPounds(userInputs.capitalGains));

    setOut('outRentalIncome', roundPounds(result.property.rentalIncome), 'Rental income', `GBP ${roundPounds(result.property.rentalIncome).toLocaleString()}`);
    setRawMeta('outRentalIncome', result.property.rentalIncome, roundPounds(result.property.rentalIncome));

    setOut(
      'netRentalIncome',
      roundPounds(result.property.propertyProfitAfterLossOffset),
      'Rental/property income after property losses brought forward (before rental/property AIA)',
      `Gross rental/property income ${pounds(result.property.rentalIncome)} - property losses b/f used = ${pounds(result.property.propertyProfitAfterLossOffset)}`
    );
    setRawMeta('netRentalIncome', result.property.propertyProfitAfterLossOffset, roundPounds(result.property.propertyProfitAfterLossOffset));

    // Section 5 outputs
    setOut(
      'ttProfitsChargeable',
      roundPounds(taxableTotalProfits),
      'Total taxable income = max(0, taxable trade income + taxable non-trade income - property losses used)',
      `Taxable trade income = ${pounds(taxableTradingProfit)}\n` +
      `Taxable non-trade income = ${pounds(taxableNonTradeIncome)}\n` +
      `Property losses used = ${pounds(result.property.propertyLossUsed)}\n` +
      `Total taxable income = max(0, ${pounds(taxableTradingProfit)} + ${pounds(taxableNonTradeIncome)} - ${pounds(result.property.propertyLossUsed)}) = ${pounds(taxableTotalProfits)}`
    );
    setRawMeta('ttProfitsChargeable', taxableTotalProfits, roundPounds(taxableTotalProfits));

    setOut('corpTaxPayable', roundPounds(corporationTaxCharge), 'Final Corporation Tax Payable', `${taxDetail}\n\n${verificationDetail}`);
    setRawMeta('corpTaxPayable', corporationTaxCharge, Math.round(corporationTaxCharge));

    // Section 6 outputs (tax variables and period-level breakdown)
    const periods = (Array.isArray(result.periods) && result.periods.length)
      ? result.periods
      : ((result.metadata && result.metadata.periods) ? result.metadata.periods : []);
    const slicesList = (Array.isArray(result.slices) && result.slices.length)
      ? result.slices
      : (Array.isArray(result.byFY) ? result.byFY : []);
    const formatFYLabel = (slice) => {
      const years = Array.isArray(slice?.fy_years) && slice.fy_years.length ? slice.fy_years : [slice?.fy_year];
      if (!years.length) return 'FY?';
      return years.length > 1 ? `FY${years[0]}-FY${years[years.length - 1]}` : `FY${years[0]}`;
    };
    const p1 = periods[0] || {
      days: apDays,
      profit_before_tax: profitBeforeTax,
      taxable_profit: taxableTotalProfits,
      augmented_profit: augmentedProfits,
      aia_claim: result.computation.capitalAllowances,
      marginal_relief: marginalRelief
    };
    const p2 = periods[1] || {
      days: 0,
      profit_before_tax: 0,
      taxable_profit: 0,
      augmented_profit: 0,
      aia_claim: 0,
      marginal_relief: 0
    };
    const totalAiaCapFromSlices = slicesList.reduce((s, x) => s + (x.aia_cap_for_fy || 0), 0);
    if (typeof p1.aia_cap_total !== 'number') p1.aia_cap_total = totalAiaCapFromSlices;
    if (typeof p2.aia_cap_total !== 'number') p2.aia_cap_total = 0;
    if (typeof p1.aia_additions_share !== 'number') p1.aia_additions_share = userInputs.aiaAdditions || 0;
    if (typeof p2.aia_additions_share !== 'number') p2.aia_additions_share = 0;
    if (typeof p1.trade_aia_cap_total !== 'number') p1.trade_aia_cap_total = (p1.aia_cap_total || 0);
    if (typeof p1.non_trade_aia_cap_total !== 'number') p1.non_trade_aia_cap_total = (p1.aia_cap_total || 0);
    if (typeof p2.trade_aia_cap_total !== 'number') p2.trade_aia_cap_total = (p2.aia_cap_total || 0);
    if (typeof p2.non_trade_aia_cap_total !== 'number') p2.non_trade_aia_cap_total = (p2.aia_cap_total || 0);
    if (typeof p1.trade_aia_additions_share !== 'number') p1.trade_aia_additions_share = userInputs.aiaTradeAdditions || 0;
    if (typeof p1.non_trade_aia_additions_share !== 'number') p1.non_trade_aia_additions_share = userInputs.aiaNonTradeAdditions || 0;
    if (typeof p2.trade_aia_additions_share !== 'number') p2.trade_aia_additions_share = 0;
    if (typeof p2.non_trade_aia_additions_share !== 'number') p2.non_trade_aia_additions_share = 0;
    if (typeof p1.trade_aia_claim !== 'number') p1.trade_aia_claim = (p1.aia_claim || 0) / 2;
    if (typeof p1.non_trade_aia_claim !== 'number') p1.non_trade_aia_claim = (p1.aia_claim || 0) / 2;
    if (typeof p2.trade_aia_claim !== 'number') p2.trade_aia_claim = (p2.aia_claim || 0) / 2;
    if (typeof p2.non_trade_aia_claim !== 'number') p2.non_trade_aia_claim = (p2.aia_claim || 0) / 2;

    const p1Revenue = totalIncome * ((p1.days || 0) / (apDays || 1));
    const p2Revenue = totalIncome * ((p2.days || 0) / (apDays || 1));

    const fyYear = slicesList.length ? slicesList[0].fy_year : null;
    const fyConfig = (corpTaxYears || []).find((fy) => fy.fy_year === fyYear);
    const lowerRate = fyConfig ? ((fyConfig.tiers.find((t) => t.index === 1) || {}).rate || 0.19) : 0.19;
    const upperRate = fyConfig ? ((fyConfig.tiers.find((t) => t.index === 3) || {}).rate || 0.25) : 0.25;
    const lowerSliceBreak = slicesList.map((x) => `${formatFYLabel(x)}: ${pounds(x.thresholds?.small_threshold_for_AP_in_this_FY || 0)}`).join(' + ');
    const upperSliceBreak = slicesList.map((x) => `${formatFYLabel(x)}: ${pounds(x.thresholds?.upper_threshold_for_AP_in_this_FY || 0)}`).join(' + ');

    setOutNumeric('outApDays', apDays, 'AP days = (End date - Start date) + 1', `${userInputs.apStart} to ${userInputs.apEnd} = ${apDays} days`);
    setOutNumeric('outAssocDivisor', divisor, 'Associates divisor = associated companies + 1', `${userInputs.assocCompanies} + 1 = ${divisor}`);
    setOutNumeric(
      'outLowerBracket',
      effectiveLowerThreshold,
      'Effective lower threshold = sum of time-apportioned slice lower thresholds',
      `[HMRC tag] tax_calculation_table.computation_by_fy[].thresholds.small_threshold_for_AP_in_this_FY\n` +
      `${lowerSliceBreak || 'No slices'} = ${pounds(effectiveLowerThreshold)}`
    );
    setOut('outLowerRate', `${pct(lowerRate)}%`, 'Lower rate from FY tier 1', `FY ${fyYear || 'n/a'} lower rate = ${pct(lowerRate)}%`);
    document.getElementById('outLowerRate').dataset.raw = String(lowerRate * 100);
    document.getElementById('outLowerRate').dataset.orig = String(roundPounds(lowerRate * 100));
    setOutNumeric(
      'outUpperBracket',
      effectiveUpperThreshold,
      'Effective upper threshold = sum of time-apportioned slice upper thresholds',
      `[HMRC tag] tax_calculation_table.computation_by_fy[].thresholds.upper_threshold_for_AP_in_this_FY\n` +
      `${upperSliceBreak || 'No slices'} = ${pounds(effectiveUpperThreshold)}`
    );
    setOut('outUpperRate', `${pct(upperRate)}%`, 'Upper rate from FY tier 3', `FY ${fyYear || 'n/a'} upper rate = ${pct(upperRate)}%`);
    document.getElementById('outUpperRate').dataset.raw = String(upperRate * 100);
    document.getElementById('outUpperRate').dataset.orig = String(roundPounds(upperRate * 100));
    const p1ByFY = (p1.slices || p1.by_fy || slicesList.filter((x) => (x.period_index || 1) === 1));
    const p2ByFY = (p2.slices || p2.by_fy || slicesList.filter((x) => (x.period_index || 0) === 2));
    const sumPeriodThreshold = (slices, key) => (slices || []).reduce((sum, slice) => {
      return sum + Number(slice && slice.thresholds ? (slice.thresholds[key] || 0) : 0);
    }, 0);
    const parseISODateUTC = (iso) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
      if (!m) return null;
      return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    };
    const daysInclusiveUTC = (startUTC, endUTC) => {
      if (!startUTC || !endUTC) return 0;
      const msPerDay = 24 * 60 * 60 * 1000;
      if (endUTC < startUTC) return 0;
      return Math.round((endUTC - startUTC) / msPerDay) + 1;
    };
    const overlapDaysUTC = (startA, endA, startB, endB) => {
      if (!startA || !endA || !startB || !endB) return 0;
      const start = startA > startB ? startA : startB;
      const end = endA < endB ? endA : endB;
      return daysInclusiveUTC(start, end);
    };
    const getFYConfig = (fyYear) => (corpTaxYears || []).find((fy) => Number(fy.fy_year) === Number(fyYear)) || null;
    const buildPeriodThresholdBreakdown = (slices, key, label, periodIndex) => {
      if (!slices || !slices.length) {
        return `No Period ${periodIndex} slices. ${label} = ${pounds(0)}`;
      }
      const period = periodIndex === 1 ? p1 : p2;
      const periodDays = Number(period?.days || 0);
      const isShortPeriod = !!(period?.is_short_period || /short period/i.test(String(period?.period_name || period?.name || '')));
      const thresholdTierIndex = key === 'small_threshold_for_AP_in_this_FY' ? 2 : 3;
      const lines = [];
      lines.push(`[HMRC tags] Time-apportioned threshold by slice; used in CT calculation table`);
      slices.forEach((slice, idx) => {
        const fyYears = Array.isArray(slice.fy_years) && slice.fy_years.length ? slice.fy_years : [slice.fy_year];
        const sliceLabel = `Slice ${Number(slice.slice_index || idx + 1)} (${slice.slice_start || '?'} to ${slice.slice_end || '?'})`;
        const engineValue = Number(slice.thresholds ? (slice.thresholds[key] || 0) : 0);
        lines.push('');
        lines.push(sliceLabel);
        if (fyYears.length === 1) {
          const fyYear = Number(fyYears[0] || 0);
          const fyCfg = getFYConfig(fyYear);
          const baseThreshold = Number(fyCfg?.tiers?.find((t) => t.index === thresholdTierIndex)?.threshold || 0);
          const sliceDays = Number(slice.ap_days_in_fy || 0);
          if (isShortPeriod) {
            const fyStart = parseISODateUTC(fyCfg?.start_date);
            const fyEnd = parseISODateUTC(fyCfg?.end_date);
            const fyTotalDays = daysInclusiveUTC(fyStart, fyEnd) || 365;
            const calc = (baseThreshold * (sliceDays / fyTotalDays)) / divisor;
            lines.push(`  Formula (short period): (${pounds(baseThreshold)} x (${sliceDays}/${fyTotalDays})) / ${divisor} = ${pounds(calc)}`);
          } else {
            const calc = (baseThreshold / divisor) * (sliceDays / Math.max(1, periodDays));
            lines.push(`  Formula (12m/full period): (${pounds(baseThreshold)} / ${divisor}) x (${sliceDays}/${Math.max(1, periodDays)}) = ${pounds(calc)}`);
          }
        } else {
          lines.push(`  Grouped slice across FY years (${fyYears.join(', ')}) -> threshold is the sum of FY components.`);
          fyYears.forEach((fyYearRaw) => {
            const fyYear = Number(fyYearRaw || 0);
            const fyCfg = getFYConfig(fyYear);
            if (!fyCfg) return;
            const baseThreshold = Number(fyCfg?.tiers?.find((t) => t.index === thresholdTierIndex)?.threshold || 0);
            const sliceStart = parseISODateUTC(slice.slice_start);
            const sliceEnd = parseISODateUTC(slice.slice_end);
            const fyStart = parseISODateUTC(fyCfg.start_date);
            const fyEnd = parseISODateUTC(fyCfg.end_date);
            const sliceDaysInFY = overlapDaysUTC(sliceStart, sliceEnd, fyStart, fyEnd);
            if (!sliceDaysInFY) return;
            if (isShortPeriod) {
              const fyTotalDays = daysInclusiveUTC(fyStart, fyEnd) || 365;
              const calc = (baseThreshold * (sliceDaysInFY / fyTotalDays)) / divisor;
              lines.push(`    FY${fyYear}: (${pounds(baseThreshold)} x (${sliceDaysInFY}/${fyTotalDays})) / ${divisor} = ${pounds(calc)}`);
            } else {
              const calc = (baseThreshold / divisor) * (sliceDaysInFY / Math.max(1, periodDays));
              lines.push(`    FY${fyYear}: (${pounds(baseThreshold)} / ${divisor}) x (${sliceDaysInFY}/${Math.max(1, periodDays)}) = ${pounds(calc)}`);
            }
          });
        }
        lines.push(`  Engine ${label.toLowerCase()} = ${pounds(engineValue)}`);
      });
      const total = sumPeriodThreshold(slices, key);
      return `Period ${periodIndex} ${label} = sum of effective-slice ${label.toLowerCase()} values\n` +
        `${lines.join('\n')}\n` +
        `= ${pounds(total)}`;
    };
    const p1LowerBracket = sumPeriodThreshold(p1ByFY, 'small_threshold_for_AP_in_this_FY');
    const p1UpperBracket = sumPeriodThreshold(p1ByFY, 'upper_threshold_for_AP_in_this_FY');
    const p2LowerBracket = sumPeriodThreshold(p2ByFY, 'small_threshold_for_AP_in_this_FY');
    const p2UpperBracket = sumPeriodThreshold(p2ByFY, 'upper_threshold_for_AP_in_this_FY');
    const buildPeriodSliceBreakdown = (period, periodIndex, slices) => {
      if (!slices || !slices.length) {
        return `Slice breakdown (Period ${periodIndex})\nNo slices found.`;
      }
      const periodDays = Number(period.days || 0);
      const periodTaxable = Number(period.taxable_profit || 0);
      const periodAugmented = Number(period.augmented_profit || 0);
      const lines = [];
      lines.push(`Slice breakdown inside Period ${periodIndex} (${period.start_date || period.period_start || '?'} to ${period.end_date || period.period_end || '?'})`);
      lines.push(`[HMRC tags] taxable profits -> box_315_taxable_profit | augmented profits -> summary.augmented_profits`);
      slices.forEach((slice, idx) => {
        const sliceDays = Number(slice.ap_days_in_fy || 0);
        const ratio = periodDays > 0 ? (sliceDays / periodDays) : 0;
        const fyLabel = formatFYLabel(slice);
        const sliceNumber = Number(slice.slice_index || idx + 1);
        lines.push('');
        lines.push(`Slice ${sliceNumber} (${slice.slice_start || '?'} to ${slice.slice_end || '?'}) | ${fyLabel}`);
        lines.push(`  Days ratio = ${sliceDays}/${Math.max(1, periodDays)} = ${ratio.toFixed(6)}`);
        lines.push(`  Taxable profits formula: ${pounds(periodTaxable)} x (${sliceDays}/${Math.max(1, periodDays)}) = ${pounds(periodTaxable * ratio)} (engine ${pounds(slice.taxableProfit || 0)})`);
        lines.push(`  Augmented profits formula: ${pounds(periodAugmented)} x (${sliceDays}/${Math.max(1, periodDays)}) = ${pounds(periodAugmented * ratio)} (engine ${pounds(slice.augmentedProfit || 0)})`);
        lines.push(`  Lower threshold (time-apportioned) = ${pounds(slice.thresholds?.small_threshold_for_AP_in_this_FY || 0)}`);
        lines.push(`  Upper threshold (time-apportioned) = ${pounds(slice.thresholds?.upper_threshold_for_AP_in_this_FY || 0)}`);
        lines.push(`  CT charge = ${pounds(slice.ctCharge || 0)} | MR = ${pounds(slice.marginalRelief || 0)}`);
      });
      return lines.join('\n');
    };

    function buildPeriodTaxableDetail(period, periodIndex) {
      const days = Number(period.days || 0);
      if (!days) {
        return {
          formula: `Period ${periodIndex} taxable profits = max(0, taxable before losses - trading loss used - property loss used)`,
          details: `No Period ${periodIndex} exists for this accounting period.`
        };
      }
      const ratio = apDays ? (days / apDays) : 0;
      const pbtShare = Number(period.profit_before_tax ?? (profitBeforeTax * ratio));
      const addBackShare = Number(period.add_backs ?? ((userInputs.depreciation + userInputs.disallowableExpenses + userInputs.otherAdjustments) * ratio));
      const periodRentalGross = Number(period.rental_income_gross ?? (userInputs.rentalIncome * ratio));
      const periodPropertyLossPool = Number(period.property_loss_pool ?? 0);
      const periodPropertyLossUsedAgainstProperty = Number(
        period.property_loss_used_against_property_stream ?? Math.min(Math.max(0, periodPropertyLossPool), Math.max(0, periodRentalGross))
      );
      const periodPropertyProfitAfterLoss = Number(period.property_profit_after_loss ?? Math.max(0, periodRentalGross - periodPropertyLossUsedAgainstProperty));
      const propertyAdjustment = Number(period.property_adjustment ?? (periodPropertyProfitAfterLoss - periodRentalGross));
      const aiaClaim = Number(period.aia_claim || 0);
      const taxableBeforeLoss = Number(period.taxable_before_loss ?? (pbtShare + addBackShare - aiaClaim));
      const lossUsed = Number(period.loss_used || 0);
      const taxableAfterTradingLoss = Number(taxableBeforeLoss - lossUsed);
      const periodPropertyLossUsed = Number(
        period.property_loss_used ?? Math.min(Math.max(0, periodPropertyLossPool), Math.max(0, taxableAfterTradingLoss))
      );
      const periodPropertyLossCF = Number(period.property_loss_cf ?? Math.max(0, periodPropertyLossPool - periodPropertyLossUsed));
      const taxableProfitPeriod = Number(period.taxable_profit || 0);
      const slices = periodIndex === 1 ? p1ByFY : p2ByFY;
      const sliceDetail = buildPeriodSliceBreakdown(period, periodIndex, slices);

      return {
        formula: `Period ${periodIndex} taxable profits = max(0, taxable before losses - trading loss used - property loss used)\n` +
          `taxable before losses = PBT share + add-backs share - AIA claim`,
        details:
          `[HMRC tag] box_315_taxable_profit\n\n` +
          `STEP 1: PBT share\n` +
          `  ${pounds(profitBeforeTax)} x (${days}/${apDays}) = ${pounds(pbtShare)}\n\n` +
          `STEP 2: Add-backs share\n` +
          `  (Depreciation + Disallowables + Other adjustments) x (${days}/${apDays})\n` +
          `  = (${pounds(userInputs.depreciation)} + ${pounds(userInputs.disallowableExpenses)} + ${pounds(userInputs.otherAdjustments)}) x (${days}/${apDays}) = ${pounds(addBackShare)}\n\n` +
          `STEP 3: Property stream disclosure for period ${periodIndex}\n` +
          `  Gross rental income (period) = ${pounds(periodRentalGross)}\n` +
          `  Property loss pool opening = ${pounds(periodPropertyLossPool)}\n` +
          `  Property loss used against property stream = ${pounds(periodPropertyLossUsedAgainstProperty)}\n` +
          `  Property loss requested remaining before this period = ${pounds(Number(period.property_loss_use_requested_remaining || 0) + periodPropertyLossUsed)}\n` +
          `  Property loss used for total-profits claim = ${pounds(periodPropertyLossUsed)}\n` +
          `  Property loss requested remaining after this period = ${pounds(period.property_loss_use_requested_remaining || 0)}\n` +
          `  Property loss c/f = ${pounds(periodPropertyLossCF)}\n` +
          `  Net property profit after loss = ${pounds(periodPropertyProfitAfterLoss)}\n` +
          `  Property adjustment = ${pounds(periodPropertyProfitAfterLoss)} - ${pounds(periodRentalGross)} = ${pounds(propertyAdjustment)}\n\n` +
          `STEP 4: Taxable before losses\n` +
          `  ${pounds(pbtShare)} + ${pounds(addBackShare)} - ${pounds(aiaClaim)} = ${pounds(taxableBeforeLoss)}\n\n` +
          `STEP 5: Trading loss used in period ${periodIndex}\n` +
          `  ${pounds(lossUsed)}\n\n` +
          `STEP 6: Property loss used in period ${periodIndex} (claimed against total profits)\n` +
          `  min(${pounds(periodPropertyLossPool)}, requested remaining, positive taxable after trading loss) = ${pounds(periodPropertyLossUsed)}\n\n` +
          `STEP 7: Period ${periodIndex} taxable profit\n` +
          `  max(0, ${pounds(taxableBeforeLoss)} - ${pounds(lossUsed)} - ${pounds(periodPropertyLossUsed)}) = ${pounds(taxableProfitPeriod)}\n\n` +
          sliceDetail
      };
    }

    function buildPeriodMRDetail(period, periodIndex, slices) {
      const periodMR = Number(period.marginal_relief || 0);
      if (!period.days) {
        return {
          formula: `Period ${periodIndex} MR = sum of slice-level MR values`,
          details: `No Period ${periodIndex} exists for this accounting period.`
        };
      }
      if (!slices.length) {
        return {
          formula: `Period ${periodIndex} MR = sum of slice-level MR values`,
          details: `No slices found inside Period ${periodIndex}.`
        };
      }

      const sliceDetail = buildPeriodSliceBreakdown(period, periodIndex, slices);
      let detail = `[HMRC tag] box_435_marginal_relief\n`;
      detail += `Period ${periodIndex} marginal relief = sum(MR per slice)\n\n`;
      slices.forEach((slice, idx) => {
        const lower = Number(slice.thresholds?.small_threshold_for_AP_in_this_FY || 0);
        const upper = Number(slice.thresholds?.upper_threshold_for_AP_in_this_FY || 0);
        const tp = Number(slice.taxableProfit || 0);
        const ap = Number(slice.augmentedProfit || 0);
        const fyCfgSlice = (corpTaxYears || []).find((fy) => fy.fy_year === slice.fy_year);
        const mainRateSlice = Number(slice.main_rate ?? (fyCfgSlice ? ((fyCfgSlice.tiers.find((t) => t.index === 3) || {}).rate || 0.25) : 0.25));
        const reliefFractionSlice = Number(slice.relief_fraction ?? (fyCfgSlice ? ((fyCfgSlice.tiers.find((t) => t.index === 2) || {}).relief_fraction || 0.015) : 0.015));
        const ratio = ap > 0 ? (tp / ap) : 0;
        const mrCalc = (ap > lower && ap < upper) ? (reliefFractionSlice * (upper - ap) * ratio) : 0;
        const fyLabel = formatFYLabel(slice);

        detail += `${fyLabel} slice ${Number(slice.slice_index || idx + 1)} (${slice.ap_days_in_fy || 0} days)\n`;
        if (slice.regime_grouped) {
          detail += `  Regime unchanged across FY boundary -> calculated as one whole slice\n`;
        }
        detail += `  Taxable profit = ${pounds(tp)}\n`;
        detail += `  Augmented profit = ${pounds(ap)}\n`;
        detail += `  Thresholds: lower ${pounds(lower)}, upper ${pounds(upper)}\n`;
        if (ap <= lower) {
          detail += `  Augmented <= lower: MR = ${pounds(0)}\n\n`;
        } else if (ap >= upper) {
          detail += `  Augmented >= upper: MR = ${pounds(0)}\n\n`;
        } else {
          detail += `  Main CT = ${pounds(tp)} x ${mainRateSlice.toFixed(2)} = ${pounds(tp * mainRateSlice)}\n`;
          detail += `  Ratio = ${pounds(tp)} / ${pounds(ap)} = ${ratio.toFixed(6)}\n`;
          detail += `  MR = ${reliefFractionSlice.toFixed(3)} x (${pounds(upper)} - ${pounds(ap)}) x ${ratio.toFixed(6)}\n`;
          detail += `     = ${pounds(mrCalc)} (engine: ${pounds(slice.marginalRelief || 0)})\n\n`;
        }
      });
      detail += `Period ${periodIndex} MR total = ${pounds(periodMR)}\n\n`;
      detail += sliceDetail;

      return {
        formula: `For each effective tax-regime slice in Period ${periodIndex}:\n` +
          `if augmented <= lower OR augmented >= upper: MR = 0\n` +
          `else MR = relief_fraction x (upper - augmented) x (taxable / augmented)\n` +
          `Period ${periodIndex} MR = sum(all effective-slice MR)`,
        details: detail
      };
    }

    setOutNumeric(
      'outTTPVar',
      taxableTotalProfits,
      'Profits chargeable to corporation tax (TTP) = max(0, taxable trading + taxable non-trading - property losses used)',
      `[HMRC tag] box_315_taxable_profit\n` +
      `Taxable trading = ${pounds(result.computation.taxableTradingProfit)}\n` +
      `Taxable non-trading (interest + capital gains + rental/property after rental/property AIA) = ${pounds(taxableNonTradeIncome)}\n` +
      `Property losses used = ${pounds(result.property.propertyLossUsed)}\n` +
      `TTP = max(0, ${pounds(result.computation.taxableTradingProfit)} + ${pounds(taxableNonTradeIncome)} - ${pounds(result.property.propertyLossUsed)}) = ${pounds(taxableTotalProfits)}`
    );

    setOutNumeric(
      'outAugmentedProfitsVar',
      augmentedProfits,
      'Augmented profits = Taxable Total Profits + dividends',
      `[HMRC tag] summary.augmented_profits\n` +
      `STEP 1: Taxable trading profit = ${pounds(result.computation.taxableTradingProfit)}\n` +
      `STEP 2: Taxable non-trading income (interest + capital gains + rental/property after rental/property AIA) = ${pounds(taxableNonTradeIncome)}\n` +
      `STEP 3: Taxable Total Profits = max(0, ${pounds(result.computation.taxableTradingProfit)} + ${pounds(taxableNonTradeIncome)} - ${pounds(result.property.propertyLossUsed)}) = ${pounds(taxableTotalProfits)}\n` +
      `STEP 4: Augmented profits = ${pounds(taxableTotalProfits)} + ${pounds(userInputs.dividendIncome)} = ${pounds(augmentedProfits)}\n\n` +
      `Slice-level augmented profits are shown inside Period 1/2 details.`
    );

    const totalMRDetails = [
      `[HMRC tag] box_435_marginal_relief`,
      `Total MR = MR Period 1 + MR Period 2`,
      `${pounds(p1.marginal_relief || 0)} + ${pounds(p2.marginal_relief || 0)} = ${pounds(marginalRelief)}`,
      '',
      'By slices:',
      ...(slicesList.map((x) => `  Period ${x.period_index || 1}, Slice ${x.slice_index || 1}, ${formatFYLabel(x)}: MR ${pounds(x.marginalRelief || 0)}`))
    ].join('\n');
    setOutNumeric('outTotalMarginalReliefVar', marginalRelief, 'Total MR = sum of MR across all FY slices and AP periods', totalMRDetails);
    const p1AiaCap = Number(p1.aia_cap_total || 0);
    const p2AiaCap = Number(p2.aia_cap_total || 0);
    const p1TradeAiaAdditionsShare = Number(p1.trade_aia_additions_share || 0);
    const p1NonTradeAiaAdditionsShare = Number(p1.non_trade_aia_additions_share || 0);
    const p2TradeAiaAdditionsShare = Number(p2.trade_aia_additions_share || 0);
    const p2NonTradeAiaAdditionsShare = Number(p2.non_trade_aia_additions_share || 0);
    const p1TradeAiaClaim = Number(p1.trade_aia_claim || 0);
    const p1NonTradeAiaClaim = Number(p1.non_trade_aia_claim || 0);
    const p2TradeAiaClaim = Number(p2.trade_aia_claim || 0);
    const p2NonTradeAiaClaim = Number(p2.non_trade_aia_claim || 0);
    const totalAiaCap = p1AiaCap + p2AiaCap;
    setOutNumeric(
      'outTotalAIAClaimedVar',
      result.computation.capitalAllowances,
      'Total AIA claimed = sum of period AIA claims',
      `AIA MASTER cap formula per slice:\n` +
      `  Complete 12-month period: (annual AIA limit / (associated companies + 1)) x (slice days / period days)\n` +
      `  Short period: (annual AIA limit x slice days / FY total days) / (associated companies + 1)\n` +
      `  FY total days uses the relevant FY (365 or 366)\n` +
      `Associated companies divisor = ${divisor}\n` +
      `Period 1 master cap: ${pounds(p1AiaCap)}\n` +
      `Period 1 trade additions ${pounds(p1TradeAiaAdditionsShare)} | non-trade additions ${pounds(p1NonTradeAiaAdditionsShare)}\n` +
      `Period 1 trade requested ${pounds(p1.trade_aia_potential_claim || 0)} | rental/property requested ${pounds(p1.non_trade_aia_potential_claim || 0)}\n` +
      `Period 1 allocated trade claim ${pounds(p1TradeAiaClaim)} | non-trade claim ${pounds(p1NonTradeAiaClaim)} | total claim ${pounds(p1.aia_claim || 0)}\n` +
      `Period 2 master cap: ${pounds(p2AiaCap)}\n` +
      `Period 2 trade additions ${pounds(p2TradeAiaAdditionsShare)} | non-trade additions ${pounds(p2NonTradeAiaAdditionsShare)}\n` +
      `Period 2 trade requested ${pounds(p2.trade_aia_potential_claim || 0)} | rental/property requested ${pounds(p2.non_trade_aia_potential_claim || 0)}\n` +
      `Period 2 allocated trade claim ${pounds(p2TradeAiaClaim)} | non-trade claim ${pounds(p2NonTradeAiaClaim)} | total claim ${pounds(p2.aia_claim || 0)}\n` +
      `Note: non-trade AIA claim offsets rental & property stream (not interest income).\n` +
      `Total cap across periods: ${pounds(totalAiaCap)}\n` +
      `Total claim: ${pounds(p1.aia_claim || 0)} + ${pounds(p2.aia_claim || 0)} = ${pounds(result.computation.capitalAllowances)}`
    );

    setOutNumeric(
      'outP1RevenueShare',
      p1Revenue,
      'Period 1 revenue share = total accounting income x (P1 days / AP days)',
      `${pounds(totalIncome)} x (${p1.days || 0}/${apDays}) = ${pounds(p1Revenue)}\n\n` +
      buildPeriodSliceBreakdown(p1, 1, p1ByFY)
    );
    setOutNumeric(
      'outP1ProfitBeforeTax',
      p1.profit_before_tax || 0,
      'Period 1 PBT = AP PBT apportioned to period 1',
      `${pounds(profitBeforeTax)} x (${p1.days || 0}/${apDays}) ~= ${pounds(p1.profit_before_tax || 0)}\n\n` +
      buildPeriodSliceBreakdown(p1, 1, p1ByFY)
    );
    setOutNumeric(
      'outP1LowerBracket',
      p1LowerBracket,
      'Period 1 lower bracket limit = sum of effective tax-slice lower thresholds in Period 1',
      buildPeriodThresholdBreakdown(p1ByFY, 'small_threshold_for_AP_in_this_FY', 'Lower bracket limit', 1)
    );
    setOutNumeric(
      'outP1UpperBracket',
      p1UpperBracket,
      'Period 1 upper bracket limit = sum of effective tax-slice upper thresholds in Period 1',
      buildPeriodThresholdBreakdown(p1ByFY, 'upper_threshold_for_AP_in_this_FY', 'Upper bracket limit', 1)
    );
    const p1TaxableDetail = buildPeriodTaxableDetail(p1, 1);
    setOutNumeric('outP1TaxableProfit', p1.taxable_profit || 0, p1TaxableDetail.formula, p1TaxableDetail.details);
    setOutNumeric(
      'outP1AIAClaimed',
      p1.aia_claim || 0,
      'Period 1 AIA: shared master cap allocated across trade and non-trade claims',
      `Master cap (P1) = ${pounds(p1AiaCap)}\n` +
      `Trade requested claim (P1) = qualifying trade additions share = ${pounds(p1.trade_aia_potential_claim || 0)}\n` +
      `Rental/property requested claim (P1) = qualifying rental/property AIA additions share = ${pounds(p1.non_trade_aia_potential_claim || 0)}\n` +
      `Note: AIA claim is not capped by current profit and can create/increase a loss.\n` +
      `Note: rental/property AIA offsets rental & property stream only (not interest income).\n` +
      `Allocated from shared cap -> trade claim ${pounds(p1TradeAiaClaim)} | non-trade claim ${pounds(p1NonTradeAiaClaim)}\n` +
      `Total AIA claim (P1) = ${pounds(p1TradeAiaClaim)} + ${pounds(p1NonTradeAiaClaim)} = ${pounds(p1.aia_claim || 0)}`
    );
    const p1MrDetail = buildPeriodMRDetail(p1, 1, p1ByFY);
    setOutNumeric('outP1MarginalRelief', p1.marginal_relief || 0, p1MrDetail.formula, p1MrDetail.details);

    setOutNumeric(
      'outP2RevenueShare',
      p2Revenue,
      'Period 2 revenue share = total accounting income x (P2 days / AP days)',
      `${pounds(totalIncome)} x (${p2.days || 0}/${apDays}) = ${pounds(p2Revenue)}\n\n` +
      buildPeriodSliceBreakdown(p2, 2, p2ByFY)
    );
    setOutNumeric(
      'outP2ProfitBeforeTax',
      p2.profit_before_tax || 0,
      'Period 2 PBT = AP PBT apportioned to period 2',
      `${pounds(profitBeforeTax)} x (${p2.days || 0}/${apDays}) ~= ${pounds(p2.profit_before_tax || 0)}\n\n` +
      buildPeriodSliceBreakdown(p2, 2, p2ByFY)
    );
    setOutNumeric(
      'outP2LowerBracket',
      p2LowerBracket,
      'Period 2 lower bracket limit = sum of effective tax-slice lower thresholds in Period 2',
      buildPeriodThresholdBreakdown(p2ByFY, 'small_threshold_for_AP_in_this_FY', 'Lower bracket limit', 2)
    );
    setOutNumeric(
      'outP2UpperBracket',
      p2UpperBracket,
      'Period 2 upper bracket limit = sum of effective tax-slice upper thresholds in Period 2',
      buildPeriodThresholdBreakdown(p2ByFY, 'upper_threshold_for_AP_in_this_FY', 'Upper bracket limit', 2)
    );
    const p2TaxableDetail = buildPeriodTaxableDetail(p2, 2);
    setOutNumeric('outP2TaxableProfit', p2.taxable_profit || 0, p2TaxableDetail.formula, p2TaxableDetail.details);
    setOutNumeric(
      'outP2AIAClaimed',
      p2.aia_claim || 0,
      'Period 2 AIA: shared master cap allocated across trade and non-trade claims',
      `Master cap (P2) = ${pounds(p2AiaCap)}\n` +
      `Trade requested claim (P2) = qualifying trade additions share = ${pounds(p2.trade_aia_potential_claim || 0)}\n` +
      `Rental/property requested claim (P2) = qualifying rental/property AIA additions share = ${pounds(p2.non_trade_aia_potential_claim || 0)}\n` +
      `Note: AIA claim is not capped by current profit and can create/increase a loss.\n` +
      `Note: rental/property AIA offsets rental & property stream only (not interest income).\n` +
      `Allocated from shared cap -> trade claim ${pounds(p2TradeAiaClaim)} | non-trade claim ${pounds(p2NonTradeAiaClaim)}\n` +
      `Total AIA claim (P2) = ${pounds(p2TradeAiaClaim)} + ${pounds(p2NonTradeAiaClaim)} = ${pounds(p2.aia_claim || 0)}`
    );
    const p2MrDetail = buildPeriodMRDetail(p2, 2, p2ByFY);
    setOutNumeric('outP2MarginalRelief', p2.marginal_relief || 0, p2MrDetail.formula, p2MrDetail.details);

    // Log AP split if applicable
    const periodDays1 = Number((periods[0] && periods[0].days) || p1.days || 0);
    const periodDays2 = Number((periods[1] && periods[1].days) || p2.days || 0);
    const apDaysMsg = isSplit
      ? `AP SPLIT ACTIVE: ${apDays} days split into Period 1 (${periodDays1} days) + Period 2 (${periodDays2} days). Each period has own thresholds, AIA, and tax calculation.`
      : `Standard period (12 months or less): ${apDays} days`;
    console.log(apDaysMsg);
    console.log('OK Computed outputs updated (using TaxEngine with HMRC-compliant rules)');
    setStatus('Calculation updated.', 'ok');
    } catch(err) {
      console.error('ERROR COMPUTE ERROR:', err.message);
      console.error('Stack:', err.stack);
      const msg = String(err.message || '');
      const isDateError = msg.includes('Invalid accounting period dates') || msg.includes('Accounting period end date must be on/after start date');
      if (isDateError) {
        setStatus('Dates are invalid. Ensure end date is on or after start date.', 'error');
        return;
      }
      setStatus('Calculation error: ' + msg, 'error');
      if (!options.silent) alert('Error during calculation:\n\n' + msg);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    console.log('OK Page loaded. TaxEngine:', typeof TaxEngine, 'TaxModel:', typeof TaxModel);
    if (typeof TaxEngine === 'undefined') {
      console.error('ERROR TaxEngine not loaded!');
      alert('ERROR: TaxEngine library failed to load. Check browser console.');
      return;
    }
    
    $("computeBtn").addEventListener('click', function(){
      console.log('-> Compute button clicked');
      compute({ silent: true });
    });
    $("resetBtn").addEventListener('click', function(){ 
      document.getElementById('dataForm').reset();
      setTimeout(() => compute({ silent: true }), 100); // Auto-calculate after reset (with small delay)
    });

    function attachTaxonomyIcons() {
      const fields = document.querySelectorAll('#dataForm input:not([type="hidden"])');
      fields.forEach((input) => {
        if (!input.id || input.dataset.taxonomyIconAttached === '1') return;
        const parent = input.parentNode;
        if (!parent) return;

        const wrap = document.createElement('div');
        wrap.className = 'fieldWithInfo';
        parent.insertBefore(wrap, input);
        wrap.appendChild(input);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mapIcon';
        btn.textContent = '[i]';
        btn.dataset.taxonomyTarget = input.id;
        btn.dataset.taxonomyTitle = input.id;
        btn.setAttribute('aria-label', `Show taxonomy mapping for ${input.id}`);
        wrap.appendChild(btn);

        input.dataset.taxonomyIconAttached = '1';
      });
    }

    attachTaxonomyIcons();

    // AUTO-CALCULATE ON INPUT CHANGE (real-time updates)
    // Add listeners to all form inputs to trigger compute() whenever any value changes
    const formInputs = document.querySelectorAll('#dataForm input[type="text"], #dataForm input[type="number"], #dataForm input[type="date"], #dataForm input[type="file"]');
    formInputs.forEach(input => {
      // Debounce: wait 300ms after typing stops before computing
      let debounceTimer;
      if (input.type !== 'file') {
        input.addEventListener('input', function() {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            console.log('-> Auto-compute triggered by input change to', this.id);
            compute({ silent: true });
          }, 300);
        });
      }
      
      // Also compute on blur (when user leaves the field)
      input.addEventListener('change', function() {
          console.log('-> Auto-compute triggered by input change to', this.id);
        compute({ silent: true });
      });
    });

    // Run initial calculation on page load
    console.log('-> Running initial calculation on page load');
    compute({ silent: true });

    // Formula panel elements
    const panel = $('formulaPanel');
    const formulaTitle = $('formulaTitle');
    const formulaMeta = $('formulaMeta');
    const formulaText = $('formulaText');
    const formulaDetails = $('formulaDetails');
    const closePanel = $('closePanel');
    const sliderControls = $('sliderControls');
    const enableSlider = $('enableSlider');
    const sliderWrap = $('sliderWrap');
    const formulaSlider = $('formulaSlider');
    const sliderValue = $('sliderValue');

    let activeInput = null;
    function buildFormulaMeta(input){
      if (!input) return '';
      const fieldInfo = getFieldTaxonomyInfo(input.id);
      return `HMRC TAGGING\n` +
        `Field ID: ${input.id}\n` +
        `Variable: ${fieldInfo.variableName}\n` +
        `CT600: ${fieldInfo.ct600Mapping}\n` +
        `Tax Computation: ${fieldInfo.taxComputationMapping}`;
    }

    function openFormulaPanel(input, titleOverride){
      if(!input) return;
      activeInput = input;
      const label = input.closest('label');
      const title = titleOverride || (label ? (label.textContent || input.id) : input.id);
      formulaTitle.textContent = title.trim();
      formulaMeta.textContent = buildFormulaMeta(input);
      formulaText.textContent = input.dataset.formula || '';
      formulaDetails.textContent = input.dataset.details || '';

      // slider setup
      const raw = Number(input.dataset.raw) || Number(input.value) || 0;
      const rounded = Number(input.dataset.orig) || Number(input.value) || 0;
      sliderControls.style.display = 'block';
      enableSlider.checked = false;
      sliderWrap.style.display = 'none';
      let min = Math.floor(raw * 0.5);
      let max = Math.ceil(raw * 1.5);
      if (min === max) { min = Math.floor(raw - 100); max = Math.ceil(raw + 100); }
      formulaSlider.min = String(min);
      formulaSlider.max = String(max);
      formulaSlider.step = '1';
      formulaSlider.value = String(rounded);
      sliderValue.textContent = String(rounded);

      panel.setAttribute('aria-hidden','false');
      panel.classList.add('open');
    }

    function openTaxonomyPanel(input, titleOverride){
      if(!input) return;
      activeInput = null;
      const fieldInfo = getFieldTaxonomyInfo(input.id);
      const label = input.closest('label');
      const title = titleOverride || (label ? (label.textContent || input.id) : input.id);

      formulaTitle.textContent = `Field Mapping: ${title.trim()}`;
      formulaMeta.textContent = buildFormulaMeta(input);
      formulaText.textContent =
        `Variable name:\n${fieldInfo.variableName}\n\n` +
        `CT600 mapping:\n${fieldInfo.ct600Mapping}\n\n` +
        `Tax computation mapping:\n${fieldInfo.taxComputationMapping}`;
      formulaDetails.textContent =
        `Field ID: ${input.id}\n` +
        `Mapping source: TAXONOMY CROSSWALK`;

      sliderControls.style.display = 'none';
      enableSlider.checked = false;
      sliderWrap.style.display = 'none';

      panel.setAttribute('aria-hidden','false');
      panel.classList.add('open');
    }

    function closeFormulaPanel(){
      if(activeInput && enableSlider && !enableSlider.checked){
        if(activeInput.dataset.orig) activeInput.value = activeInput.dataset.orig;
      }
      panel.setAttribute('aria-hidden','true');
      panel.classList.remove('open');
      activeInput = null;
    }

    // click delegation: open panel when clicking a computed readonly input
    document.body.addEventListener('click', function(ev){
      const t = ev.target;
      const taxonomyBtn = t && t.closest ? t.closest('[data-taxonomy-target]') : null;
      if (taxonomyBtn) {
        const targetId = taxonomyBtn.getAttribute('data-taxonomy-target');
        const title = taxonomyBtn.getAttribute('data-taxonomy-title') || targetId || 'Field';
        const targetInput = targetId ? $(targetId) : null;
        if (targetInput) openTaxonomyPanel(targetInput, title);
        return;
      }
      if(t && t.tagName === 'INPUT' && t.readOnly && t.dataset && t.dataset.formula){
        openFormulaPanel(t);
      }
      const iconBtn = t && t.closest ? t.closest('[data-calc-target]') : null;
      if (iconBtn) {
        const targetId = iconBtn.getAttribute('data-calc-target');
        const title = iconBtn.getAttribute('data-calc-title') || targetId || 'Calculation';
        const targetInput = targetId ? $(targetId) : null;
        if (targetInput) openFormulaPanel(targetInput, title);
      }
    });

    // also make the whole label.computed clickable
    document.querySelectorAll('.computed').forEach(function(lbl){
      lbl.style.cursor = 'pointer';
      lbl.addEventListener('click', function(ev){
        if(ev.target && (ev.target.tagName === 'INPUT' || (ev.target.closest && ev.target.closest('button')))) return;
        const inp = lbl.querySelector('input[readonly]');
        if(inp) openFormulaPanel(inp);
      });
    });

    // close button
    closePanel.addEventListener('click', function(){ closeFormulaPanel(); });

    // slider enable toggle
    enableSlider.addEventListener('change', function(){
      if(enableSlider.checked){
        sliderWrap.style.display = 'block';
        if(activeInput) activeInput.dataset._saved = activeInput.value;
      } else {
        sliderWrap.style.display = 'none';
        if(activeInput && activeInput.dataset._saved) activeInput.value = activeInput.dataset._saved;
      }
    });

    // slider movement updates the active input and re-runs compute
    formulaSlider.addEventListener('input', function(){
      const val = Number(formulaSlider.value);
      sliderValue.textContent = String(val);
      if(activeInput){
        activeInput.value = String(Math.round(val));
        activeInput.dataset.adjusted = '1';
        if (activeInput.id === 'outTradingLossBFAvailable') {
          const hidden = $('tradingLossBF');
          if (hidden) hidden.value = String(Math.round(val));
        }
        if (activeInput.id === 'outPropertyLossBFAvailable') {
          const hidden = $('rentalLossBF');
          if (hidden) hidden.value = String(Math.round(val));
        }
        // Re-run compute to propagate slider changes to dependent fields
        compute({ silent: true });
      }
    });
  });

})();

