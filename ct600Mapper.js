/**
 * ct600Mapper.js
 * Maps canonical tax model -> CT600 box values.
 *
 * IMPORTANT:
 * - CT600 boxes are outputs, not your truth.
 * - Keep this mapper thin and deterministic.
 */
(function (root) {
  'use strict';

  const TaxModel = root.TaxModel;
  if (!TaxModel) throw new Error('TaxModel not loaded. Load taxModel.js first.');

  function round(n) { return TaxModel.roundPounds(n); }
  function roundNonNegative(n) { return Math.max(0, round(n)); }
  function toMoney(n) {
    const x = Number(n || 0);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }
  function toCheckmark(v) {
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) return '';
    return (s === 'x' || s === 'true' || s === '1' || s === 'yes') ? 'X' : '';
  }
  function sumNumbers(values) {
    return values.reduce((s, x) => s + (Number(x || 0) || 0), 0);
  }

  function computePropertyBusinessIncomeForCT600(result) {
    const direct = Number(result?.property?.propertyBusinessIncomeForCT600);
    if (Number.isFinite(direct)) return Math.max(0, direct);

    const periods = result?.metadata?.periods;
    if (!Array.isArray(periods) || !periods.length) {
      return Math.max(0, Number(result?.property?.propertyProfitAfterLossOffset || 0));
    }
    const net = periods.reduce((s, p) => {
      const propertyProfitAfterLoss = Number(p.property_profit_after_loss || 0);
      const nonTradeAIAClaim = Number(p.non_trade_aia_claim || 0);
      return s + (propertyProfitAfterLoss - nonTradeAIAClaim);
    }, 0);
    return Math.max(0, net);
  }

  function toTableEntry(slice) {
    const taxableProfit = Math.max(0, Number(slice?.taxableProfit || 0));
    const ctCharge = Math.max(0, Number(slice?.ctCharge || 0));
    const marginalRelief = Math.max(0, Number(slice?.marginalRelief || 0));
    const smallRate = Number(slice?.small_rate ?? 0);
    const mainRate = Number(slice?.main_rate ?? 0);

    if (taxableProfit <= 0) {
      return {
        fyYear: Number(slice?.fy_year || 0),
        profit: 0,
        ratePct: 0,
        taxBeforeRelief: 0
      };
    }

    let rate = 0;
    let taxBeforeRelief = 0;
    if (marginalRelief > 0 && mainRate > 0) {
      rate = mainRate;
      taxBeforeRelief = taxableProfit * mainRate;
    } else {
      // For tiny split slices, effective rates can be slightly noisy due to rounding.
      // This only affects presentation; filing values remain consistent.
      const effective = ctCharge / taxableProfit;
      if (smallRate > 0 && mainRate > smallRate && effective <= (smallRate + 0.002)) {
        rate = smallRate;
      } else if (mainRate > 0) {
        rate = mainRate;
      } else {
        rate = effective;
      }
      taxBeforeRelief = taxableProfit * rate;
    }

    return {
      fyYear: Number(slice?.fy_year || 0),
      profit: taxableProfit,
      ratePct: rate * 100,
      taxBeforeRelief
    };
  }

  function aggregateRowsByYear(slices) {
    const entries = (Array.isArray(slices) ? slices : [])
      .map(toTableEntry)
      .filter((x) => x.fyYear > 0 && (x.profit > 0 || x.taxBeforeRelief > 0));

    const byYear = new Map();
    entries.forEach((entry) => {
      if (!byYear.has(entry.fyYear)) byYear.set(entry.fyYear, []);
      byYear.get(entry.fyYear).push(entry);
    });

    const years = Array.from(byYear.keys()).sort((a, b) => a - b).slice(0, 2);
    return years.map((year) => {
      const rows = byYear.get(year) || [];
      const byRate = new Map();
      rows.forEach((row) => {
        const key = row.ratePct.toFixed(4);
        const prev = byRate.get(key);
        if (!prev) {
          byRate.set(key, { ...row });
          return;
        }
        prev.profit += row.profit;
        prev.taxBeforeRelief += row.taxBeforeRelief;
      });
      const merged = Array.from(byRate.values())
        .sort((a, b) => a.ratePct - b.ratePct)
        .slice(0, 3);
      return { year, rows: merged };
    });
  }

  function fillRateTableBoxes(boxes, result) {
    const groupedYears = aggregateRowsByYear(result?.byFY);
    const rowSpecs = [
      { yearBox: 330, profitBox: 335, rateBox: 340, taxBox: 345, groupIndex: 0, rowIndex: 0 },
      { yearBox: null, profitBox: 350, rateBox: 355, taxBox: 360, groupIndex: 0, rowIndex: 1 },
      { yearBox: null, profitBox: 365, rateBox: 370, taxBox: 375, groupIndex: 0, rowIndex: 2 },
      { yearBox: 380, profitBox: 385, rateBox: 390, taxBox: 395, groupIndex: 1, rowIndex: 0 },
      { yearBox: null, profitBox: 400, rateBox: 405, taxBox: 410, groupIndex: 1, rowIndex: 1 },
      { yearBox: null, profitBox: 415, rateBox: 420, taxBox: 425, groupIndex: 1, rowIndex: 2 }
    ];

    rowSpecs.forEach((spec) => {
      const group = groupedYears[spec.groupIndex] || null;
      const row = group?.rows?.[spec.rowIndex] || null;
      if (spec.yearBox != null) {
        boxes[`box_${spec.yearBox}_financial_year`] = group ? group.year : '';
      }
      boxes[`box_${spec.profitBox}_profits_chargeable_at_corresponding_rate`] = toMoney(row ? row.profit : 0);
      boxes[`box_${spec.rateBox}_corresponding_rate`] = toMoney(row ? row.ratePct : 0);
      boxes[`box_${spec.taxBox}_tax`] = toMoney(row ? row.taxBeforeRelief : 0);
    });
  }

  function map(inputs, result) {
    const boxes = {};

    // Period + associates
    const accountingPeriodStart = inputs.accountingPeriodStart ?? inputs.apStart;
    const accountingPeriodEnd = inputs.accountingPeriodEnd ?? inputs.apEnd;
    const associatedCompanyCount = inputs.associatedCompanyCount ?? inputs.assocCompanies;
    const tradingLossBroughtForward = inputs.losses?.tradingLossBroughtForward ?? inputs.losses?.tradingLossBF ?? 0;
    const tradingTurnover = inputs.pnl.tradingTurnover ?? inputs.pnl.turnover;
    const chargeableGains = inputs.pnl.chargeableGains ?? inputs.pnl.capitalGains;
    const propertyLossBroughtForward = inputs.pnl.propertyLossBroughtForward ?? inputs.pnl.propertyLossBF;
    const tradingBalancingCharges = inputs.pnl.tradingBalancingCharges ?? inputs.pnl.disposalGains;
    const tradingProfitBeforeLoss = Number(
      result.computation.grossTradingProfit ??
      ((result.computation.taxableTradingProfit || 0) + (result.computation.tradingLossUsed || 0))
    );
    const profitsSubtotal = Number(
      result.computation.profitsSubtotal ??
      ((result.computation.taxableTradingProfit || 0) + (result.computation.taxableNonTradingProfits || 0))
    );
    const nonTradingLoanRelationshipProfit = Math.max(0, Number(inputs.pnl.interestIncome || 0));
    const propertyBusinessIncome = computePropertyBusinessIncomeForCT600(result);
    const ct600 = inputs.ct600 || {};
    const declaration = inputs.declaration || {};

    const communityInvestmentTaxRelief = toMoney(ct600.communityInvestmentTaxRelief || 0);
    const doubleTaxationRelief = toMoney(ct600.doubleTaxationRelief || 0);
    const advanceCorporationTax = toMoney(ct600.advanceCorporationTax || 0);
    const loansToParticipatorsTax = toMoney(ct600.loansToParticipatorsTax || 0);
    const controlledForeignCompaniesTax = toMoney(ct600.controlledForeignCompaniesTax || 0);
    const bankLevyPayable = toMoney(ct600.bankLevyPayable || 0);
    const bankSurchargePayable = toMoney(ct600.bankSurchargePayable || 0);
    const residentialPropertyDeveloperTax = toMoney(ct600.residentialPropertyDeveloperTax || 0);
    const eogplPayable = toMoney(ct600.eogplPayable || 0);
    const eglPayable = toMoney(ct600.eglPayable || 0);
    const supplementaryChargePayable = toMoney(ct600.supplementaryChargePayable || 0);
    const incomeTaxDeductedFromGrossIncome = toMoney(ct600.incomeTaxDeductedFromGrossIncome || 0);
    const coronavirusOverpaymentNowDue = toMoney(ct600.coronavirusSupportPaymentOverpaymentNowDue || 0);
    const restitutionTax = toMoney(ct600.restitutionTax || 0);
    const assocCompanyFyYears = Array.from(new Set(
      (Array.isArray(result?.byFY) ? result.byFY : [])
        .flatMap((slice) => (
          Array.isArray(slice?.fy_years)
            ? slice.fy_years
            : [slice?.fy_year]
        ))
        .map((y) => Number(y || 0))
        .filter((y) => y > 0)
    ))
      .sort((a, b) => a - b)
      .slice(0, 3);
    const hasAssocFy1 = assocCompanyFyYears.length >= 1;
    const hasAssocFy2 = assocCompanyFyYears.length >= 2;
    const hasAssocFy3 = assocCompanyFyYears.length >= 3;

    boxes.box_30_period_start = accountingPeriodStart;
    boxes.box_35_period_end = accountingPeriodEnd;
    boxes.box_326_assoc_companies = hasAssocFy1 ? associatedCompanyCount : '';
    boxes.box_327_assoc_companies = hasAssocFy2 ? associatedCompanyCount : '';
    boxes.box_328_assoc_companies = hasAssocFy3 ? associatedCompanyCount : '';

    // Income headings
    boxes.box_145_trade_turnover = roundNonNegative(tradingTurnover);
    boxes.box_155_trading_profit = roundNonNegative(tradingProfitBeforeLoss);
    // Box 160 is "trading losses brought forward used" (used amount, not opening balance).
    boxes.box_160_trading_losses_bfwd_used = round(result.computation.tradingLossUsed);
    // Backward-compatible alias; prefer `box_160_trading_losses_bfwd_used`.
    boxes.box_160_trading_losses_bfwd = boxes.box_160_trading_losses_bfwd_used;
    boxes.box_165_net_trading_profits = roundNonNegative(result.computation.taxableTradingProfit);
    // Box 170 is a disclosure heading (gross NTLR profits), not a net taxable-interest box.
    boxes.box_170_non_trading_loan_relationship_profits = roundNonNegative(nonTradingLoanRelationshipProfit);
    boxes.box_190_property_business_income = roundNonNegative(propertyBusinessIncome);
    // Box 205 is residual/miscellaneous profits not reported elsewhere.
    // Do not duplicate total profits here.
    boxes.box_205_income_not_elsewhere = roundNonNegative(
      result.computation.miscellaneousIncomeNotElsewhere || 0
    );
    boxes.box_210_chargeable_gains = roundNonNegative(chargeableGains || 0);
    boxes.box_235_profits_subtotal = roundNonNegative(profitsSubtotal);
    boxes.box_250_property_business_losses_used = round(result.property.propertyLossUsed || 0);
    boxes.box_300_profits_before_deductions = roundNonNegative(
      result.computation.profitsSubtotal ?? profitsSubtotal
    );
    boxes.box_305_donations = 0;
    boxes.box_310_group_relief = 0;
    boxes.box_312_other_deductions = 0;
    boxes.box_315_taxable_profit = roundNonNegative(result.computation.taxableTotalProfits);
    boxes.box_620_franked_investment_income_exempt_abgh = roundNonNegative(inputs.pnl.dividendIncome);

    // Box 329 indicator
    // Logic is fully handled in taxEngine.js.
    boxes.box_329_small_profits_rate_or_marginal_relief_entitlement =
      String(result.tax.smallProfitsRateOrMarginalReliefEntitlement || '') === 'X' ? 'X' : '';

    // CT calculation table (boxes 330 to 425)
    fillRateTableBoxes(boxes, result);
    // Use defined result.tax variables directly (no derivation in mapper).
    boxes.box_430_corporation_tax = round(result.tax.corporationTaxTableTotal || 0);
    boxes.box_435_marginal_relief = toMoney(result.tax.marginalRelief || 0);
    boxes.box_440_corporation_tax_chargeable = round(result.tax.corporationTaxChargeable || 0);

    // Reliefs / deductions
    boxes.box_445_community_investment_tax_relief = communityInvestmentTaxRelief;
    boxes.box_450_double_taxation_relief = doubleTaxationRelief;
    boxes.box_455_underlying_rate_relief_claim = toCheckmark(ct600.underlyingRateReliefClaim);
    boxes.box_460_relief_carried_back_to_earlier_period = toCheckmark(ct600.reliefCarriedBackToEarlierPeriod);
    boxes.box_465_advance_corporation_tax = advanceCorporationTax;
    boxes.box_470_total_reliefs_and_deductions = round(result.tax.totalReliefsAndDeductions || 0);

    // Tax payable chain
    boxes.box_475_net_ct_liability = round(result.tax.netCTLiability || 0);
    boxes.box_480_tax_payable_by_a_close_company = loansToParticipatorsTax;
    boxes.box_500_cfc_bank_levy_surcharge_and_rpdt = round(result.tax.totalBox500Charges || 0);
    boxes.box_501_eogpl_payable = eogplPayable;
    boxes.box_502_egl_payable = eglPayable;
    boxes.box_505_supplementary_charge = supplementaryChargePayable;
    boxes.box_510_total_tax_chargeable = round(result.tax.totalTaxChargeable || 0);
    boxes.box_515_income_tax_deducted_from_gross_income = incomeTaxDeductedFromGrossIncome;
    boxes.box_520_income_tax_repayable = round(result.tax.incomeTaxRepayable || 0);
    boxes.box_525_self_assessment_tax_payable = round(result.tax.selfAssessmentTaxPayable || 0);
    boxes.box_526_coronavirus_support_payment_overpayment_now_due = coronavirusOverpaymentNowDue;
    boxes.box_527_restitution_tax = restitutionTax;
    boxes.box_528_total_self_assessment_tax_payable = round(result.tax.totalSelfAssessmentTaxPayable || 0);

    // Declaration
    boxes.box_975_name = String(declaration.name || '');
    boxes.box_980_date = String(declaration.date || '');
    boxes.box_985_status = String(declaration.status || '');

    // Helpful transparency (not official CT600 boxes)
    boxes._marginal_relief_total = round(result.tax.marginalRelief);
    boxes._trading_balancing_charges = round(tradingBalancingCharges || 0);
    boxes._trading_losses_bfwd = round(tradingLossBroughtForward || 0);
    boxes._trading_losses_used = round(result.computation.tradingLossUsed || 0);
    boxes._trading_losses_available = round(result.computation.tradingLossAvailable || 0);
    boxes._property_losses_bfwd = round(propertyLossBroughtForward || 0);
    boxes._property_losses_used = round(result.property.propertyLossUsed || 0);
    boxes._property_losses_available = round(result.property.propertyLossAvailable || 0);
    boxes._property_losses_cfwd = round(result.property.propertyLossCF || 0);
    boxes._engine_corporation_tax_charge = round(result.tax.corporationTaxCharge);
    // Internal consistency diagnostic: expected relationship is 430 - 435 = 440.
    const box430Minus435 = Number(boxes.box_430_corporation_tax || 0) - Number(boxes.box_435_marginal_relief || 0);
    const box440 = Number(boxes.box_440_corporation_tax_chargeable || 0);
    const integrityDelta = toMoney(box430Minus435 - box440);
    boxes._integrity_box_430_minus_435_equals_440 = Math.abs(integrityDelta) < 0.01 ? 'X' : '';
    boxes._integrity_box_430_435_440_delta = integrityDelta;

    return boxes;
  }

  root.CT600Mapper = { map };
})(typeof window !== 'undefined' ? window : globalThis);
