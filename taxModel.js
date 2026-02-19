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
    const accountingPeriodStart = String(ui.accountingPeriodStart || '');
    const accountingPeriodEnd = String(ui.accountingPeriodEnd || '');

    const apStartUTC = parseISODate(accountingPeriodStart);
    const apEndUTC = parseISODate(accountingPeriodEnd);

    if (!apStartUTC || !apEndUTC) {
      throw new Error('Invalid accounting period dates (accountingPeriodStart/accountingPeriodEnd). Use YYYY-MM-DD.');
    }
    if (apEndUTC < apStartUTC) {
      throw new Error('Accounting period end date must be on/after start date.');
    }
    const accountingPeriodDays = daysInclusive(apStartUTC, apEndUTC);

    const associatedCompanyCount = Math.max(0, Number(ui.associatedCompanyCount || 0) || 0);
    const companyUtr = String(ui.company_utr || '').trim();
    const companyName = String(ui.company_name || '').trim();
    const companyRegistrationNumber = String(ui.company_registration_number || '').trim();
    const returnTypeOrPeriodIndicator = String(
      ui.return_type_or_period_indicator ||
      '0'
    ).trim() || '0';
    const companyAddress = String(ui.company_address || '').trim();
    const accountsAndComputationMetadata = String(
      ui.accounts_and_computation_metadata ||
      ''
    ).trim();
    const taxComputationCoverCompanyIdentifier = String(
      ui.tax_computation_cover_company_identifier ||
      ''
    ).trim();
    const taxComputationCoverAccountingFramework = String(
      ui.tax_computation_cover_accounting_framework ||
      ''
    ).trim();
    const taxComputationCoverComputationBasisNote = String(
      ui.tax_computation_cover_computation_basis_note ||
      ''
    ).trim();

    // P&L / income items
    const tradingTurnover = roundPounds(ui.tradingTurnover || 0);
    const governmentGrants = roundPounds(ui.governmentGrants || 0);
    const propertyIncome = roundPounds(ui.propertyIncome || 0);
    const propertyLossBroughtForward = roundPounds(ui.propertyLossBroughtForward || 0);
    const propertyLossUsageRequestedRaw = ui.propertyLossUsageRequested;
    const propertyLossUsageRequested = (propertyLossUsageRequestedRaw === '' || propertyLossUsageRequestedRaw == null)
      ? null
      : (() => {
          const propertyLossUsageRequestedNum = Number(propertyLossUsageRequestedRaw);
          return Number.isFinite(propertyLossUsageRequestedNum)
            ? roundPounds(Math.max(0, propertyLossUsageRequestedNum))
            : null;
        })();
    const interestIncome = roundPounds(ui.interestIncome || 0);
    const tradingBalancingCharges = roundPounds(ui.tradingBalancingCharges || 0);
    const chargeableGains = roundPounds(ui.chargeableGains || 0);
    const chargeableGainsComputationFileName = String(ui.chargeableGainsComputationFileName || '');
    const dividendIncome = roundPounds(ui.dividendIncome || 0);

    // Expenses
    const costOfGoodsSold = roundPounds(ui.costOfGoodsSold || 0);
    const staffEmploymentCosts = roundPounds(ui.staffEmploymentCosts || 0);
    const depreciationExpense = roundPounds(ui.depreciationExpense || 0);
    const otherOperatingCharges = roundPounds(ui.otherOperatingCharges || 0);

    // Tax adjustments / allowances (user inputs)
    const disallowableExpenditure = roundPounds(ui.disallowableExpenditure || 0);
    const otherTaxAdjustmentsAddBack = roundPounds(ui.otherTaxAdjustmentsAddBack || 0);

    // Capital allowances (AIA): keep separate trade/non-trade buckets.
    const annualInvestmentAllowanceTradeAdditions = roundPounds(ui.annualInvestmentAllowanceTradeAdditions || 0);
    const annualInvestmentAllowanceNonTradeAdditions = roundPounds(ui.annualInvestmentAllowanceNonTradeAdditions || 0);
    const annualInvestmentAllowanceTotalAdditionsRaw = Number(ui.annualInvestmentAllowanceTotalAdditions);
    const annualInvestmentAllowanceTotalAdditions = Number.isFinite(annualInvestmentAllowanceTotalAdditionsRaw)
      ? roundPounds(annualInvestmentAllowanceTotalAdditionsRaw)
      : roundPounds(annualInvestmentAllowanceTradeAdditions + annualInvestmentAllowanceNonTradeAdditions);

    // Trading losses
    const tradingLossBroughtForward = roundPounds(ui.tradingLossBroughtForward || 0);
    const tradingLossUsageRequestedRaw = ui.tradingLossUsageRequested;
    const tradingLossUsageRequested = (tradingLossUsageRequestedRaw === '' || tradingLossUsageRequestedRaw == null)
      ? null
      : (() => {
          const tradingLossUsageRequestedNum = Number(tradingLossUsageRequestedRaw);
          return Number.isFinite(tradingLossUsageRequestedNum)
            ? roundPounds(Math.max(0, tradingLossUsageRequestedNum))
            : null;
        })();

    // Optional CT600 non-computation inputs (reliefs / charges / declaration)
    const declarationName = String(ui.declarationName || '');
    const declarationDate = String(ui.declarationDate || '');
    const declarationStatus = String(ui.declarationStatus || '');
    const ct600 = {
      communityInvestmentTaxRelief: roundPounds(ui.communityInvestmentTaxRelief || 0),
      doubleTaxationRelief: roundPounds(ui.doubleTaxationRelief || 0),
      advanceCorporationTax: roundPounds(ui.advanceCorporationTax || 0),
      loansToParticipatorsTax: roundPounds(ui.loansToParticipatorsTax || 0),
      controlledForeignCompaniesTax: roundPounds(ui.controlledForeignCompaniesTax || 0),
      bankLevyPayable: roundPounds(ui.bankLevyPayable || 0),
      bankSurchargePayable: roundPounds(ui.bankSurchargePayable || 0),
      residentialPropertyDeveloperTax: roundPounds(ui.residentialPropertyDeveloperTax || 0),
      eogplPayable: roundPounds(ui.eogplPayable || 0),
      eglPayable: roundPounds(ui.eglPayable || 0),
      supplementaryChargePayable: roundPounds(ui.supplementaryChargePayable || 0),
      incomeTaxDeductedFromGrossIncome: roundPounds(ui.incomeTaxDeductedFromGrossIncome || 0),
      coronavirusSupportPaymentOverpaymentNowDue: roundPounds(ui.coronavirusSupportPaymentOverpaymentNowDue || 0),
      restitutionTax: roundPounds(ui.restitutionTax || 0),
      underlyingRateReliefClaim: parseCheckmark(ui.underlyingRateReliefClaim),
      reliefCarriedBackToEarlierPeriod: parseCheckmark(ui.reliefCarriedBackToEarlierPeriod)
    };

    return {
      accountingPeriodStart,
      accountingPeriodEnd,
      apStartUTC,
      apEndUTC,
      accountingPeriodDays,
      associatedCompanyCount,
      company_utr: companyUtr,
      company_name: companyName,
      company_registration_number: companyRegistrationNumber,
      return_type_or_period_indicator: returnTypeOrPeriodIndicator,
      company_address: companyAddress,
      accounts_and_computation_metadata: accountsAndComputationMetadata,
      tax_computation_cover_company_identifier: taxComputationCoverCompanyIdentifier,
      tax_computation_cover_accounting_framework: taxComputationCoverAccountingFramework,
      tax_computation_cover_computation_basis_note: taxComputationCoverComputationBasisNote,

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
        otherOperatingCharges
      },

      adjustments: {
        disallowableExpenditure,
        otherTaxAdjustmentsAddBack
      },

      capitalAllowances: {
        annualInvestmentAllowanceTradeAdditions,
        annualInvestmentAllowanceNonTradeAdditions,
        annualInvestmentAllowanceTotalAdditions
      },

      losses: {
        tradingLossBroughtForward,
        tradingLossUsageRequested,
        propertyLossUsageRequested
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
        propertyBusinessIncomeForCT600: 0,
        propertyLossUsed: 0,
        propertyLossAvailable: 0,
        propertyLossCF: 0
      },

      // Computation
      computation: {
        addBacks: 0,
        deductions: 0,
        capitalAllowances: 0,
        tradingLossUsed: 0,
        // Legacy alias: remaining brought-forward trading loss after usage.
        tradingLossAvailable: 0,
        tradingLossBroughtForwardAvailable: 0,
        tradingLossBroughtForwardRemaining: 0,
        tradingLossCurrentPeriodIncurred: 0,
        grossTradingProfit: 0,
        profitsSubtotal: 0,
        subtotalBeforeDeductions: 0,
        totalTradingIncome: 0,
        totalOtherIncome: 0,
        nonTradingIncomeExcludedFromTradingView: 0,
        tradingLossCarriedForward: 0,
        miscellaneousIncomeNotElsewhere: 0,
        aiaTotalCap: 0,
        aiaRequestedTotal: 0,
        aiaUnrelievedBroughtForwardTotal: 0,
        aiaAllocationNote: '',
        aiaPartsByFY: [],

        taxableTradingProfit: 0,
        taxableNonTradingProfits: 0,
        taxableTotalProfits: 0,

        augmentedProfits: 0
      },

      // Tax outcome (total across FYs)
      tax: {
        corporationTaxCharge: 0,
        corporationTaxChargeable: 0,
        corporationTaxTableTotal: 0,
        marginalRelief: 0,
        totalReliefsAndDeductions: 0,
        totalBox500Charges: 0,
        netCTLiability: 0,
        totalTaxChargeable: 0,
        incomeTaxRepayable: 0,
        selfAssessmentTaxPayable: 0,
        totalSelfAssessmentTaxPayable: 0,
        smallProfitsRateOrMarginalReliefEntitlement: '',
        taxPayable: 0
      },

      // Submission-level accounting periods (1 unless AP > 12 months).
      periods: [],

      // Tax-regime slices inside each period (usually FY overlap slices).
      slices: [],

      // Legacy alias for slices (backward compatibility).
      byFY: []
    };
  }

  root.TaxModel = {
    createInputs,
    createEmptyResult,
    roundPounds
  };
})(typeof window !== 'undefined' ? window : globalThis);
