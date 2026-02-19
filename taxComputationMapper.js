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
  function getSlices(result) {
    if (Array.isArray(result?.slices) && result.slices.length) return result.slices;
    return Array.isArray(result?.byFY) ? result.byFY : [];
  }

  /**
   * Builds "Profit Adjustment Schedule" (CT600 Page 3 basis)
   * Shows step from accounts profit to taxable profit
   */
  function buildProfitAdjustmentSchedule(inputs, result) {
    const depreciationExpense = inputs.pnl.depreciationExpense;
    const disallowableExpenditure = inputs.adjustments.disallowableExpenditure;
    const otherTaxAdjustmentsAddBack = inputs.adjustments.otherTaxAdjustmentsAddBack;
    const tradingTurnover = inputs.pnl.tradingTurnover;
    const governmentGrants = inputs.pnl.governmentGrants;
    const tradingBalancingCharges = inputs.pnl.tradingBalancingCharges;
    const chargeableGains = inputs.pnl.chargeableGains;
    const chargeableGainsComputationFileName = inputs.pnl.chargeableGainsComputationFileName;
    const nonTradingIncomeClassificationAmount = round(
      result.computation.nonTradingIncomeExcludedFromTradingView ??
      (
        (inputs.pnl.interestIncome || 0) +
        (inputs.pnl.propertyIncome || 0) +
        (chargeableGains || 0)
      )
    );
    const subtotalBeforeDeductions = round(
      result.computation.subtotalBeforeDeductions ??
      (result.accounts.profitBeforeTax + result.computation.addBacks)
    );
    const totalTradingIncome = round(
      result.computation.totalTradingIncome ??
      (
        (tradingTurnover || 0) +
        (governmentGrants || 0) +
        (tradingBalancingCharges || 0)
      )
    );
    const netTradingProfitBeforeLoss = round(
      result.computation.grossTradingProfit ??
      (result.computation.taxableTradingProfit + result.computation.tradingLossUsed)
    );
    // Keep tax-computation rental disclosure aligned with CT600 property-business-income presentation.
    const rentalIncomeNet = round(
      result.property.propertyBusinessIncomeForCT600 ??
      result.property.propertyProfitAfterLossOffset
    );
    const totalOtherIncome = round(
      result.computation.totalOtherIncome ??
      (
        rentalIncomeNet +
        inputs.pnl.interestIncome +
        (chargeableGains || 0) +
        inputs.pnl.dividendIncome
      )
    );

    return {
      // Starting point: accounts profit before tax
      accounting_profit_before_tax: round(result.accounts.profitBeforeTax),

      // Add-backs: non-deductible items
      add_backs: {
        depreciation_disallowed: round(depreciationExpense),
        disallowable_expenses: round(disallowableExpenditure),
        other_adjustments_add_back: round(otherTaxAdjustmentsAddBack),
        total_add_backs: round(result.computation.addBacks)
      },

      // Subtotal: profit before deductions
      subtotal_before_deductions: subtotalBeforeDeductions,

      // Deductions: capital allowances
      deductions: {
        capital_allowances_claimed: round(result.computation.capitalAllowances),
        total_deductions: round(result.computation.deductions)
      },

      // Trading income components (disposal proceeds are treated as balancing charges in trade)
      trading_income_components: {
        turnover: round(tradingTurnover),
        govt_grants: round(governmentGrants),
        asset_disposal_proceeds_balancing_charges: round(tradingBalancingCharges || 0),
        total_trading_income: totalTradingIncome
      },

      // Net trading profit before loss offset
      net_trading_profit_before_loss: netTradingProfitBeforeLoss,

      // Less: trading loss b/fwd
      trading_loss_bfwd_applied: round(result.computation.tradingLossUsed),

      // Trading profit after loss
      net_trading_profit: round(result.computation.taxableTradingProfit),

      // Classification-only reconciliation line:
      // PBT includes non-trading income streams, while net_trading_profit excludes them.
      classification_adjustments: {
        non_trading_income_excluded_from_trading_view: nonTradingIncomeClassificationAmount
      },

      // Add: non-trading income items (disposal balancing charges excluded from this bucket)
      other_income: {
        rental_income_net: rentalIncomeNet,
        interest_income: round(inputs.pnl.interestIncome),
        capital_gains: round(chargeableGains || 0),
        capital_gains_source_file: String(chargeableGainsComputationFileName || ''),
        dividend_income: round(inputs.pnl.dividendIncome),
        total_other_income: totalOtherIncome
      },

      // Final: taxable total profits (TTP)
      taxable_total_profits: round(result.computation.taxableTotalProfits)
    };
  }

  /**
   * Builds "Capital Allowances Statement" (CT600 Box 670 basis)
   */
  function buildCapitalAllowancesSchedule(inputs, result) {
    const slices = getSlices(result);
    const sliceRows = slices.map((slice) => ({
      fy_year: slice.fy_year,
      fy_years: Array.isArray(slice.fy_years) ? slice.fy_years : [slice.fy_year],
      period_index: slice.period_index || 1,
      slice_index: slice.slice_index || 1,
      ap_days_in_fy: slice.ap_days_in_fy || 0,
      aia_limit_pro_rated: Number(slice.aia_cap_for_fy || 0)
    }));

    const totalCap = Number(
      result.computation?.aiaTotalCap ??
      sliceRows.reduce((s, row) => s + row.aia_limit_pro_rated, 0)
    );
    const requested = Math.max(
      0,
      Number(
        result.computation?.aiaRequestedTotal ??
        inputs.capitalAllowances?.annualInvestmentAllowanceTotalAdditions ??
        0
      )
    );
    const claimed = Math.max(0, Number(result.computation?.capitalAllowances || 0));
    const unrelieved = Math.max(
      0,
      Number(
        result.computation?.aiaUnrelievedBroughtForwardTotal ??
        (requested - claimed)
      )
    );

    const precomputedParts = Array.isArray(result.computation?.aiaPartsByFY)
      ? result.computation.aiaPartsByFY
      : [];

    let partsByFY = [];
    if (precomputedParts.length > 0) {
      partsByFY = precomputedParts.map((row) => ({
        fy_year: Number(row.fyYear || 0),
        fy_years: Array.isArray(row.fyYears) ? row.fyYears : [Number(row.fyYear || 0)],
        period_index: Number(row.periodIndex || 1),
        slice_index: Number(row.sliceIndex || 1),
        ap_days_in_fy: Number(row.apDaysInFY || 0),
        aia_limit_pro_rated: round(row.aiaLimitProRated),
        aia_claim_requested: round(row.aiaClaimRequested),
        aia_allowance_claimed: round(row.aiaAllowanceClaimed),
        aia_unrelieved_bfwd: round(row.aiaUnrelievedBroughtForward)
      }));
    } else {
      // Fallback if engine has not precomputed AIA display rows.
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

      partsByFY = parts.map((row) => ({
        fy_year: row.fy_year,
        fy_years: row.fy_years,
        period_index: row.period_index,
        slice_index: row.slice_index || 1,
        ap_days_in_fy: row.ap_days_in_fy,
        aia_limit_pro_rated: round(row.aia_limit_pro_rated),
        aia_claim_requested: round(row.aia_claim_requested),
        aia_allowance_claimed: round(row.aia_allowance_claimed),
        aia_unrelieved_bfwd: round(row.aia_unrelieved_bfwd)
      }));
    }

    return {
      total_plant_additions: round(
        inputs.capitalAllowances.annualInvestmentAllowanceTotalAdditions
      ),
      annual_investment_allowance: {
        parts_by_fy: partsByFY,
        total_aia_cap: round(totalCap),
        total_aia_claimed: round(result.computation.capitalAllowances),
        allocation_note: String(result.computation.aiaAllocationNote || '')
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
    const byFY = getSlices(result);

    const taxByFY = byFY.map((fy) => {
      const tp = round(fy.taxableProfit || 0);
      const ap = round(fy.augmentedProfit || 0);
      const ct = round(fy.ctCharge || 0);
      const mr = round(fy.marginalRelief || 0);
      const mainRate = Number(fy.main_rate ?? 0.25);

      // Compute actual effective tax rate (CT charge / taxable profit)
      // NOTE: Store as decimal (0.19, 0.25, etc.), NOT rounded to pounds
      const effectiveRate = Number(fy.effective_tax_rate ?? (tp > 0 ? (ct / tp) : 0));
      const corporationTaxAtMainRate = round(
        fy.corporation_tax_at_main_rate ?? (tp * mainRate)
      );

      return {
        fy_year: fy.fy_year,
        fy_years: Array.isArray(fy.fy_years) ? fy.fy_years : [fy.fy_year],
        period_index: fy.period_index || 1,
        taxable_profit: tp,
        augmented_profit: ap,
        main_rate: mainRate,
        effective_tax_rate: effectiveRate,
        corporation_tax_at_main_rate: corporationTaxAtMainRate,
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
        loss_relief_note: String(
          result?.metadata?.loss_relief_note ||
          'Trading losses are applied against taxable trading profits only.'
        )
      }
    };
  }

  /**
   * Builds "Trading Loss Claim" (CT600 Section 2)
   */
  function buildTradingLossSchedule(inputs, result) {
    const tradingLossBroughtForward = inputs.losses.tradingLossBroughtForward;
    const tradingLossUsageRequested = inputs.losses.tradingLossUsageRequested;
    const requested =
      tradingLossUsageRequested == null
        ? tradingLossBroughtForward
        : Math.min(tradingLossBroughtForward, tradingLossUsageRequested);
    return {
      trading_loss_bfwd_available: round(tradingLossBroughtForward),
      trading_loss_use_requested: round(requested),
      trading_loss_bfwd_used_this_period: round(result.computation.tradingLossUsed),
      trading_loss_cfwd: round(
        result.computation.tradingLossCarriedForward ??
        (tradingLossBroughtForward - result.computation.tradingLossUsed)
      )
    };
  }

  /**
   * Main export: maps TaxEngine result -> comprehensive Tax Computation
   */
  function map(inputs, result, fyOverlaps) {
    const computation = {};

    // Filing metadata cover (non-calculation fields).
    computation.cover = {
      company_identifier: String(
        inputs.tax_computation_cover_company_identifier ||
        inputs.company_registration_number ||
        inputs.company_utr ||
        ''
      ),
      accounting_framework: String(
        inputs.tax_computation_cover_accounting_framework ||
        ''
      ),
      computation_basis_note: String(
        inputs.tax_computation_cover_computation_basis_note ||
        ''
      )
    };

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
