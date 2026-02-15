#!/usr/bin/env node
'use strict';

/**
 * taxonomyCrosswalk.js
 * Prints a crosswalk:
 *   Internal variable name | CT600 taxonomy | Tax computation taxonomy
 *
 * Scope:
 * - Covers current internal model fields used by the app
 * - Lists all CT600 mapper tags currently emitted
 * - Lists all tax computation mapper tags currently emitted
 */

const rows = [
  { internal: 'inputs.apStart', ct600: 'box_30_period_start', taxComp: '-' },
  { internal: 'inputs.apEnd', ct600: 'box_35_period_end', taxComp: '-' },
  { internal: 'inputs.apDays', ct600: '-', taxComp: 'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].ap_days_in_fy' },
  { internal: 'inputs.assocCompanies', ct600: 'box_326_assoc_companies, box_327_assoc_companies, box_328_assoc_companies', taxComp: '-' },

  { internal: 'inputs.pnl.turnover', ct600: 'box_145_trade_turnover', taxComp: 'profit_adjustment_schedule.trading_income_components.turnover' },
  { internal: 'inputs.pnl.govtGrants', ct600: '-', taxComp: 'profit_adjustment_schedule.trading_income_components.govt_grants' },
  { internal: 'inputs.pnl.disposalGains', ct600: '_trading_balancing_charges (custom)', taxComp: 'profit_adjustment_schedule.trading_income_components.asset_disposal_proceeds_balancing_charges' },
  { internal: 'inputs.pnl.interestIncome', ct600: 'box_170_interest_income', taxComp: 'profit_adjustment_schedule.other_income.interest_income' },
  { internal: 'inputs.pnl.rentalIncome', ct600: 'box_190_rental_income', taxComp: '-' },
  { internal: 'inputs.pnl.propertyLossBF', ct600: 'box_250_prop_losses_bfwd', taxComp: '-' },
  { internal: 'inputs.pnl.capitalGains', ct600: 'box_210_chargeable_gains', taxComp: 'profit_adjustment_schedule.other_income.capital_gains' },
  { internal: 'inputs.pnl.capitalGainsFileName', ct600: '-', taxComp: 'profit_adjustment_schedule.other_income.capital_gains_source_file' },
  { internal: 'inputs.pnl.dividendIncome', ct600: 'box_620_dividend_income', taxComp: 'profit_adjustment_schedule.other_income.dividend_income' },
  { internal: 'inputs.pnl.costOfSales', ct600: '-', taxComp: '-' },
  { internal: 'inputs.pnl.staffCosts', ct600: '-', taxComp: '-' },
  { internal: 'inputs.pnl.depreciation', ct600: '-', taxComp: 'profit_adjustment_schedule.add_backs.depreciation_disallowed' },
  { internal: 'inputs.pnl.otherCharges', ct600: '-', taxComp: '-' },

  { internal: 'inputs.adjustments.disallowableExpenses', ct600: '-', taxComp: 'profit_adjustment_schedule.add_backs.disallowable_expenses' },
  { internal: 'inputs.adjustments.otherAdjustments', ct600: '-', taxComp: 'profit_adjustment_schedule.add_backs.other_adjustments_add_back' },

  { internal: 'inputs.capitalAllowances.aiaTradeAdditions', ct600: '-', taxComp: '-' },
  { internal: 'inputs.capitalAllowances.aiaNonTradeAdditions', ct600: '-', taxComp: '-' },
  { internal: 'inputs.capitalAllowances.aiaAdditions', ct600: '-', taxComp: 'capital_allowances_schedule.total_plant_additions' },

  { internal: 'inputs.losses.tradingLossBF', ct600: 'box_160_trading_losses_bfwd', taxComp: 'trading_loss_schedule.trading_loss_bfwd_available' },
  { internal: 'inputs.losses.tradingLossUseRequested', ct600: '-', taxComp: 'trading_loss_schedule.trading_loss_use_requested' },

  { internal: 'result.accounts.totalIncome', ct600: '-', taxComp: '-' },
  { internal: 'result.accounts.totalExpenses', ct600: '-', taxComp: '-' },
  { internal: 'result.accounts.profitBeforeTax', ct600: 'box_155_trading_profit', taxComp: 'profit_adjustment_schedule.accounting_profit_before_tax' },

  { internal: 'result.property.rentalIncome', ct600: '-', taxComp: '-' },
  { internal: 'result.property.propertyLossBF', ct600: '-', taxComp: '-' },
  { internal: 'result.property.propertyProfitAfterLossOffset', ct600: '-', taxComp: 'profit_adjustment_schedule.other_income.rental_income_net' },
  { internal: 'result.property.propertyLossCF', ct600: 'box_250_prop_losses_cfwd', taxComp: '-' },

  { internal: 'result.computation.addBacks', ct600: '-', taxComp: 'profit_adjustment_schedule.add_backs.total_add_backs' },
  { internal: 'result.computation.deductions', ct600: '-', taxComp: 'profit_adjustment_schedule.deductions.total_deductions' },
  { internal: 'result.computation.capitalAllowances', ct600: '-', taxComp: 'profit_adjustment_schedule.deductions.capital_allowances_claimed, capital_allowances_schedule.total_capital_allowances' },
  { internal: 'result.computation.tradingLossUsed', ct600: '-', taxComp: 'profit_adjustment_schedule.trading_loss_bfwd_applied, trading_loss_schedule.trading_loss_bfwd_used_this_period' },
  { internal: 'result.computation.taxableTradingProfit', ct600: 'box_165_net_trading_profits', taxComp: 'profit_adjustment_schedule.net_trading_profit' },
  { internal: 'result.computation.taxableNonTradingProfits', ct600: '(derived in box_235_profits_subtotal)', taxComp: '-' },
  { internal: 'result.computation.taxableTotalProfits', ct600: 'box_315_taxable_profit', taxComp: 'profit_adjustment_schedule.taxable_total_profits, summary.taxable_total_profits' },
  { internal: 'result.computation.augmentedProfits', ct600: 'box_330_augmented_profit', taxComp: 'summary.augmented_profits' },

  { internal: 'result.tax.corporationTaxCharge', ct600: 'box_455_total_ct_calculated', taxComp: 'summary.corporation_tax_charge, tax_calculation_table.year_summary.corporation_tax_charge' },
  { internal: 'result.tax.marginalRelief', ct600: '_marginal_relief_total (custom)', taxComp: 'summary.marginal_relief_total, tax_calculation_table.year_summary.total_marginal_relief' },
  { internal: 'result.tax.taxPayable', ct600: 'box_475_net_ct_liability', taxComp: 'summary.tax_payable' },

  { internal: 'result.byFY[].fy_year', ct600: '-', taxComp: 'tax_calculation_table.computation_by_fy[].fy_year' },
  { internal: 'result.byFY[].fy_years', ct600: '-', taxComp: 'tax_calculation_table.computation_by_fy[].fy_years' },
  { internal: 'result.byFY[].period_index', ct600: '-', taxComp: 'tax_calculation_table.computation_by_fy[].period_index' },
  { internal: 'result.byFY[].taxableProfit', ct600: '-', taxComp: 'tax_calculation_table.computation_by_fy[].taxable_profit' },
  { internal: 'result.byFY[].augmentedProfit', ct600: '-', taxComp: 'tax_calculation_table.computation_by_fy[].augmented_profit' },
  { internal: 'result.byFY[].main_rate', ct600: '-', taxComp: 'tax_calculation_table.computation_by_fy[].main_rate' },
  { internal: 'result.byFY[].ctCharge', ct600: '-', taxComp: 'tax_calculation_table.computation_by_fy[].corporation_tax_charged' },
  { internal: 'result.byFY[].marginalRelief', ct600: '-', taxComp: 'tax_calculation_table.computation_by_fy[].marginal_relief_reduction' },
  { internal: 'result.byFY[].aia_cap_for_fy', ct600: '-', taxComp: 'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_limit_pro_rated' },

  { internal: '<derived>', ct600: 'box_205_disposal_gains = 0 (by mapper policy)', taxComp: '-' },
  { internal: '<derived>', ct600: 'box_235_profits_subtotal, box_300_profits_before_deductions', taxComp: '-' },
  { internal: '<derived>', ct600: 'box_305_donations = 0, box_310_group_relief = 0, box_312_other_deductions = 0', taxComp: '-' }
];

const ct600Tags = [
  'box_30_period_start',
  'box_35_period_end',
  'box_145_trade_turnover',
  'box_155_trading_profit',
  'box_160_trading_losses_bfwd',
  'box_165_net_trading_profits',
  'box_170_interest_income',
  'box_190_rental_income',
  'box_205_disposal_gains',
  'box_210_chargeable_gains',
  'box_235_profits_subtotal',
  'box_250_prop_losses_bfwd',
  'box_250_prop_losses_cfwd',
  'box_300_profits_before_deductions',
  'box_305_donations',
  'box_310_group_relief',
  'box_312_other_deductions',
  'box_315_taxable_profit',
  'box_326_assoc_companies',
  'box_327_assoc_companies',
  'box_328_assoc_companies',
  'box_330_augmented_profit',
  'box_455_total_ct_calculated',
  'box_475_net_ct_liability',
  'box_620_dividend_income',
  '_marginal_relief_total',
  '_trading_balancing_charges'
];

const taxCompTags = [
  'profit_adjustment_schedule.accounting_profit_before_tax',
  'profit_adjustment_schedule.add_backs.depreciation_disallowed',
  'profit_adjustment_schedule.add_backs.disallowable_expenses',
  'profit_adjustment_schedule.add_backs.other_adjustments_add_back',
  'profit_adjustment_schedule.add_backs.total_add_backs',
  'profit_adjustment_schedule.subtotal_before_deductions',
  'profit_adjustment_schedule.deductions.capital_allowances_claimed',
  'profit_adjustment_schedule.deductions.total_deductions',
  'profit_adjustment_schedule.trading_income_components.turnover',
  'profit_adjustment_schedule.trading_income_components.govt_grants',
  'profit_adjustment_schedule.trading_income_components.asset_disposal_proceeds_balancing_charges',
  'profit_adjustment_schedule.trading_income_components.total_trading_income',
  'profit_adjustment_schedule.net_trading_profit_before_loss',
  'profit_adjustment_schedule.trading_loss_bfwd_applied',
  'profit_adjustment_schedule.net_trading_profit',
  'profit_adjustment_schedule.other_income.rental_income_net',
  'profit_adjustment_schedule.other_income.interest_income',
  'profit_adjustment_schedule.other_income.capital_gains',
  'profit_adjustment_schedule.other_income.capital_gains_source_file',
  'profit_adjustment_schedule.other_income.dividend_income',
  'profit_adjustment_schedule.other_income.total_other_income',
  'profit_adjustment_schedule.taxable_total_profits',
  'capital_allowances_schedule.total_plant_additions',
  'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].fy_year',
  'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].fy_years',
  'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].period_index',
  'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].ap_days_in_fy',
  'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_limit_pro_rated',
  'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_claim_requested',
  'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_allowance_claimed',
  'capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_unrelieved_bfwd',
  'capital_allowances_schedule.annual_investment_allowance.total_aia_cap',
  'capital_allowances_schedule.annual_investment_allowance.total_aia_claimed',
  'capital_allowances_schedule.annual_investment_allowance.allocation_note',
  'capital_allowances_schedule.total_capital_allowances',
  'trading_loss_schedule.trading_loss_bfwd_available',
  'trading_loss_schedule.trading_loss_use_requested',
  'trading_loss_schedule.trading_loss_bfwd_used_this_period',
  'trading_loss_schedule.trading_loss_cfwd',
  'tax_calculation_table.computation_by_fy[].fy_year',
  'tax_calculation_table.computation_by_fy[].fy_years',
  'tax_calculation_table.computation_by_fy[].period_index',
  'tax_calculation_table.computation_by_fy[].taxable_profit',
  'tax_calculation_table.computation_by_fy[].augmented_profit',
  'tax_calculation_table.computation_by_fy[].main_rate',
  'tax_calculation_table.computation_by_fy[].effective_tax_rate',
  'tax_calculation_table.computation_by_fy[].corporation_tax_at_main_rate',
  'tax_calculation_table.computation_by_fy[].marginal_relief_reduction',
  'tax_calculation_table.computation_by_fy[].corporation_tax_charged',
  'tax_calculation_table.year_summary.total_taxable_profit',
  'tax_calculation_table.year_summary.total_augmented_profit',
  'tax_calculation_table.year_summary.total_marginal_relief',
  'tax_calculation_table.year_summary.corporation_tax_charge',
  'tax_calculation_table.year_summary.loss_relief_note',
  'summary.taxable_total_profits',
  'summary.augmented_profits',
  'summary.corporation_tax_charge',
  'summary.marginal_relief_total',
  'summary.tax_payable'
];

function printHeader(title) {
  console.log('\n' + title);
  console.log('-'.repeat(title.length));
}

function printTable(items) {
  console.log('| Internal Variable | CT600 Taxonomy | Tax Computation Taxonomy |');
  console.log('|---|---|---|');
  items.forEach((r) => {
    console.log(`| ${r.internal} | ${r.ct600} | ${r.taxComp} |`);
  });
}

printHeader('Internal Variable -> CT600 / Tax Computation Crosswalk');
printTable(rows);

printHeader('CT600 Tags Emitted By Mapper');
ct600Tags.forEach((tag) => console.log(`- ${tag}`));

printHeader('Tax Computation Tags Emitted By Mapper');
taxCompTags.forEach((tag) => console.log(`- ${tag}`));

