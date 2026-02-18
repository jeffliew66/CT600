// TAXONOMY CROSSWALK (HUMAN-READABLE)
// Format:
// internal variable                                              | CT600 mapping                                           | Tax computation mapping
// Notes:
// - Canonical variable names only (legacy aliases intentionally omitted).
// - If there is no direct mapping, mapping column is '-'.
// - Where no internal variable exists for a required filing item, first column is left blank.

// SECTION: INPUTS (CANONICAL)
// inputs.accountingPeriodStart                                   | box_30_period_start                                      | -
// inputs.accountingPeriodEnd                                     | box_35_period_end                                        | -
// inputs.accountingPeriodDays                                    | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].ap_days_in_fy
// inputs.associatedCompanyCount                                  | box_326_assoc_companies (FY1 if applicable)              | -
// inputs.associatedCompanyCount                                  | box_327_assoc_companies (FY2 if applicable)              | -
// inputs.associatedCompanyCount                                  | box_328_assoc_companies (FY3 if applicable)              | -

// SECTION: INPUT P&L (INCOME)
// inputs.pnl.tradingTurnover                                     | box_145_trade_turnover                                   | profit_adjustment_schedule.trading_income_components.turnover
// inputs.pnl.tradingTurnover                                     | box_155_trading_profit (component)                       | -
// inputs.pnl.governmentGrants                                    | box_155_trading_profit (component; not box_145)          | profit_adjustment_schedule.trading_income_components.govt_grants
// inputs.pnl.tradingBalancingCharges                             | box_155_trading_profit (component; not box_145 turnover) | profit_adjustment_schedule.trading_income_components.asset_disposal_proceeds_balancing_charges
// inputs.pnl.tradingBalancingCharges                             | _trading_balancing_charges (custom transparency)         | -
// inputs.pnl.interestIncome                                      | box_170_non_trading_loan_relationship_profits (disclosure heading; not net taxable-interest) | profit_adjustment_schedule.other_income.interest_income
// inputs.pnl.propertyIncome                                      | -                                                        | -
// inputs.pnl.propertyLossBroughtForward                          | _property_losses_bfwd (custom transparency)              | -
// inputs.pnl.chargeableGains                                     | box_210_chargeable_gains                                 | profit_adjustment_schedule.other_income.capital_gains
// inputs.pnl.chargeableGainsComputationFileName                  | -                                                        | profit_adjustment_schedule.other_income.capital_gains_source_file
// inputs.pnl.dividendIncome                                      | box_620_franked_investment_income_exempt_abgh            | profit_adjustment_schedule.other_income.dividend_income

// SECTION: INPUT P&L (EXPENSES / ADJUSTMENTS)
// inputs.pnl.costOfGoodsSold                                     | -                                                        | profit_adjustment_schedule.accounting_profit_before_tax (component only; not separately tagged)
// inputs.pnl.staffEmploymentCosts                                | -                                                        | profit_adjustment_schedule.accounting_profit_before_tax (component only; not separately tagged)
// inputs.pnl.depreciationExpense                                 | -                                                        | profit_adjustment_schedule.add_backs.depreciation_disallowed
// inputs.pnl.otherOperatingCharges                               | -                                                        | profit_adjustment_schedule.accounting_profit_before_tax (component only; not separately tagged)
// inputs.adjustments.disallowableExpenditure                     | -                                                        | profit_adjustment_schedule.add_backs.disallowable_expenses
// inputs.adjustments.otherTaxAdjustmentsAddBack                  | -                                                        | profit_adjustment_schedule.add_backs.other_adjustments_add_back

// SECTION: INPUT CAPITAL ALLOWANCES + LOSSES
// inputs.capitalAllowances.annualInvestmentAllowanceTradeAdditions      | -                                                 | capital_allowances_schedule.total_plant_additions (component only)
// inputs.capitalAllowances.annualInvestmentAllowanceNonTradeAdditions   | -                                                 | capital_allowances_schedule.total_plant_additions (component only)
// inputs.capitalAllowances.annualInvestmentAllowanceTotalAdditions      | -                                                 | capital_allowances_schedule.total_plant_additions
// inputs.losses.tradingLossBroughtForward                        | -                                                        | trading_loss_schedule.trading_loss_bfwd_available
// inputs.losses.tradingLossUsageRequested                        | -                                                        | trading_loss_schedule.trading_loss_use_requested
// inputs.losses.tradingLossBroughtForward                        | _trading_losses_bfwd (custom transparency)               | -
// inputs.losses.propertyLossUsageRequested                       | box_250_property_business_losses_used (used amount after engine caps; claimed against total profits) | -

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
// result.property.propertyLossUsed                               | box_250_property_business_losses_used                    | -
// result.property.propertyLossAvailable                          | _property_losses_available (custom transparency)         | -
// result.property.propertyProfitAfterLossOffset                  | box_190_property_business_income (property-stream disclosure; AIA-adjusted source is result.property.propertyBusinessIncomeForCT600) | profit_adjustment_schedule.other_income.rental_income_net
// result.property.propertyLossCF                                 | _property_losses_cfwd (custom transparency; not CT600 Box 250) | -

// SECTION: RESULT COMPUTATION
// result.computation.addBacks                                    | -                                                        | profit_adjustment_schedule.add_backs.total_add_backs
// result.computation.deductions                                  | -                                                        | profit_adjustment_schedule.deductions.total_deductions
// result.computation.capitalAllowances                           | -                                                        | profit_adjustment_schedule.deductions.capital_allowances_claimed
// result.computation.capitalAllowances                           | -                                                        | capital_allowances_schedule.total_capital_allowances
// result.computation.capitalAllowances                           | -                                                        | capital_allowances_schedule.annual_investment_allowance.total_aia_claimed
// result.computation.totalTradingIncome                          | -                                                        | profit_adjustment_schedule.trading_income_components.total_trading_income
// result.computation.grossTradingProfit                          | box_155_trading_profit                                   | profit_adjustment_schedule.net_trading_profit_before_loss
// result.computation.tradingLossUsed                             | box_160_trading_losses_bfwd_used (preferred; alias: box_160_trading_losses_bfwd) | profit_adjustment_schedule.trading_loss_bfwd_applied
// result.computation.tradingLossUsed                             | -                                                        | trading_loss_schedule.trading_loss_bfwd_used_this_period
// result.computation.tradingLossAvailable                        | _trading_losses_available (custom transparency)          | -
// result.computation.taxableTradingProfit                        | box_165_net_trading_profits                              | profit_adjustment_schedule.net_trading_profit
// result.computation.taxableNonTradingProfits                    | box_235_profits_subtotal (component)                     | -
// result.computation.profitsSubtotal                             | box_235_profits_subtotal                                 | -
// result.computation.profitsSubtotal                             | box_300_profits_before_deductions                        | -
// result.computation.miscellaneousIncomeNotElsewhere             | box_205_income_not_elsewhere                             | -
// result.computation.subtotalBeforeDeductions                    | -                                                        | profit_adjustment_schedule.subtotal_before_deductions
// result.computation.nonTradingIncomeExcludedFromTradingView     | -                                                        | profit_adjustment_schedule.classification_adjustments.non_trading_income_excluded_from_trading_view
// result.computation.totalOtherIncome                            | -                                                        | profit_adjustment_schedule.other_income.total_other_income
// result.computation.taxableTotalProfits                         | box_315_taxable_profit                                   | profit_adjustment_schedule.taxable_total_profits
// result.computation.taxableTotalProfits                         | -                                                        | summary.taxable_total_profits
// result.computation.taxableTotalProfits                         | -                                                        | tax_calculation_table.year_summary.total_taxable_profit
// result.computation.tradingLossCarriedForward                   | -                                                        | trading_loss_schedule.trading_loss_cfwd
// result.computation.augmentedProfits                            | -                                                        | summary.augmented_profits
// result.computation.augmentedProfits                            | -                                                        | tax_calculation_table.year_summary.total_augmented_profit

// SECTION: RESULT TAX
// result.tax.smallProfitsRateOrMarginalReliefEntitlement         | box_329_small_profits_rate_or_marginal_relief_entitlement | -
// result.tax.corporationTaxTableTotal                            | box_430_corporation_tax                                  | -
// result.tax.corporationTaxCharge                                | -                                                        | summary.corporation_tax_charge
// result.tax.corporationTaxCharge                                | -                                                        | tax_calculation_table.year_summary.corporation_tax_charge
// result.tax.marginalRelief                                      | box_435_marginal_relief                                  | summary.marginal_relief_total
// result.tax.marginalRelief                                      | -                                                        | tax_calculation_table.year_summary.total_marginal_relief
// result.tax.corporationTaxChargeable                            | box_440_corporation_tax_chargeable                       | -
// result.tax.totalReliefsAndDeductions                           | box_470_total_reliefs_and_deductions                     | -
// result.tax.totalBox500Charges                                  | box_500_cfc_bank_levy_surcharge_and_rpdt                 | -
// result.tax.netCTLiability                                      | box_475_net_ct_liability                                 | -
// result.tax.totalTaxChargeable                                  | box_510_total_tax_chargeable                             | -
// result.tax.incomeTaxRepayable                                  | box_520_income_tax_repayable                             | -
// result.tax.selfAssessmentTaxPayable                            | box_525_self_assessment_tax_payable                      | -
// result.tax.totalSelfAssessmentTaxPayable                       | box_528_total_self_assessment_tax_payable                | -
// result.tax.taxPayable                                          | -                                                        | summary.tax_payable

// SECTION: RESULT BY-FY SLICES
// result.byFY[].fy_year                                          | box_330/380_financial_year                               | tax_calculation_table.computation_by_fy[].fy_year
// result.byFY[].taxableProfit                                    | box_335/350/365/385/400/415_profits_chargeable_at_corresponding_rate | tax_calculation_table.computation_by_fy[].taxable_profit
// result.byFY[].main_rate                                        | box_340/355/370/390/405/420_corresponding_rate (main-rate rows) | tax_calculation_table.computation_by_fy[].main_rate
// result.byFY[].small_rate                                       | box_340/355/370/390/405/420_corresponding_rate (small-rate rows) | -
// result.byFY[].ctCharge                                         | box_345/360/375/395/410/425_tax (before MR add-back where applicable) | tax_calculation_table.computation_by_fy[].corporation_tax_charged
// result.byFY[].marginalRelief                                   | box_435_marginal_relief (aggregated)                     | tax_calculation_table.computation_by_fy[].marginal_relief_reduction
// result.byFY[].effective_tax_rate                               | -                                                        | tax_calculation_table.computation_by_fy[].effective_tax_rate
// result.byFY[].corporation_tax_at_main_rate                     | -                                                        | tax_calculation_table.computation_by_fy[].corporation_tax_at_main_rate
// result.byFY[].aia_cap_for_fy                                   | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_limit_pro_rated

// SECTION: TAX COMP TAGS (SUPPORTING / METADATA)
// result.computation.aiaPartsByFY[].aiaClaimRequested            | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_claim_requested
// result.computation.aiaPartsByFY[].aiaAllowanceClaimed          | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_allowance_claimed
// result.computation.aiaPartsByFY[].aiaUnrelievedBroughtForward  | -                                                        | capital_allowances_schedule.annual_investment_allowance.parts_by_fy[].aia_unrelieved_bfwd
// result.computation.aiaTotalCap                                 | -                                                        | capital_allowances_schedule.annual_investment_allowance.total_aia_cap
// result.computation.aiaAllocationNote                            | -                                                        | capital_allowances_schedule.annual_investment_allowance.allocation_note
// result.metadata.loss_relief_note                            | -                                                        | tax_calculation_table.year_summary.loss_relief_note

// SECTION: CT600 HEADER INPUTS
// inputs.company_utr                                         | ct600_header.company_utr                                 | -
// inputs.company_name                                        | ct600_header.company_name                                | -
// inputs.company_registration_number                         | ct600_header.company_registration_number                 | -
// inputs.return_type_or_period_indicator                     | ct600_header.return_type_or_period_indicator             | -
// inputs.company_address                                     | ct600_header.company_address                             | -
// inputs.accounts_and_computation_metadata                   | ct600_attachments.accounts_and_computation_metadata      | -

// SECTION: TAX COMPUTATION COVER INPUTS
// inputs.tax_computation_cover_company_identifier             | -                                                        | cover.company_identifier
// inputs.tax_computation_cover_accounting_framework           | -                                                        | cover.accounting_framework
// inputs.tax_computation_cover_computation_basis_note         | -                                                        | cover.computation_basis_note
