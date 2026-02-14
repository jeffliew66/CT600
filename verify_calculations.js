#!/usr/bin/env node

// Manual verification script - run outside browser to debug
const fs = require('fs');
const path = require('path');

// Load taxModel and taxEngine
const taxModelCode = fs.readFileSync('./taxModel.js', 'utf8');
const taxEngineCode = fs.readFileSync('./taxEngine.js', 'utf8');

// Create a minimal globalThis for the modules
global.window = undefined;
global.globalThis = global;

// Execute modules
eval(taxModelCode);
eval(taxEngineCode);

console.log('='.repeat(80));
console.log('VERIFICATION SCRIPT - Testing Marginal Relief Calculation');
console.log('='.repeat(80));

// Test Case 1: 300k profit, 1 Jan 2023 - 31 Dec 2023 (365 days)
console.log('\nTEST 1: 365-day period (1 Jan 2023 - 31 Dec 2023)');
console.log('-'.repeat(80));
const test1Inputs = {
  apStart: '2023-01-01',
  apEnd: '2023-12-31',
  assocCompanies: 0,
  turnover: 300000,
  govtGrants: 0,
  rentalIncome: 0,
  interestIncome: 0,
  dividendIncome: 0,
  costOfSales: 0,
  staffCosts: 0,
  depreciation: 0,
  otherCharges: 0,
  disallowableExpenses: 0,
  otherAdjustments: 0,
  aiaAdditions: 0,
  tradingLossBF: 0,
  propertyLossBF: 0
};

const result1 = TaxEngine.run(test1Inputs, {});
console.log(`Days in AP: ${result1.inputs.apDays}`);
console.log(`PBT: £${result1.result.accounts.profitBeforeTax.toLocaleString()}`);
console.log(`Taxable Total Profits: £${result1.result.computation.taxableTotalProfits.toLocaleString()}`);
console.log(`Augmented Profits: £${result1.result.computation.augmentedProfits.toLocaleString()}`);
console.log(`CT Charge: £${result1.result.tax.corporationTaxCharge.toLocaleString()}`);
console.log(`Marginal Relief: £${result1.result.tax.marginalRelief.toLocaleString()}`);
console.log('\nBy FY Breakdown:');
result1.result.byFY.forEach(fy => {
  console.log(`  FY ${fy.fy_year}: Taxable=£${Math.round(fy.taxableProfit).toLocaleString()}, Augmented=£${Math.round(fy.augmentedProfit).toLocaleString()}, CT=£${Math.round(fy.ctCharge).toLocaleString()}, MR=£${Math.round(fy.marginalRelief).toLocaleString()}`);
});
console.log(`Expected: ~£72,000 (due to MR across two FYs)`);
console.log(`Actual: £${result1.result.tax.corporationTaxCharge.toLocaleString()}`);

// Test Case 2: 300k profit, 1 Jan 2023 - 1 July 2024 (548 days)
console.log('\n\nTEST 2: 548-day period (1 Jan 2023 - 1 July 2024)');
console.log('-'.repeat(80));
const test2Inputs = {
  apStart: '2023-01-01',
  apEnd: '2024-07-01',
  assocCompanies: 0,
  turnover: 300000,
  govtGrants: 0,
  rentalIncome: 0,
  interestIncome: 0,
  dividendIncome: 0,
  costOfSales: 0,
  staffCosts: 0,
  depreciation: 0,
  otherCharges: 0,
  disallowableExpenses: 0,
  otherAdjustments: 0,
  aiaAdditions: 0,
  tradingLossBF: 0,
  propertyLossBF: 0
};

const result2 = TaxEngine.run(test2Inputs, {});
console.log(`Days in AP: ${result2.inputs.apDays}`);
console.log(`PBT: £${result2.result.accounts.profitBeforeTax.toLocaleString()}`);
console.log(`Taxable Total Profits: £${result2.result.computation.taxableTotalProfits.toLocaleString()}`);
console.log(`Augmented Profits: £${result2.result.computation.augmentedProfits.toLocaleString()}`);
console.log(`CT Charge: £${result2.result.tax.corporationTaxCharge.toLocaleString()}`);
console.log(`Marginal Relief: £${result2.result.tax.marginalRelief.toLocaleString()}`);
console.log('\nBy FY Breakdown:');
result2.result.byFY.forEach(fy => {
  console.log(`  FY ${fy.fy_year}: Taxable=£${Math.round(fy.taxableProfit).toLocaleString()}, Augmented=£${Math.round(fy.augmentedProfit).toLocaleString()}, CT=£${Math.round(fy.ctCharge).toLocaleString()}, MR=£${Math.round(fy.marginalRelief).toLocaleString()}`);
});
console.log(`Expected: <£72,000 (due to AP split + more MR benefit)`);
console.log(`Actual: £${result2.result.tax.corporationTaxCharge.toLocaleString()}`);

console.log('\n' + '='.repeat(80));
console.log('COMPARISON:');
console.log(`365-day: £${result1.result.tax.corporationTaxCharge.toLocaleString()}`);
console.log(`548-day: £${result2.result.tax.corporationTaxCharge.toLocaleString()}`);
console.log(`Difference: £${(result1.result.tax.corporationTaxCharge - result2.result.tax.corporationTaxCharge).toLocaleString()} (should be POSITIVE - 548-day should be LESS)`);
console.log('='.repeat(80));
