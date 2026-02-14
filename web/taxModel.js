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

  function createInputs(userInputs) {
    const ui = userInputs || {};
    const apStart = String(ui.apStart || ui.box_30_period_start || '');
    const apEnd = String(ui.apEnd || ui.box_35_period_end || '');

    const apStartUTC = parseISODate(apStart);
    const apEndUTC = parseISODate(apEnd);

    if (!apStartUTC || !apEndUTC) {
      throw new Error('Invalid accounting period dates (apStart/apEnd). Use YYYY-MM-DD.');
    }
    if (apEndUTC < apStartUTC) {
      throw new Error('Accounting period end date must be on/after start date.');
    }

    const assocCompanies = Math.max(0, Number(ui.assocCompanies ?? ui.box_326_assoc_companies ?? 0) || 0);

    // P&L / income items
    const turnover = roundPounds(ui.turnover ?? ui.val_turnover ?? 0);
    const govtGrants = roundPounds(ui.govtGrants ?? ui.box_325_govt_grants ?? 0);
    const rentalIncome = roundPounds(ui.rentalIncome ?? ui.box_190_rental_income ?? 0);
    const propertyLossBF = roundPounds(ui.propertyLossBF ?? ui.box_250_prop_losses_bfwd ?? 0);
    const interestIncome = roundPounds(ui.interestIncome ?? ui.box_170_interest_income ?? 0);
    const dividendIncome = roundPounds(ui.dividendIncome ?? ui.box_620_dividend_income ?? 0);

    // Expenses
    const costOfSales = roundPounds(ui.costOfSales ?? ui.val_cost_of_sales ?? 0);
    const staffCosts = roundPounds(ui.staffCosts ?? ui.val_staff_costs ?? 0);
    const depreciation = roundPounds(ui.depreciation ?? ui.val_depreciation_acc ?? 0);
    const otherCharges = roundPounds(ui.otherCharges ?? ui.val_other_charges ?? 0);

    // Tax adjustments / allowances (user inputs)
    const disallowableExpenses = roundPounds(ui.disallowableExpenses ?? ui.val_disallowable_expenses ?? 0);
    const otherAdjustments = roundPounds(ui.otherAdjustments ?? ui.val_other_adjustments ?? 0);

    // Capital allowances: for v1 we keep "AIA additions" as a single amount.
    // You already prorate the AIA cap by AP days across FYs in initial.js;
    // we keep the cap logic inside taxEngine.
    const aiaAdditions = roundPounds(ui.aiaAdditions ?? ui.box_670_aia_additions ?? 0);

    // Trading losses
    const tradingLossBF = roundPounds(ui.tradingLossBF ?? ui.box_160_trading_losses_bfwd ?? 0);

    return {
      apStart,
      apEnd,
      apStartUTC,
      apEndUTC,
      apDays: daysInclusive(apStartUTC, apEndUTC),
      assocCompanies,

      pnl: {
        turnover,
        govtGrants,
        rentalIncome,
        propertyLossBF,
        interestIncome,
        dividendIncome,

        costOfSales,
        staffCosts,
        depreciation,
        otherCharges
      },

      adjustments: {
        disallowableExpenses,
        otherAdjustments
      },

      capitalAllowances: {
        aiaAdditions
      },

      losses: {
        tradingLossBF
      }
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