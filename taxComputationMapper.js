/**
 * taxComputationMapper.js
 * Maps tax engine results -> CT600 Tax Computation Schedule (pages 3-4)
 * Also builds the detailed Tax Computation supporting calculations
 *
 * Handles:
 * - Profit adjustment schedule (trading, property, interest, dividends)
 * - Capital allowances schedule
 * - Trading loss carry-forward
 * - Tax computation per FY
 * - Supplementary charges (if applicable)
 */
(function (root) {
  'use strict';

  const TaxModel = root.TaxModel;
  if (!TaxModel) throw new Error('TaxModel not loaded. Load taxModel.js first.');

  function round(n) { return TaxModel.roundPounds(n); }

  /**
   * Builds "Profit Adjustment Schedule" (CT600 Page 3 basis)
   * Shows step from accounts profit to taxable profit
   */
  function buildProfitAdjustmentSchedule(inputs, result) {
    return {
      // Starting point: accounts profit before tax (box 155 in final result)
      accounting_profit_before_tax: round(result.accounts.profitBeforeTax),

      // Add-backs: non-deductible items
      add_backs: {
        depreciation_disallowed: round(inputs.pnl.depreciation),
        disallowable_expenses: round(inputs.adjustments.disallowableExpenses),
        other_adjustments_add_back: round(inputs.adjustments.otherAdjustments),
        total_add_backs: round(result.computation.addBacks)
      },

      // Subtotal: profit before deductions
      subtotal_before_deductions: round(
        result.accounts.profitBeforeTax + result.computation.addBacks
      ),

      // Deductions: capital allowances
      deductions: {
        capital_allowances_claimed: round(result.computation.capitalAllowances),
        total_deductions: round(result.computation.deductions)
      },

      // Net trading profit before loss offset
      net_trading_profit_before_loss: round(
        result.accounts.profitBeforeTax + result.computation.addBacks - result.computation.deductions
      ),

      // Less: trading loss b/fwd
      trading_loss_bfwd_applied: round(result.computation.tradingLossUsed),

      // Trading profit after loss
      net_trading_profit: round(result.computation.taxableTradingProfit),

      // Add: other income items (property, interest, dividends separate)
      other_income: {
        rental_income_net: round(result.property.propertyProfitAfterLossOffset),
        interest_income: round(inputs.pnl.interestIncome),
        disposal_gains: round(inputs.pnl.disposalGains || 0),
        capital_gains: round(inputs.pnl.capitalGains || 0),
        capital_gains_source_file: String(inputs.pnl.capitalGainsFileName || ''),
        dividend_income: round(inputs.pnl.dividendIncome),
        govt_grants: round(inputs.pnl.govtGrants),
        total_other_income: round(
          result.property.propertyProfitAfterLossOffset +
          inputs.pnl.interestIncome +
          (inputs.pnl.disposalGains || 0) +
          (inputs.pnl.capitalGains || 0) +
          inputs.pnl.dividendIncome +
          inputs.pnl.govtGrants
        )
      },

      // Final: taxable total profits (TTP)
      taxable_total_profits: round(result.computation.taxableTotalProfits)
    };
  }

  /**
   * Builds "Capital Allowances Statement" (CT600 Box 670 basis)
   */
  function buildCapitalAllowancesSchedule(inputs, result, fyOverlaps) {
    const partsByFY = fyOverlaps.map((fy) => {
      const byFY = result.byFY.find((x) => x.fy_year === fy.fy_year);
      const aiaCap = byFY?.aia_cap_for_fy || 0;

      return {
        fy_year: fy.fy_year,
        ap_days_in_fy: fy.ap_days_in_fy,
        aia_limit_pro_rated: round(aiaCap),
        aia_claim_requested: round(inputs.capitalAllowances.aiaAdditions),
        aia_allowance_claimed: round(Math.min(inputs.capitalAllowances.aiaAdditions, aiaCap)),
        aia_unrelieved_bfwd: round(Math.max(0, inputs.capitalAllowances.aiaAdditions - aiaCap))
      };
    });

    return {
      total_plant_additions: round(inputs.capitalAllowances.aiaAdditions),
      annual_investment_allowance: {
        parts_by_fy: partsByFY,
        total_aia_claimed: round(result.computation.capitalAllowances)
      },
      total_capital_allowances: round(result.computation.capitalAllowances)
    };
  }

  /**
   * Builds "Tax Calculation Table" (CT600 Page 4, Boxes 250-415)
   * Shows CT charge broken down by FY
   * 
   * ⚠️  DESIGN DECISION: IMPLICIT SECTION 37 CLAIM
   * This engine automatically offsets trading losses against other income
   * (rental, interest, dividends) in the current year.
   * 
   * HMRC Rule: This requires an explicit Section 37 Claim (CTA 2010 s37).
   * This calculation assumes the company has made (or will make) this claim.
   * 
   * Impact: If the company prefers to carry forward the loss (to offset
   * against future trading profits, possibly at a higher rate), they would
   * NOT make the Section 37 claim, and taxable profit would be HIGHER.
   * 
   * For transparency: The output notes "Loss set off against other income"
   * to indicate Section 37 relief has been applied.
   */
  function buildTaxCalculationTable(result) {
    const byFY = result.byFY;

    const taxByFY = byFY.map((fy) => {
      const tp = round(fy.taxableProfit || 0);
      const ap = round(fy.augmentedProfit || 0);
      const ct = round(fy.ctCharge || 0);
      const mr = round(fy.marginalRelief || 0);

      // Compute actual effective tax rate (CT charge / taxable profit)
      // NOTE: Store as decimal (0.19, 0.25, etc.), NOT rounded to pounds
      const effectiveRate = tp > 0 ? (ct / tp) : 0;

      return {
        fy_year: fy.fy_year,
        taxable_profit: tp,
        augmented_profit: ap,
        effective_tax_rate: effectiveRate,
        corporation_tax_at_main_rate: round(tp * 0.25),
        marginal_relief_reduction: mr,
        corporation_tax_charged: ct
      };
    });

    const totalTaxable = round(byFY.reduce((s, x) => s + (x.taxableProfit || 0), 0));
    const totalAugmented = round(byFY.reduce((s, x) => s + (x.augmentedProfit || 0), 0));
    const totalMarginalRelief = round(byFY.reduce((s, x) => s + (x.marginalRelief || 0), 0));
    const totalCTCharge = round(byFY.reduce((s, x) => s + (x.ctCharge || 0), 0));

    return {
      computation_by_fy: taxByFY,
      year_summary: {
        total_taxable_profit: totalTaxable,
        total_augmented_profit: totalAugmented,
        total_marginal_relief: totalMarginalRelief,
        corporation_tax_charge: totalCTCharge,
        // Metadata: Document Section 37 assumption
        section_37_claim_note: 'Trading losses have been set off against other income per Section 37 Claim (CTA 2010 s37).'
      }
    };
  }

  /**
   * Builds "Trading Loss Claim" (CT600 Section 2)
   */
  function buildTradingLossSchedule(inputs, result) {
    const requested =
      inputs.losses.tradingLossUseRequested == null
        ? inputs.losses.tradingLossBF
        : Math.min(inputs.losses.tradingLossBF, inputs.losses.tradingLossUseRequested);
    return {
      trading_loss_bfwd_available: round(inputs.losses.tradingLossBF),
      trading_loss_use_requested: round(requested),
      trading_loss_bfwd_used_this_period: round(result.computation.tradingLossUsed),
      trading_loss_cfwd: round(
        inputs.losses.tradingLossBF - result.computation.tradingLossUsed
      )
    };
  }

  /**
   * Main export: maps TaxEngine result -> comprehensive Tax Computation
   */
  function map(inputs, result, fyOverlaps) {
    const computation = {};

    // 1) Profit adjustment (how we got to taxable profit)
    computation.profit_adjustment_schedule = buildProfitAdjustmentSchedule(inputs, result);

    // 2) Capital allowances (AIA claim detail)
    computation.capital_allowances_schedule = buildCapitalAllowancesSchedule(inputs, result, fyOverlaps);

    // 3) Trading loss carry-forward
    computation.trading_loss_schedule = buildTradingLossSchedule(inputs, result);

    // 4) Tax calculation (CT charge by FY, showing rates)
    computation.tax_calculation_table = buildTaxCalculationTable(result);

    // 5) Final summary
    computation.summary = {
      taxable_total_profits: round(result.computation.taxableTotalProfits),
      augmented_profits: round(result.computation.augmentedProfits),
      corporation_tax_charge: round(result.tax.corporationTaxCharge),
      marginal_relief_total: round(result.tax.marginalRelief),
      tax_payable: round(result.tax.taxPayable)
    };

    return computation;
  }

  root.TaxComputationMapper = { map };
})(typeof window !== 'undefined' ? window : globalThis);
