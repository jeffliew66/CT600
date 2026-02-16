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

  function map(inputs, result) {
    // Minimal set based on your existing box mapping usage.
    // Add more as you implement more CT600 pages/boxes.
    const boxes = {};

    // Period + associates
    const accountingPeriodStart = inputs.accountingPeriodStart ?? inputs.apStart;
    const accountingPeriodEnd = inputs.accountingPeriodEnd ?? inputs.apEnd;
    const associatedCompanyCount = inputs.associatedCompanyCount ?? inputs.assocCompanies;
    const tradingTurnover = inputs.pnl.tradingTurnover ?? inputs.pnl.turnover;
    const propertyIncome = inputs.pnl.propertyIncome ?? inputs.pnl.rentalIncome;
    const chargeableGains = inputs.pnl.chargeableGains ?? inputs.pnl.capitalGains;
    const tradingLossBroughtForward = inputs.losses.tradingLossBroughtForward ?? inputs.losses.tradingLossBF;
    const propertyLossBroughtForward = inputs.pnl.propertyLossBroughtForward ?? inputs.pnl.propertyLossBF;
    const tradingBalancingCharges = inputs.pnl.tradingBalancingCharges ?? inputs.pnl.disposalGains;
    const tradingProfitBeforeLoss = (result.computation.taxableTradingProfit || 0) + (result.computation.tradingLossUsed || 0);

    boxes.box_30_period_start = accountingPeriodStart;
    boxes.box_35_period_end = accountingPeriodEnd;
    boxes.box_326_assoc_companies = associatedCompanyCount;
    boxes.box_327_assoc_companies = associatedCompanyCount;
    boxes.box_328_assoc_companies = associatedCompanyCount;

    // P&L-related CT600 boxes you used
    boxes.box_145_trade_turnover = round(tradingTurnover);
    boxes.box_170_interest_income = round(inputs.pnl.interestIncome);
    boxes.box_190_rental_income = round(propertyIncome);
    // Engine input `disposalGains` is used as trading balancing charges
    // (AIA asset disposal context), not as non-trading chargeable gains.
    boxes.box_205_disposal_gains = 0;
    boxes.box_210_chargeable_gains = round(chargeableGains || 0);
    boxes.box_620_dividend_income = round(inputs.pnl.dividendIncome);

    // Trading profit
    // HMRC: box 155 is trading profits only (not total PBT including non-trading streams).
    boxes.box_155_trading_profit = round(tradingProfitBeforeLoss);
    // HMRC: box 160 is trading losses b/fwd set against trading profits in this AP.
    boxes.box_160_trading_losses_bfwd = round(result.computation.tradingLossUsed);
    boxes.box_165_net_trading_profits = round(result.computation.taxableTradingProfit);

    // Property losses
    boxes.box_250_prop_losses_bfwd = round(propertyLossBroughtForward);
    boxes.box_250_prop_losses_cfwd = round(result.property.propertyLossCF);

    // Profit subtotal (simplified): taxable trading + taxable non-trading
    // Engine classifies disposal balancing charges in trading; non-trading covers
    // interest, rental/property net and capital gains.
    boxes.box_235_profits_subtotal = round(
      result.computation.taxableTradingProfit + result.computation.taxableNonTradingProfits
    );
    boxes.box_300_profits_before_deductions = boxes.box_235_profits_subtotal;
    boxes.box_305_donations = 0;  // Not modeled in v1
    boxes.box_310_group_relief = 0;  // Not modeled in v1
    boxes.box_312_other_deductions = 0;  // Not modeled in v1

    // Taxable profit / TTP
    boxes.box_315_taxable_profit = round(result.computation.taxableTotalProfits);

    // Augmented profits
    boxes.box_330_augmented_profit = round(result.computation.augmentedProfits);

    // CT charge / payable
    // CORRECTION: Box 325 is "NI profits included" (NOT CT charge)
    // CT charge maps to Box 455 (total CT calculated)
    // Tax payable maps to Box 475 (net CT liability)
    // NOTE: Box 475 = Box 480 (Tax Payable) - Box 595 (Tax Already Paid)
    //       For v1, we assume no prior tax payments, so Box 475 ≈ Box 480
    boxes.box_455_total_ct_calculated = round(result.tax.corporationTaxCharge);
    boxes.box_475_net_ct_liability = round(result.tax.taxPayable);

    // Helpful transparency (not official CT600 boxes, but good for UI/debug)
    boxes._marginal_relief_total = round(result.tax.marginalRelief);
    boxes._trading_balancing_charges = round(tradingBalancingCharges || 0);

    return boxes;
  }

  root.CT600Mapper = { map };
})(typeof window !== 'undefined' ? window : globalThis);
