/**
 * taxModel.js
 * Canonical internal data model for UK Corporation Tax computation.
 *
 * Goals:
 * - Stable keys (do NOT name keys after CT600 boxes or taxonomy elements)
 * - Pure data: no DOM, no globals required
 */
(function (root) {
  'use strict';

  function roundPounds(n) {
    const x = Number(n || 0);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x);
  }

  function parseISODate(iso) {
    if (!iso) return null;
    const parts = String(iso).split('-').map(Number);
    if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return null;
    const [y, m, d] = parts;
    return new Date(Date.UTC(y, m - 1, d));
  }

  function daysInclusive(startUTC, endUTC) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((endUTC - startUTC) / msPerDay) + 1;
  }

  function parseCheckmark(v) {
    if (v === true) return 'X';
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) return '';
    return (s === 'x' || s === 'true' || s === '1' || s === 'yes') ? 'X' : '';
  }

  function createInputs(userInputs) {
    const ui = userInputs || {};
    const accountingPeriodStart = String(ui.accountingPeriodStart ?? ui.apStart ?? ui.box_30_period_start ?? '');
    const accountingPeriodEnd = String(ui.accountingPeriodEnd ?? ui.apEnd ?? ui.box_35_period_end ?? '');

    const apStartUTC = parseISODate(accountingPeriodStart);
    const apEndUTC = parseISODate(accountingPeriodEnd);

    if (!apStartUTC || !apEndUTC) {
      throw new Error('Invalid accounting period dates (apStart/apEnd). Use YYYY-MM-DD.');
    }
    if (apEndUTC < apStartUTC) {
      throw new Error('Accounting period end date must be on/after start date.');
    }

    const associatedCompanyCount = Math.max(0, Number(ui.associatedCompanyCount ?? ui.assocCompanies ?? ui.box_326_assoc_companies ?? 0) || 0);

    // P&L / income items
    const tradingTurnover = roundPounds(ui.tradingTurnover ?? ui.turnover ?? ui.val_turnover ?? 0);
    const governmentGrants = roundPounds(ui.governmentGrants ?? ui.govtGrants ?? ui.box_325_govt_grants ?? 0);
    const propertyIncome = roundPounds(ui.propertyIncome ?? ui.rentalIncome ?? ui.box_190_rental_income ?? 0);
    const propertyLossBroughtForward = roundPounds(ui.propertyLossBroughtForward ?? ui.propertyLossBF ?? ui.box_250_prop_losses_bfwd ?? 0);
    const interestIncome = roundPounds(ui.interestIncome ?? ui.box_170_interest_income ?? 0);
    // Backward compatible aliases:
    // - disposalGains (legacy UI label)
    // - balancingChargesTrade / assetDisposalsBalancingCharge (clearer tax meaning)
    const tradingBalancingCharges = roundPounds(
      ui.tradingBalancingCharges ??
      ui.disposalGains ??
      ui.balancingChargesTrade ??
      ui.assetDisposalsBalancingCharge ??
      ui.box_205_disposal_gains ??
      0
    );
    const chargeableGains = roundPounds(ui.chargeableGains ?? ui.capitalGains ?? ui.box_210_chargeable_gains ?? 0);
    const chargeableGainsComputationFileName = String(ui.chargeableGainsComputationFileName ?? ui.capitalGainsFileName ?? ui.capital_gains_source_file ?? '');
    const dividendIncome = roundPounds(ui.dividendIncome ?? ui.box_620_dividend_income ?? 0);

    // Expenses
    const costOfGoodsSold = roundPounds(ui.costOfGoodsSold ?? ui.costOfSales ?? ui.val_cost_of_sales ?? 0);
    const staffEmploymentCosts = roundPounds(ui.staffEmploymentCosts ?? ui.staffCosts ?? ui.val_staff_costs ?? 0);
    const depreciationExpense = roundPounds(ui.depreciationExpense ?? ui.depreciation ?? ui.val_depreciation_acc ?? 0);
    const otherOperatingCharges = roundPounds(ui.otherOperatingCharges ?? ui.otherCharges ?? ui.val_other_charges ?? 0);

    // Tax adjustments / allowances (user inputs)
    const disallowableExpenditure = roundPounds(ui.disallowableExpenditure ?? ui.disallowableExpenses ?? ui.val_disallowable_expenses ?? 0);
    const otherTaxAdjustmentsAddBack = roundPounds(ui.otherTaxAdjustmentsAddBack ?? ui.otherAdjustments ?? ui.val_other_adjustments ?? 0);

    // Capital allowances (AIA): keep separate trade/non-trade buckets.
    const annualInvestmentAllowanceTradeAdditions = roundPounds(
      ui.annualInvestmentAllowanceTradeAdditions ??
      ui.aiaTradeAdditions ?? ui.aiaTrade ?? ui.box_670_aia_trade_additions ?? ui.box_670_aia_additions ?? 0
    );
    const annualInvestmentAllowanceNonTradeAdditions = roundPounds(
      ui.annualInvestmentAllowanceNonTradeAdditions ??
      ui.aiaNonTradeAdditions ?? ui.aiaNonTrade ?? ui.box_671_aia_non_trade_additions ?? 0
    );
    const fallbackAiaTotal = roundPounds(ui.annualInvestmentAllowanceTotalAdditions ?? ui.aiaAdditions ?? ui.box_670_aia_additions ?? 0);
    // Backward compatibility: if only total provided, treat as trade AIA.
    const resolvedAiaTrade = annualInvestmentAllowanceTradeAdditions || fallbackAiaTotal;
    const resolvedAiaNonTrade = annualInvestmentAllowanceNonTradeAdditions;

    // Trading losses
    const tradingLossBroughtForward = roundPounds(ui.tradingLossBroughtForward ?? ui.tradingLossBF ?? ui.box_160_trading_losses_bfwd ?? 0);
    const tradingLossUsageRequestedRaw = ui.tradingLossUsageRequested ?? ui.tradingLossUseRequested ?? ui.box_161_trading_losses_use_requested;
    const tradingLossUsageRequested = (tradingLossUsageRequestedRaw === '' || tradingLossUsageRequestedRaw == null)
      ? null
      : (() => {
          const tradingLossUsageRequestedNum = Number(tradingLossUsageRequestedRaw);
          return Number.isFinite(tradingLossUsageRequestedNum)
            ? roundPounds(Math.max(0, tradingLossUsageRequestedNum))
            : null;
        })();

    // Optional CT600 non-computation inputs (reliefs / charges / declaration)
    const declarationName = String(ui.declarationName ?? ui.box_975_name ?? '');
    const declarationDate = String(ui.declarationDate ?? ui.box_980_date ?? '');
    const declarationStatus = String(ui.declarationStatus ?? ui.box_985_status ?? '');
    const ct600 = {
      communityInvestmentTaxRelief: roundPounds(ui.communityInvestmentTaxRelief ?? ui.box_445_community_investment_tax_relief ?? 0),
      doubleTaxationRelief: roundPounds(ui.doubleTaxationRelief ?? ui.box_450_double_taxation_relief ?? 0),
      advanceCorporationTax: roundPounds(ui.advanceCorporationTax ?? ui.box_465_advance_corporation_tax ?? 0),
      loansToParticipatorsTax: roundPounds(ui.loansToParticipatorsTax ?? ui.box_480_loans_to_participators_tax ?? 0),
      controlledForeignCompaniesTax: roundPounds(ui.controlledForeignCompaniesTax ?? ui.box_490_controlled_foreign_companies_tax ?? 0),
      bankLevyPayable: roundPounds(ui.bankLevyPayable ?? ui.box_495_bank_levy_payable ?? 0),
      bankSurchargePayable: roundPounds(ui.bankSurchargePayable ?? ui.box_496_bank_surcharge_payable ?? 0),
      residentialPropertyDeveloperTax: roundPounds(ui.residentialPropertyDeveloperTax ?? ui.box_497_residential_property_developer_tax ?? 0),
      eogplPayable: roundPounds(ui.eogplPayable ?? ui.box_501_energy_oil_and_gas_profits_levy ?? 0),
      eglPayable: roundPounds(ui.eglPayable ?? ui.box_502_electricity_generator_levy ?? 0),
      supplementaryChargePayable: roundPounds(ui.supplementaryChargePayable ?? ui.box_505_supplementary_charge_payable ?? 0),
      incomeTaxDeductedFromGrossIncome: roundPounds(ui.incomeTaxDeductedFromGrossIncome ?? ui.box_515_income_tax_deducted_from_gross_income ?? 0),
      coronavirusSupportPaymentOverpaymentNowDue: roundPounds(ui.coronavirusSupportPaymentOverpaymentNowDue ?? ui.box_526_coronavirus_support_payment_overpayment_now_due ?? 0),
      restitutionTax: roundPounds(ui.restitutionTax ?? ui.box_527_restitution_tax ?? 0),
      underlyingRateReliefClaim: parseCheckmark(ui.underlyingRateReliefClaim ?? ui.box_455_underlying_rate_relief_claim),
      reliefCarriedBackToEarlierPeriod: parseCheckmark(ui.reliefCarriedBackToEarlierPeriod ?? ui.box_460_relief_carried_back_to_earlier_period)
    };

    return {
      accountingPeriodStart,
      accountingPeriodEnd,
      apStartUTC,
      apEndUTC,
      accountingPeriodDays: daysInclusive(apStartUTC, apEndUTC),
      associatedCompanyCount,
      // Legacy aliases retained for backward compatibility.
      apStart: accountingPeriodStart,
      apEnd: accountingPeriodEnd,
      apDays: daysInclusive(apStartUTC, apEndUTC),
      assocCompanies: associatedCompanyCount,

      pnl: {
        tradingTurnover,
        governmentGrants,
        propertyIncome,
        propertyLossBroughtForward,
        interestIncome,
        tradingBalancingCharges,
        chargeableGains,
        chargeableGainsComputationFileName,
        dividendIncome,
        costOfGoodsSold,
        staffEmploymentCosts,
        depreciationExpense,
        otherOperatingCharges,
        // Legacy aliases retained for backward compatibility.
        turnover: tradingTurnover,
        govtGrants: governmentGrants,
        rentalIncome: propertyIncome,
        propertyLossBF: propertyLossBroughtForward,
        disposalGains: tradingBalancingCharges,
        capitalGains: chargeableGains,
        capitalGainsFileName: chargeableGainsComputationFileName,
        costOfSales: costOfGoodsSold,
        staffCosts: staffEmploymentCosts,
        depreciation: depreciationExpense,
        otherCharges: otherOperatingCharges
      },

      adjustments: {
        disallowableExpenditure,
        otherTaxAdjustmentsAddBack,
        // Legacy aliases retained for backward compatibility.
        disallowableExpenses: disallowableExpenditure,
        otherAdjustments: otherTaxAdjustmentsAddBack
      },

      capitalAllowances: {
        annualInvestmentAllowanceTradeAdditions: resolvedAiaTrade,
        annualInvestmentAllowanceNonTradeAdditions: resolvedAiaNonTrade,
        annualInvestmentAllowanceTotalAdditions: resolvedAiaTrade + resolvedAiaNonTrade,
        // Legacy aliases retained for backward compatibility.
        aiaTradeAdditions: resolvedAiaTrade,
        aiaNonTradeAdditions: resolvedAiaNonTrade,
        aiaAdditions: resolvedAiaTrade + resolvedAiaNonTrade
      },

      losses: {
        tradingLossBroughtForward,
        tradingLossUsageRequested,
        // Legacy aliases retained for backward compatibility.
        tradingLossBF: tradingLossBroughtForward,
        tradingLossUseRequested: tradingLossUsageRequested
      },

      declaration: {
        name: declarationName,
        date: declarationDate,
        status: declarationStatus
      },

      ct600
    };
  }

  function createEmptyResult() {
    return {
      // Raw accounting
      accounts: {
        totalIncome: 0,
        totalExpenses: 0,
        profitBeforeTax: 0
      },

      // Property (rental) after offsetting property losses b/fwd
      property: {
        rentalIncome: 0,
        propertyLossBF: 0,
        propertyProfitAfterLossOffset: 0,
        propertyLossCF: 0
      },

      // Computation
      computation: {
        addBacks: 0,
        deductions: 0,
        capitalAllowances: 0,
        tradingLossUsed: 0,

        taxableTradingProfit: 0,
        taxableNonTradingProfits: 0,
        taxableTotalProfits: 0,

        augmentedProfits: 0
      },

      // Tax outcome (total across FYs)
      tax: {
        corporationTaxCharge: 0,
        marginalRelief: 0,
        taxPayable: 0
      },

      // Breakdown by FY overlap (for transparency + mapping)
      byFY: []
    };
  }

  root.TaxModel = {
    createInputs,
    createEmptyResult,
    roundPounds
  };
})(typeof window !== 'undefined' ? window : globalThis);
