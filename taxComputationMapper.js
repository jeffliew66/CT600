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

      // Trading income components (disposal proceeds are treated as balancing charges in trade)
      trading_income_components: {
        turnover: round(inputs.pnl.turnover),
        govt_grants: round(inputs.pnl.govtGrants),
        asset_disposal_proceeds_balancing_charges: round(inputs.pnl.disposalGains || 0),
        total_trading_income: round(
          (inputs.pnl.turnover || 0) +
          (inputs.pnl.govtGrants || 0) +
          (inputs.pnl.disposalGains || 0)
        )
      },

      // Net trading profit before loss offset
      net_trading_profit_before_loss: round(
        result.computation.taxableTradingProfit + result.computation.tradingLossUsed
      ),

      // Less: trading loss b/fwd
      trading_loss_bfwd_applied: round(result.computation.tradingLossUsed),

      // Trading profit after loss
      net_trading_profit: round(result.computation.taxableTradingProfit),

      // Add: non-trading income items (disposal balancing charges excluded from this bucket)
      other_income: {
        rental_income_net: round(result.property.propertyProfitAfterLossOffset),
        interest_income: round(inputs.pnl.interestIncome),
        capital_gains: round(inputs.pnl.capitalGains || 0),
        capital_gains_source_file: String(inputs.pnl.capitalGainsFileName || ''),
        dividend_income: round(inputs.pnl.dividendIncome),
        total_other_income: round(
          result.property.propertyProfitAfterLossOffset +
          inputs.pnl.interestIncome +
          (inputs.pnl.capitalGains || 0) +
          inputs.pnl.dividendIncome
        )
      },

      // Final: taxable total profits (TTP)
      taxable_total_profits: round(result.computation.taxableTotalProfits)
    };
  }

  /**
   * Builds "Capital Allowances Statement" (CT600 Box 670 basis)
   */
  function buildCapitalAllowancesSchedule(inputs, result) {
    const slices = Array.isArray(result.byFY) ? result.byFY : [];
    const sliceRows = slices.map((slice) => ({
      fy_year: slice.fy_year,
      fy_years: Array.isArray(slice.fy_years) ? slice.fy_years : [slice.fy_year],
      period_index: slice.period_index || 1,
      ap_days_in_fy: slice.ap_days_in_fy || 0,
      aia_limit_pro_rated: Number(slice.aia_cap_for_fy || 0)
    }));

    const totalCap = sliceRows.reduce((s, row) => s + row.aia_limit_pro_rated, 0);
    const requested = Math.max(0, Number(inputs.capitalAllowances?.aiaAdditions || 0));
    const claimed = Math.max(0, Number(result.computation?.capitalAllowances || 0));
    const unrelieved = Math.max(0, requested - claimed);

    // Allocate requested/claimed totals across slices by cap-share for schedule display.
    // This is presentational only; engine totals remain authoritative.
    function allocateByWeight(total, rows, valueKey, outKey) {
      let remaining = round(total);
      const out = rows.map((row, idx) => {
        const isLast = idx === rows.length - 1;
        const weight = totalCap > 0 ? (row[valueKey] / totalCap) : 0;
        const allocated = isLast ? remaining : round(total * weight);
        remaining -= allocated;
        return allocated;
      });
      return rows.map((row, idx) => ({ ...row, [outKey]: out[idx] }));
    }

    let parts = allocateByWeight(requested, sliceRows, 'aia_limit_pro_rated', 'aia_claim_requested');
    parts = allocateByWeight(claimed, parts, 'aia_limit_pro_rated', 'aia_allowance_claimed');
    parts = allocateByWeight(unrelieved, parts, 'aia_limit_pro_rated', 'aia_unrelieved_bfwd');

    const partsByFY = parts.map((row) => ({
      fy_year: row.fy_year,
      fy_years: row.fy_years,
      period_index: row.period_index,
      ap_days_in_fy: row.ap_days_in_fy,
      aia_limit_pro_rated: round(row.aia_limit_pro_rated),
      aia_claim_requested: round(row.aia_claim_requested),
      aia_allowance_claimed: round(row.aia_allowance_claimed),
      aia_unrelieved_bfwd: round(row.aia_unrelieved_bfwd)
    }));

    return {
      total_plant_additions: round(inputs.capitalAllowances.aiaAdditions),
      annual_investment_allowance: {
        parts_by_fy: partsByFY,
        total_aia_cap: round(totalCap),
        total_aia_claimed: round(result.computation.capitalAllowances),
        allocation_note: 'Per-slice requested/claimed/unrelieved figures are allocated by AIA cap-share for reporting.'
      },
      total_capital_allowances: round(result.computation.capitalAllowances)
    };
  }

  /**
   * Builds "Tax Calculation Table" (CT600 Page 4, Boxes 250-415)
   * Shows CT charge broken down by FY.
   * DESIGN NOTE: LOSS-RELIEF TREATMENT
   * This engine applies trading losses against taxable trading profits only.
   *
   * Non-trading streams are computed separately and are not reduced by
   * trading loss relief in this model.
   *
   * This note is informational only and follows the implemented engine logic.
   */
  function buildTaxCalculationTable(result) {
    const byFY = result.byFY;

    const taxByFY = byFY.map((fy) => {
      const tp = round(fy.taxableProfit || 0);
      const ap = round(fy.augmentedProfit || 0);
      const ct = round(fy.ctCharge || 0);
      const mr = round(fy.marginalRelief || 0);
      const mainRate = Number(fy.main_rate ?? 0.25);

      // Compute actual effective tax rate (CT charge / taxable profit)
      // NOTE: Store as decimal (0.19, 0.25, etc.), NOT rounded to pounds
      const effectiveRate = tp > 0 ? (ct / tp) : 0;

      return {
        fy_year: fy.fy_year,
        fy_years: Array.isArray(fy.fy_years) ? fy.fy_years : [fy.fy_year],
        period_index: fy.period_index || 1,
        taxable_profit: tp,
        augmented_profit: ap,
        main_rate: mainRate,
        effective_tax_rate: effectiveRate,
        corporation_tax_at_main_rate: round(tp * mainRate),
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
        // Metadata: document implemented loss-relief treatment
        loss_relief_note: 'Trading losses are applied against taxable trading profits only.'
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
    computation.capital_allowances_schedule = buildCapitalAllowancesSchedule(inputs, result);

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
