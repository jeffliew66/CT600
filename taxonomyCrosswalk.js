// TAXONOMY CROSSWALK (HUMAN-READABLE)
// Format:
// internal variable                                              | CT600 mapping                                           | Tax computation mapping
// Rules applied:
// - Every model variable is listed.
// - If no direct mapping exists, the mapping column shows "-".
// - Compulsory filing items that are not modelled are included as "<required: ...>" rows.

// SECTION: INPUTS (CANONICAL + LEGACY ALIASES)
// inputs.accountingPeriodStart                                   | box_30_period_start                                      | -
// inputs.accountingPeriodEnd                                     | box_35_period_end                                        | -
// inputs.accountingPeriodDays                                    | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].ap_days_in_fy
// inputs.associatedCompanyCount                                  | box_326_assoc_companies                                  | -
// inputs.associatedCompanyCount                                  | box_327_assoc_companies                                  | -
// inputs.associatedCompanyCount                                  | box_328_assoc_companies                                  | -
// inputs.apStart (legacy alias)                                 | box_30_period_start                                      | -
// inputs.apEnd (legacy alias)                                   | box_35_period_end                                        | -
// inputs.apDays (legacy alias)                                  | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].ap_days_in_fy
// inputs.assocCompanies (legacy alias)                          | box_326/327/328_assoc_companies                          | -

// SECTION: INPUT P&L (INCOME)
// inputs.pnl.tradingTurnover                                     | box_145_trade_turnover                                   | profit_adjustment_schedule.trading_income_components.turnover
// inputs.pnl.governmentGrants                                    | -                                                        | profit_adjustment_schedule.trading_income_components.govt_grants
// inputs.pnl.tradingBalancingCharges                             | _trading_balancing_charges (custom)                      | profit_adjustment_schedule.trading_income_components.asset_disposal_proceeds_balancing_charges
// inputs.pnl.interestIncome                                      | box_170_interest_income                                  | profit_adjustment_schedule.other_income.interest_income
// inputs.pnl.propertyIncome                                      | box_190_rental_income                                    | -
// inputs.pnl.propertyLossBroughtForward                          | box_250_prop_losses_bfwd                                 | -
// inputs.pnl.chargeableGains                                     | box_210_chargeable_gains                                 | profit_adjustment_schedule.other_income.capital_gains
// inputs.pnl.chargeableGainsComputationFileName                  | -                                                        | profit_adjustment_schedule.other_income.capital_gains_source_file
// inputs.pnl.dividendIncome                                      | box_620_dividend_income                                  | profit_adjustment_schedule.other_income.dividend_income
// inputs.pnl.turnover (legacy alias)                            | box_145_trade_turnover                                   | profit_adjustment_schedule.trading_income_components.turnover
// inputs.pnl.govtGrants (legacy alias)                          | -                                                        | profit_adjustment_schedule.trading_income_components.govt_grants
// inputs.pnl.disposalGains (legacy alias)                       | _trading_balancing_charges (custom)                      | profit_adjustment_schedule.trading_income_components.asset_disposal_proceeds_balancing_charges
// inputs.pnl.rentalIncome (legacy alias)                        | box_190_rental_income                                    | -
// inputs.pnl.propertyLossBF (legacy alias)                      | box_250_prop_losses_bfwd                                 | -
// inputs.pnl.capitalGains (legacy alias)                        | box_210_chargeable_gains                                 | profit_adjustment_schedule.other_income.capital_gains
// inputs.pnl.capitalGainsFileName (legacy alias)                | -                                                        | profit_adjustment_schedule.other_income.capital_gains_source_file

// SECTION: INPUT P&L (EXPENSES / ADJUSTMENTS)
// inputs.pnl.costOfGoodsSold                                     | -                                                        | -
// inputs.pnl.staffEmploymentCosts                                | -                                                        | -
// inputs.pnl.depreciationExpense                                 | -                                                        | profit_adjustment_schedule.add_backs.depreciation_disallowed
// inputs.pnl.otherOperatingCharges                               | -                                                        | -
// inputs.pnl.costOfSales (legacy alias)                         | -                                                        | -
// inputs.pnl.staffCosts (legacy alias)                          | -                                                        | -
// inputs.pnl.depreciation (legacy alias)                        | -                                                        | profit_adjustment_schedule.add_backs.depreciation_disallowed
// inputs.pnl.otherCharges (legacy alias)                        | -                                                        | -
// inputs.adjustments.disallowableExpenditure                     | -                                                        | profit_adjustment_schedule.add_backs.disallowable_expenses
// inputs.adjustments.otherTaxAdjustmentsAddBack                  | -                                                        | profit_adjustment_schedule.add_backs.other_adjustments_add_back
// inputs.adjustments.disallowableExpenses (legacy alias)        | -                                                        | profit_adjustment_schedule.add_backs.disallowable_expenses
// inputs.adjustments.otherAdjustments (legacy alias)            | -                                                        | profit_adjustment_schedule.add_backs.other_adjustments_add_back

// SECTION: INPUT CAPITAL ALLOWANCES + LOSSES
// inputs.capitalAllowances.annualInvestmentAllowanceTradeAdditions      | -                                                 | -
// inputs.capitalAllowances.annualInvestmentAllowanceNonTradeAdditions   | -                                                 | -
// inputs.capitalAllowances.annualInvestmentAllowanceTotalAdditions      | -                                                 | capital_allowances_schedule.total_plant_additions
// inputs.capitalAllowances.aiaTradeAdditions (legacy alias)             | -                                                 | -
// inputs.capitalAllowances.aiaNonTradeAdditions (legacy alias)          | -                                                 | -
// inputs.capitalAllowances.aiaAdditions (legacy alias)                  | -                                                 | capital_allowances_schedule.total_plant_additions
// inputs.losses.tradingLossBroughtForward                        | -                                                        | trading_loss_schedule.trading_loss_bfwd_available
// inputs.losses.tradingLossUsageRequested                         | -                                                        | trading_loss_schedule.trading_loss_use_requested
// inputs.losses.tradingLossBF (legacy alias)                     | -                                                        | trading_loss_schedule.trading_loss_bfwd_available
// inputs.losses.tradingLossUseRequested (legacy alias)          | -                                                        | trading_loss_schedule.trading_loss_use_requested

// SECTION: RESULT ACCOUNTS / PROPERTY
// result.accounts.totalIncome                                    | -                                                        | -
// result.accounts.totalExpenses                                  | -                                                        | -
// result.accounts.profitBeforeTax                                | -                                                        | profit_adjustment_schedule.accounting_profit_before_tax
// result.property.rentalIncome                                   | -                                                        | -
// result.property.propertyLossBF                                 | -                                                        | -
// result.property.propertyProfitAfterLossOffset                  | -                                                        | profit_adjustment_schedule.other_income.rental_income_net
// result.property.propertyLossCF                                 | box_250_prop_losses_cfwd                                 | -

// SECTION: RESULT COMPUTATION
// result.computation.addBacks                                    | -                                                        | profit_adjustment_schedule.add_backs.total_add_backs
// result.computation.deductions                                  | -                                                        | profit_adjustment_schedule.deductions.total_deductions
// result.computation.capitalAllowances                           | -                                                        | profit_adjustment_schedule.deductions.capital_allowances_claimed
// result.computation.capitalAllowances                           | -                                                        | capital_allowances_schedule.total_capital_allowances
// result.computation.tradingLossUsed                             | -                                                        | profit_adjustment_schedule.trading_loss_bfwd_applied
// result.computation.tradingLossUsed                             | -                                                        | trading_loss_schedule.trading_loss_bfwd_used_this_period
// result.computation.tradingLossUsed                             | box_160_trading_losses_bfwd                              | -
// <derived: result.computation.taxableTradingProfit + result.computation.tradingLossUsed> | box_155_trading_profit                 | -
// result.computation.taxableTradingProfit                        | box_165_net_trading_profits                              | profit_adjustment_schedule.net_trading_profit
// result.computation.taxableNonTradingProfits                    | (derived inside box_235_profits_subtotal)                | -
// result.computation.taxableTotalProfits                         | box_315_taxable_profit                                   | profit_adjustment_schedule.taxable_total_profits
// result.computation.taxableTotalProfits                         | box_235_profits_subtotal (derived)                       | summary.taxable_total_profits
// result.computation.taxableTotalProfits                         | box_300_profits_before_deductions (derived)              | tax_calculation_table.year_summary.total_taxable_profit
// result.computation.augmentedProfits                            | box_330_augmented_profit                                 | summary.augmented_profits
// result.computation.augmentedProfits                            | -                                                        | tax_calculation_table.year_summary.total_augmented_profit

// SECTION: RESULT TAX
// result.tax.corporationTaxCharge                                | box_455_total_ct_calculated                              | summary.corporation_tax_charge
// result.tax.corporationTaxCharge                                | -                                                        | tax_calculation_table.year_summary.corporation_tax_charge
// result.tax.marginalRelief                                      | _marginal_relief_total (custom)                          | summary.marginal_relief_total
// result.tax.marginalRelief                                      | -                                                        | tax_calculation_table.year_summary.total_marginal_relief
// result.tax.taxPayable                                          | box_475_net_ct_liability                                 | summary.tax_payable

// SECTION: RESULT BY-FY SLICES
// result.byFY[].fy_year                                          | -                                                        | tax_calculation_table.computation_by_fy[].fy_year
// result.byFY[].fy_years                                         | -                                                        | tax_calculation_table.computation_by_fy[].fy_years
// result.byFY[].period_index                                     | -                                                        | tax_calculation_table.computation_by_fy[].period_index
// result.byFY[].taxableProfit                                    | -                                                        | tax_calculation_table.computation_by_fy[].taxable_profit
// result.byFY[].augmentedProfit                                  | -                                                        | tax_calculation_table.computation_by_fy[].augmented_profit
// result.byFY[].main_rate                                        | -                                                        | tax_calculation_table.computation_by_fy[].main_rate
// result.byFY[].ctCharge                                         | -                                                        | tax_calculation_table.computation_by_fy[].corporation_tax_charged
// result.byFY[].marginalRelief                                   | -                                                        | tax_calculation_table.computation_by_fy[].marginal_relief_reduction
// result.byFY[].aia_cap_for_fy                                   | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_limit_pro_rated

// SECTION: DERIVED TAX COMPUTATION TAGS (NO SINGLE INTERNAL FIELD)
// <derived: AIA requested by slice allocation>                   | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_claim_requested
// <derived: AIA claimed by slice allocation>                     | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_allowance_claimed
// <derived: AIA unrelieved by slice allocation>                  | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_unrelieved_bfwd
// <derived: total AIA cap from all slices>                       | -                                                        | capital_allowances_schedule.annual_investment_allowance.total_aia_cap
// <derived: total AIA claimed>                                   | -                                                        | capital_allowances_schedule.annual_investment_allowance.total_aia_claimed
// <static note>                                                  | -                                                        | capital_allowances_schedule.annual_investment_allowance.allocation_note
// <derived: loss carry forward>                                  | -                                                        | trading_loss_schedule.trading_loss_cfwd
// <derived: trading before loss>                                 | -                                                        | profit_adjustment_schedule.net_trading_profit_before_loss
// <derived: total trading income components>                     | -                                                        | profit_adjustment_schedule.trading_income_components.total_trading_income
// <derived: total other income components>                       | -                                                        | profit_adjustment_schedule.other_income.total_other_income
// <derived: classification-only non-trading income exclusion>    | -                                                        | profit_adjustment_schedule.classification_adjustments.non_trading_income_excluded_from_trading_view
// <derived: subtotal before deductions>                          | -                                                        | profit_adjustment_schedule.subtotal_before_deductions
// <derived: effective rate (ct / taxable)>                       | -                                                        | tax_calculation_table.computation_by_fy[].effective_tax_rate
// <derived: tax at main rate (taxable x main_rate)>              | -                                                        | tax_calculation_table.computation_by_fy[].corporation_tax_at_main_rate
// <static note>                                                  | -                                                        | tax_calculation_table.year_summary.loss_relief_note

// SECTION: CT600 CONSTANT / POLICY VALUES
// <mapper policy>                                                | box_205_disposal_gains = 0                               | -
// <mapper constant>                                              | box_305_donations = 0                                    | -
// <mapper constant>                                              | box_310_group_relief = 0                                 | -
// <mapper constant>                                              | box_312_other_deductions = 0                             | -

// SECTION: COMPULSORY FILING FIELDS NOT CURRENTLY MODELLED
// <required: company UTR>                                        | ct600_header.company_utr                                  | -
// <required: company name>                                       | ct600_header.company_name                                 | -
// <required: company registration number>                        | ct600_header.company_registration_number                  | -
// <required: return type / period indicator>                     | ct600_header.return_type_or_period_indicator              | -
// <required: declaration / authorised signatory>                 | ct600_declaration.authorised_signatory                    | -
// <required: iXBRL attachments metadata>                         | ct600_attachments.accounts_and_computation_metadata       | -
// <required: computation basis note>                             | -                                                        | tax_computation.cover.computation_basis_note
// <required: accounting framework identifier>                    | -                                                        | tax_computation.cover.accounting_framework
// <required: company identifier in computation>                  | -                                                        | tax_computation.cover.company_identifier
