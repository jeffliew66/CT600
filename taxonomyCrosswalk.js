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
// inputs.pnl.interestIncome                                      | box_170_non_trading_loan_relationship_profits (clamped >=0) | profit_adjustment_schedule.other_income.interest_income
// inputs.pnl.propertyIncome                                      | -                                                        | -
// inputs.pnl.propertyLossBroughtForward                          | box_250_prop_losses_bfwd                                 | -
// inputs.pnl.chargeableGains                                     | box_210_chargeable_gains                                 | profit_adjustment_schedule.other_income.capital_gains
// inputs.pnl.chargeableGainsComputationFileName                  | -                                                        | profit_adjustment_schedule.other_income.capital_gains_source_file
// inputs.pnl.dividendIncome                                      | box_620_dividend_income                                  | profit_adjustment_schedule.other_income.dividend_income
// inputs.pnl.turnover (legacy alias)                            | box_145_trade_turnover                                   | profit_adjustment_schedule.trading_income_components.turnover
// inputs.pnl.govtGrants (legacy alias)                          | -                                                        | profit_adjustment_schedule.trading_income_components.govt_grants
// inputs.pnl.disposalGains (legacy alias)                       | _trading_balancing_charges (custom)                      | profit_adjustment_schedule.trading_income_components.asset_disposal_proceeds_balancing_charges
// inputs.pnl.rentalIncome (legacy alias)                        | -                                                        | -
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

// SECTION: CT600 ADDITIONAL INPUTS (OPTIONAL)
// inputs.ct600.communityInvestmentTaxRelief                      | box_445_community_investment_tax_relief                  | -
// inputs.ct600.doubleTaxationRelief                              | box_450_double_taxation_relief                           | -
// inputs.ct600.underlyingRateReliefClaim                         | box_455_underlying_rate_relief_claim (checkbox)          | -
// inputs.ct600.reliefCarriedBackToEarlierPeriod                  | box_460_relief_carried_back_to_earlier_period (checkbox) | -
// inputs.ct600.advanceCorporationTax                             | box_465_advance_corporation_tax                          | -
// inputs.ct600.loansToParticipatorsTax                           | box_480_tax_payable_by_a_close_company                   | -
// inputs.ct600.controlledForeignCompaniesTax                     | box_500_cfc_bank_levy_surcharge_and_rpdt (component)     | -
// inputs.ct600.bankLevyPayable                                   | box_500_cfc_bank_levy_surcharge_and_rpdt (component)     | -
// inputs.ct600.bankSurchargePayable                              | box_500_cfc_bank_levy_surcharge_and_rpdt (component)     | -
// inputs.ct600.residentialPropertyDeveloperTax                   | box_500_cfc_bank_levy_surcharge_and_rpdt (component)     | -
// inputs.ct600.eogplPayable                                      | box_501_eogpl_payable                                    | -
// inputs.ct600.eglPayable                                        | box_502_egl_payable                                      | -
// inputs.ct600.supplementaryChargePayable                        | box_505_supplementary_charge                             | -
// inputs.ct600.incomeTaxDeductedFromGrossIncome                  | box_515_income_tax_deducted_from_gross_income            | -
// inputs.ct600.coronavirusSupportPaymentOverpaymentNowDue        | box_526_coronavirus_support_payment_overpayment_now_due  | -
// inputs.ct600.restitutionTax                                    | box_527_restitution_tax                                  | -

// SECTION: DECLARATION INPUTS
// inputs.declaration.name                                        | box_975_name                                             | -
// inputs.declaration.date                                        | box_980_date                                             | -
// inputs.declaration.status                                      | box_985_status                                           | -

// SECTION: RESULT ACCOUNTS / PROPERTY
// result.accounts.totalIncome                                    | -                                                        | -
// result.accounts.totalExpenses                                  | -                                                        | -
// result.accounts.profitBeforeTax                                | -                                                        | profit_adjustment_schedule.accounting_profit_before_tax
// result.property.rentalIncome                                   | -                                                        | -
// result.property.propertyLossBF                                 | -                                                        | -
// result.property.propertyProfitAfterLossOffset                  | box_190_property_business_income (with AIA adjustment via metadata) | profit_adjustment_schedule.other_income.rental_income_net
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
// result.computation.taxableNonTradingProfits                    | -                                                        | -
// result.computation.taxableTotalProfits                         | box_315_taxable_profit                                   | profit_adjustment_schedule.taxable_total_profits
// result.computation.taxableTotalProfits                         | box_235_profits_subtotal (derived)                       | summary.taxable_total_profits
// result.computation.taxableTotalProfits                         | box_300_profits_before_deductions (derived)              | tax_calculation_table.year_summary.total_taxable_profit
// result.computation.augmentedProfits                            | -                                                        | summary.augmented_profits
// result.computation.augmentedProfits                            | -                                                        | tax_calculation_table.year_summary.total_augmented_profit

// SECTION: RESULT TAX
// result.tax.corporationTaxCharge                                | box_440_corporation_tax_chargeable (derived chain)       | summary.corporation_tax_charge
// result.tax.corporationTaxCharge                                | -                                                        | tax_calculation_table.year_summary.corporation_tax_charge
// result.tax.marginalRelief                                      | box_435_marginal_relief                                  | summary.marginal_relief_total
// result.tax.marginalRelief                                      | -                                                        | tax_calculation_table.year_summary.total_marginal_relief
// result.tax.taxPayable                                          | -                                                        | summary.tax_payable

// SECTION: RESULT BY-FY SLICES
// result.byFY[].fy_year                                          | box_330/380_financial_year                               | tax_calculation_table.computation_by_fy[].fy_year
// result.byFY[].taxableProfit                                    | box_335/350/365/385/400/415_profits_chargeable_at_corresponding_rate | tax_calculation_table.computation_by_fy[].taxable_profit
// result.byFY[].main_rate or small_rate                          | box_340/355/370/390/405/420_corresponding_rate           | tax_calculation_table.computation_by_fy[].main_rate
// result.byFY[].ctCharge (+ MR back where applicable)            | box_345/360/375/395/410/425_tax                          | tax_calculation_table.computation_by_fy[].corporation_tax_charged
// result.byFY[].marginalRelief                                   | -                                                        | tax_calculation_table.computation_by_fy[].marginal_relief_reduction
// result.byFY[].aia_cap_for_fy                                   | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_limit_pro_rated

// SECTION: CT600 DERIVED FORMULA BOXES
// <mapper constant>                                              | box_205_total_trading_and_non_trading_profits = 0       | -
// <derived: sum of tax boxes 345,360,375,395,410,425>           | box_430_corporation_tax                                  | -
// <derived: box_430 - box_435>                                   | box_440_corporation_tax_chargeable                       | -
// <derived: sum of boxes 445,450,465>                            | box_470_total_reliefs_and_deductions                     | -
// <derived: box_440 - box_470>                                   | box_475_net_ct_liability                                 | -
// <derived: sum of boxes 475,480,500,501,502,505>               | box_510_total_tax_chargeable                             | -
// <derived: max(0, box_515 - box_510)>                           | box_520_income_tax_repayable                             | -
// <derived: max(0, box_510 - box_515)>                           | box_525_self_assessment_tax_payable                      | -
// <derived: box_525 + box_526 + box_527>                         | box_528_total_self_assessment_tax_payable                | -

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

// SECTION: COMPULSORY FILING FIELDS NOT CURRENTLY MODELLED
// <required: company UTR>                                        | ct600_header.company_utr                                 | -
// <required: company name>                                       | ct600_header.company_name                                | -
// <required: company registration number>                        | ct600_header.company_registration_number                 | -
// <required: return type / period indicator>                     | ct600_header.return_type_or_period_indicator             | -
// <required: iXBRL attachments metadata>                         | ct600_attachments.accounts_and_computation_metadata      | -
// <required: computation basis note>                             | -                                                        | tax_computation.cover.computation_basis_note
// <required: accounting framework identifier>                    | -                                                        | tax_computation.cover.accounting_framework
// <required: company identifier in computation>                  | -                                                        | tax_computation.cover.company_identifier
