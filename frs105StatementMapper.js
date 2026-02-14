/**
 * frs105StatementMapper.js
 * Maps accounting & tax data -> FRS 105 Financial Statements
 *
 * FRS 105 is the Financial Reporting Standard for small companies.
 * This produces:
 * - Statement of Financial Position (Balance Sheet)
 * - Statement of Comprehensive Income (P&L)
 * - Supporting notes & disclosures (simplified per small company scope)
 *
 * NOTE: This is NOT a full balance sheet generator; assumes you have separate
 * balance sheet data (assets, liabilities, equity). This focuses on mapping
 * the MANDATORY P&L and related tax disclosure items.
 */
(function (root) {
  'use strict';

  const TaxModel = root.TaxModel;
  const TaxComputationMapper = root.TaxComputationMapper;

  if (!TaxModel) throw new Error('TaxModel not loaded. Load taxModel.js first.');
  // TaxComputationMapper is optional (for enhanced disclosure if available)

  function round(n) { return TaxModel.roundPounds(n); }

  /**
   * Statement of Comprehensive Income (P&L)
   * FRS 105 requires minimum items shown in the format below.
   * Per small company rules, you can use the "micro-entity format" or full format.
   */
  function buildComprehensiveIncomeStatement(inputs, result, balanceSheetData) {
    const bs = balanceSheetData || {};

    // P&L items from tax engine (all amounts in pounds, pre-rounded)
    const stmtCompIncome = {
      // Trading revenue
      revenue_turnover: round(inputs.pnl.turnover),

      // Cost of sales
      cost_of_sales: round(inputs.pnl.costOfSales),

      // Gross profit
      gross_profit_loss: round(inputs.pnl.turnover - inputs.pnl.costOfSales),

      // Operating/administrative expenses
      administrative_expenses: {
        staff_costs: round(inputs.pnl.staffCosts),
        depreciation_charge: round(inputs.pnl.depreciation),
        other_operating_charges: round(inputs.pnl.otherCharges),
        total_administrative_expenses: round(
          inputs.pnl.staffCosts + inputs.pnl.depreciation + inputs.pnl.otherCharges
        )
      },

      // Operating profit (EBIT)
      // FIXED: Correctly calculated as Gross Profit - Admin Expenses
      // = (Turnover - COS) - (Staff + Depreciation + Other)
      operating_profit: round(
        (inputs.pnl.turnover - inputs.pnl.costOfSales) 
        - inputs.pnl.staffCosts 
        - inputs.pnl.depreciation 
        - inputs.pnl.otherCharges
      ),

      // Finance income / costs
      finance_income: round(inputs.pnl.interestIncome),
      finance_costs: round(0), // not explicitly modeled; can add if needed

      // Non-operating income
      non_operating_income: {
        rental_income: round(inputs.pnl.rentalIncome),
        dividend_income: round(inputs.pnl.dividendIncome),
        govt_grants_and_subsidies: round(inputs.pnl.govtGrants),
        total_non_operating: round(
          inputs.pnl.rentalIncome + inputs.pnl.dividendIncome + inputs.pnl.govtGrants
        )
      },

      // Profit before tax
      profit_before_tax: round(result.accounts.profitBeforeTax),

      // Tax expense - broken down by type
      tax_expense: {
        corporation_tax_charge: round(result.tax.corporationTaxCharge),
        adjustments_prior_years: round(0), // not modeled; add if applicable
        total_tax_expense: round(result.tax.corporationTaxCharge)
      },

      // Profit for the period (bottom line)
      profit_for_period: round(
        result.accounts.profitBeforeTax - result.tax.corporationTaxCharge
      ),

      // Other comprehensive income (not typical for small trading companies)
      other_comprehensive_income: round(0),

      // Total comprehensive income (usually same as profit for period for small companies)
      total_comprehensive_income: round(
        result.accounts.profitBeforeTax - result.tax.corporationTaxCharge
      )
    };

    return stmtCompIncome;
  }

  /**
   * Statement of Financial Position (Balance Sheet)
   * 
   * ⚠️  CRITICAL INPUT ASSUMPTION:
   * balanceSheetData.retained_earnings_bfwd MUST be the OPENING retained earnings
   * (i.e., retained earnings at the START of this accounting period).
   * 
   * DO NOT use the CLOSING retained earnings from your accounting software export;
   * it will double-count profit_for_period and cause the balance sheet to not balance.
   * 
   * Correct Flow:
   *   Retained Earnings Brought Forward (opening): £100k
   * + Profit This Period: £30k
   * = Retained Earnings Carried Forward (closing): £130k
   * 
   * If you export from accounting software, the "Retained Earnings" field is usually the
   * CLOSING balance (£130k). Subtract current period profit to get opening (£100k).
   */
  function buildStatementOfFinancialPosition(inputs, result, balanceSheetData) {
    const bs = balanceSheetData || {};

    const stmtFinPos = {
      // NON-CURRENT ASSETS
      non_current_assets: {
        property_plant_equipment: {
          gross_amount: round(bs.ppe_gross || 0),
          accumulated_depreciation: round(bs.ppe_accumulated_depreciation || 0),
          net_book_value: round((bs.ppe_gross || 0) - (bs.ppe_accumulated_depreciation || 0))
        },
        intangible_assets: {
          net_book_value: round(bs.intangible_assets || 0)
        },
        financial_assets: {
          investments: round(bs.financial_investments || 0)
        },
        total_non_current_assets: round(
          ((bs.ppe_gross || 0) - (bs.ppe_accumulated_depreciation || 0)) +
          (bs.intangible_assets || 0) +
          (bs.financial_investments || 0)
        )
      },

      // CURRENT ASSETS
      current_assets: {
        inventories_stock: round(bs.inventories || 0),
        trade_receivables: round(bs.receivables || 0),
        other_receivables: round(bs.other_current_receivables || 0),
        cash_and_equivalents: round(bs.cash || 0),
        total_current_assets: round(
          (bs.inventories || 0) +
          (bs.receivables || 0) +
          (bs.other_current_receivables || 0) +
          (bs.cash || 0)
        )
      },

      // EQUITY & LIABILITIES
      current_liabilities: {
        trade_payables: round(bs.payables || 0),
        borrowings_current: round(bs.current_borrowings || 0),
        corporation_tax_payable: round(result.tax.taxPayable || 0),
        other_current_liabilities: round(bs.other_current_liabilities || 0),
        total_current_liabilities: round(
          (bs.payables || 0) +
          (bs.current_borrowings || 0) +
          (result.tax.taxPayable || 0) +
          (bs.other_current_liabilities || 0)
        )
      },

      non_current_liabilities: {
        borrowings_non_current: round(bs.non_current_borrowings || 0),
        deferred_tax: round(bs.deferred_tax_liability || 0),
        other_non_current_liabilities: round(bs.other_non_current_liabilities || 0),
        total_non_current_liabilities: round(
          (bs.non_current_borrowings || 0) +
          (bs.deferred_tax_liability || 0) +
          (bs.other_non_current_liabilities || 0)
        )
      },

      // EQUITY (computed: Assets - Liabilities)
      equity: {
        called_up_share_capital: round(bs.share_capital || 0),
        share_premium: round(bs.share_premium || 0),
        retained_earnings_reserves: round(bs.retained_earnings_bfwd || 0),  // OPENING balance only
        profit_for_period: round(
          result.accounts.profitBeforeTax - result.tax.corporationTaxCharge
        ),
        total_equity: round(
          (bs.share_capital || 0) +
          (bs.share_premium || 0) +
          (bs.retained_earnings_bfwd || 0) +  // OPENING balance only
          (result.accounts.profitBeforeTax - result.tax.corporationTaxCharge)
        )
      }
    };

    // Balance check
    stmtFinPos._balance_total_assets = round(
      stmtFinPos.non_current_assets.total_non_current_assets +
      stmtFinPos.current_assets.total_current_assets
    );

    stmtFinPos._balance_total_equity_liabilities = round(
      stmtFinPos.equity.total_equity +
      stmtFinPos.current_liabilities.total_current_liabilities +
      stmtFinPos.non_current_liabilities.total_non_current_liabilities
    );

    stmtFinPos._balance_check = stmtFinPos._balance_total_assets === stmtFinPos._balance_total_equity_liabilities;

    return stmtFinPos;
  }

  /**
   * Mandatory Disclosures per FRS 105
   * Small companies still must disclose key items, but with relaxed requirements
   */
  function buildMandatoryDisclosures(inputs, result, taxComputationData, options) {
    const opt = options || {};
    const includeOptional = opt.include_optional_disclosures !== false; // Default: true (backward compatible)
    
    // Determine dynamic tax rate (not hardcoded 25%)
    let dynamicTaxRate = 0.25;
    if (result.byFY && result.byFY[0]) {
      dynamicTaxRate = result.byFY[0].rate || 0.19;
    } else if (result.computation && result.computation.augmentedProfits) {
      // Fallback: infer from augmented profits thresholds
      dynamicTaxRate = result.computation.augmentedProfits <= 50000 ? 0.19 : 0.25;
    }

    const disclosures = {
      // 1. Accounting Policies (mandatory)
      accounting_policies: {
        basis_of_preparation: 'Small company regime applicable per Companies Act 2006, Schedule 1A. Accounts prepared under FRS 105.',
        measurement_basis: 'Historical cost',
        accounting_period_start: inputs.apStart,
        accounting_period_end: inputs.apEnd,
        accounting_period_length_days: inputs.apDays
      },

      // 2. Critical Accounting Judgments & Estimates (mandatory)
      judgments_and_estimates: {
        depreciation_policy: 'Straight-line depreciation applied per management policy',
        depreciation_charge_this_period: round(inputs.pnl.depreciation),
        useful_lives_reviewed: 'Yes' // Placeholder
      },

      // 3. Going Concern Statement (mandatory)
      going_concern: {
        assessment_made: true,
        conclusion: 'The directors have assessed the going concern basis of accounting. No material uncertainties identified regarding the company\'s ability to continue as a going concern.',
        disclosure_required: true
      },

      // 4. Tax Reconciliation (OPTIONAL - FRS 105 allows micro-entities to exclude)
      ...(includeOptional && {
        tax_reconciliation: {
          profit_before_tax: round(result.accounts.profitBeforeTax),
          standard_corporation_tax_rate: dynamicTaxRate,
          tax_at_standard_rate: round(result.accounts.profitBeforeTax * dynamicTaxRate),
          adjustments: {
            disallowable_expenses_net: round(inputs.adjustments.disallowableExpenses),
            relief_on_disallowables: round(inputs.adjustments.disallowableExpenses * dynamicTaxRate),
            other_timing_differences: round(0)
          },
          total_tax_expense: round(result.tax.corporationTaxCharge),
          effective_tax_rate: round(result.accounts.profitBeforeTax) > 0
            ? (round(result.tax.corporationTaxCharge) / round(result.accounts.profitBeforeTax))
            : 0
        }
      }),

      // 5. Provisions & Contingencies (FRS 105 requires if applicable)
      provisions_contingencies: {
        warranty_provisions: round(0), // Not modeled; add if applicable
        legal_claims: 'None disclosed',
        contingent_liabilities: 'None disclosed'
      },

      // 6. Related Party Transactions (mandatory if any)
      related_party_transactions: {
        transactions_disclosed: false, // Change to true if any transactions
        transactions_list: []
      },

      // 7. Events after the Balance Sheet Date (mandatory disclosure)
      subsequent_events: {
        events_reviewed: true,
        disclosable_events: 'None'
      }
    };

    return disclosures;
  }

  /**
   * Detailed Note: Tax Computation Disclosure (FRS 105 requires reconciliation)
   * Shows how CT charge was derived from profit before tax
   */
  function buildTaxComputationNote(result, taxComputationData) {
    return {
      corporation_tax_computation: {
        profit_before_tax: round(result.accounts.profitBeforeTax),
        taxable_total_profits: round(result.computation.taxableTotalProfits),
        augmented_profits: round(result.computation.augmentedProfits),
        corporation_tax_at_main_rate: round(result.computation.taxableTotalProfits * 0.25),
        marginal_relief: round(result.tax.marginalRelief),
        corporation_tax_charge: round(result.tax.corporationTaxCharge),
        tax_computation_detailed: taxComputationData || null
      }
    };
  }

  /**
   * Main export: maps to full FRS 105 financial statements package
   */
  function map(inputs, result, balanceSheetData, taxComputationData, options) {
    const statements = {};

    // Statement of Comprehensive Income (required)
    statements.statement_of_comprehensive_income = buildComprehensiveIncomeStatement(inputs, result, balanceSheetData);

    // Statement of Financial Position (required)
    statements.statement_of_financial_position = buildStatementOfFinancialPosition(inputs, result, balanceSheetData);

    // Mandatory Notes
    statements.notes = {
      mandatory_disclosures: buildMandatoryDisclosures(inputs, result, taxComputationData, options),
      tax_computation: buildTaxComputationNote(result, taxComputationData)
    };

    // Summary
    statements.summary = {
      profit_before_tax: round(result.accounts.profitBeforeTax),
      tax_expense: round(result.tax.corporationTaxCharge),
      profit_for_year: round(result.accounts.profitBeforeTax - result.tax.corporationTaxCharge),
      total_assets: round(
        (balanceSheetData?.ppe_gross || 0) - (balanceSheetData?.ppe_accumulated_depreciation || 0) +
        (balanceSheetData?.inventories || 0) +
        (balanceSheetData?.receivables || 0) +
        (balanceSheetData?.cash || 0)
      ),
      total_equity: round(
        (balanceSheetData?.share_capital || 0) +
        (balanceSheetData?.retained_earnings || 0) +
        (result.accounts.profitBeforeTax - result.tax.corporationTaxCharge)
      )
    };

    return statements;
  }

  root.FRS105StatementMapper = { map };
})(typeof window !== 'undefined' ? window : globalThis);
