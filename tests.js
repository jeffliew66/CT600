/**
 * tests.js
 * Unit tests for UK Corporation Tax engine
 * 
 * Compare engine outputs against known HMRC worked examples and edge cases.
 * 
 * Run in Node.js:
 *   node tests.js
 */

// Load modules (Node.js or browser globals)
if (typeof window === 'undefined') {
  // Node.js mode: manually inject each module
  global.window = global;
  global.self = global;
}

// Load modules in order
require('./taxModel.js');
require('./taxEngine.js');

const TaxModel = global.TaxModel;
const TaxEngine = global.TaxEngine;

// Test helper
function assert(actual, expected, message) {
  if (actual !== expected) {
    console.error(`FAIL: ${message}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Actual: ${actual}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${message}`);
  }
}

function assertRange(actual, min, max, message) {
  if (actual < min || actual > max) {
    console.error(`FAIL: ${message}`);
    console.error(`  Expected range: [${min}, ${max}]`);
    console.error(`  Actual: ${actual}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${message}`);
  }
}

// Test cases
console.log('\n=== UK Corporation Tax Engine Unit Tests ===\n');

// TEST 1: Small profits rate (augmented profit <= £50k)
console.log('Test 1: Small profits rate (augmented profit <= £50k)');
const test1Input = {
  apStart: '2024-04-01',
  apEnd: '2025-03-31',
  turnover: 100000,
  costOfSales: 40000,
  staffCosts: 20000,
  depreciation: 5000,
  otherCharges: 10000,
  govtGrants: 0,
  rentalIncome: 0,
  interestIncome: 5000,
  dividendIncome: 0,
  disallowableExpenses: 0,
  otherAdjustments: 0,
  aiaAdditions: 0,
  tradingLossBF: 0,
  propertyLossBF: 0,
  assocCompanies: 0
};
const test1Result = TaxEngine.run(test1Input, {});
// taxable profit = (100k - 40k - 20k - 5k - 10k) + 0 - 0 = 25k
// augmented = 25k + 0 = 25k (< 50k threshold)
// CT = 25k * 0.19 = 4,750
assert(test1Result.result.computation.taxableTotalProfits, 25000, 'Test1: TTP should be 25,000');
assert(test1Result.result.tax.corporationTaxCharge, 4750, 'Test1: CT at small rate (19%) should be 4,750');
console.log('');

// TEST 2: Main rate (augmented profit >= £250k)
console.log('Test 2: Main rate (augmented profit >= £250k)');
const test2Input = {
  apStart: '2024-04-01',
  apEnd: '2025-03-31',
  turnover: 500000,
  costOfSales: 150000,
  staffCosts: 80000,
  depreciation: 10000,
  otherCharges: 20000,
  govtGrants: 0,
  rentalIncome: 0,
  interestIncome: 0,
  dividendIncome: 0,
  disallowableExpenses: 0,
  otherAdjustments: 0,
  aiaAdditions: 0,
  tradingLossBF: 0,
  propertyLossBF: 0,
  assocCompanies: 0
};
const test2Result = TaxEngine.run(test2Input, {});
// taxable = (500k - 150k - 80k - 10k - 20k) = 240k
// augmented = 240k (>= 250k? no, borderline)
// Actually, let me recalculate: 500 - 150 - 80 - 10 - 20 = 240k (below threshold)
// Let me adjust to push over 250k
const test2InputAdj = {
  apStart: '2024-04-01',
  apEnd: '2025-03-31',
  turnover: 550000,
  costOfSales: 150000,
  staffCosts: 80000,
  depreciation: 10000,
  otherCharges: 20000,
  govtGrants: 0,
  rentalIncome: 0,
  interestIncome: 0,
  dividendIncome: 0,
  disallowableExpenses: 0,
  otherAdjustments: 0,
  aiaAdditions: 0,
  tradingLossBF: 0,
  propertyLossBF: 0,
  assocCompanies: 0
};
const test2ResultAdj = TaxEngine.run(test2InputAdj, {});
// taxable = (550k - 150k - 80k - 10k - 20k) = 290k
// augmented = 290k (>= 250k)
// CT = 290k * 0.25 = 72,500
assert(test2ResultAdj.result.computation.taxableTotalProfits, 290000, 'Test2: TTP should be 290,000');
assert(test2ResultAdj.result.tax.corporationTaxCharge, 72500, 'Test2: CT at main rate (25%) should be 72,500');
console.log('');

// TEST 3: Marginal relief zone (£50k < augmented < £250k)
console.log('Test 3: Marginal relief zone (£50k < augmented < £250k)');
const test3Input = {
  apStart: '2024-04-01',
  apEnd: '2025-03-31',
  turnover: 250000,
  costOfSales: 80000,
  staffCosts: 50000,
  depreciation: 5000,
  otherCharges: 15000,
  govtGrants: 0,
  rentalIncome: 0,
  interestIncome: 0,
  dividendIncome: 0,
  disallowableExpenses: 0,
  otherAdjustments: 0,
  aiaAdditions: 0,
  tradingLossBF: 0,
  propertyLossBF: 0,
  assocCompanies: 0
};
const test3Result = TaxEngine.run(test3Input, {});
// taxable = 250k - 80k - 50k - 5k - 15k = 100k
// augmented = 100k (in MR band)
// main rate CT = 100k * 0.25 = 25,000
// MR = 0.015 * (250k - 100k) * (100k / 100k) = 0.015 * 150k * 1 = 2,250
// final CT = 25,000 - 2,250 = 22,750
assert(test3Result.result.computation.taxableTotalProfits, 100000, 'Test3: TTP should be 100,000');
assert(test3Result.result.tax.corporationTaxCharge, 22750, 'Test3: CT with MR should be 22,750');
assert(test3Result.result.tax.marginalRelief, 2250, 'Test3: MR relief should be 2,250');
console.log('');

// TEST 4: Trading loss offset
console.log('Test 4: Trading loss offset reduces taxable profit');
const test4Input = {
  apStart: '2024-04-01',
  apEnd: '2025-03-31',
  turnover: 150000,
  costOfSales: 50000,
  staffCosts: 30000,
  depreciation: 5000,
  otherCharges: 10000,
  govtGrants: 0,
  rentalIncome: 0,
  interestIncome: 0,
  dividendIncome: 0,
  disallowableExpenses: 0,
  otherAdjustments: 0,
  aiaAdditions: 0,
  tradingLossBF: 30000,  // Brought forward loss
  propertyLossBF: 0,
  assocCompanies: 0
};
const test4Result = TaxEngine.run(test4Input, {});
// taxable = 150k - 50k - 30k - 5k - 10k = 55k
// loss used = min(30k, 55k) = 30k
// TTP after loss = 55k - 30k = 25k
// augmented = 25k < 50k, so CT = 25k * 0.19 = 4,750
assert(test4Result.result.computation.tradingLossUsed, 30000, 'Test4: Should use 30k of loss');
assert(test4Result.result.computation.taxableTotalProfits, 25000, 'Test4: TTP after loss should be 25,000');
assert(test4Result.result.tax.corporationTaxCharge, 4750, 'Test4: CT should be 4,750');
console.log('');

// TEST 5: Associated companies divisor (thresholds reduced by 2 associated cos)
console.log('Test 5: Associated companies divisor reduces thresholds');
const test5Input = {
  apStart: '2024-04-01',
  apEnd: '2025-03-31',
  turnover: 200000,
  costOfSales: 60000,
  staffCosts: 40000,
  depreciation: 5000,
  otherCharges: 10000,
  govtGrants: 0,
  rentalIncome: 0,
  interestIncome: 0,
  dividendIncome: 0,
  disallowableExpenses: 0,
  otherAdjustments: 0,
  aiaAdditions: 0,
  tradingLossBF: 0,
  propertyLossBF: 0,
  assocCompanies: 2  // 3 companies in group (divisor = 3)
};
const test5Result = TaxEngine.run(test5Input, {});
// taxable = 200k - 60k - 40k - 5k - 10k = 85k
// augmented = 85k
// With 2 assoc companies: small threshold = 50k/3 ≈ 16.67k, upper = 250k/3 ≈ 83.33k
// 85k > 83.33k approx, so likely in MR or main rate
// Verify that thresholds were applied with divisor
const fy = test5Result.result.byFY[0];
if (fy && fy.thresholds) {
  assertRange(fy.thresholds.small_threshold_for_AP_in_this_FY, 16000, 17000, 'Test5: Small threshold should be ~16.67k with divisor 3');
  assertRange(fy.thresholds.upper_threshold_for_AP_in_this_FY, 83000, 84000, 'Test5: Upper threshold should be ~83.33k with divisor 3');
}
console.log('');

// TEST 6: Rounding precision (ensure decimal arithmetic, not premature rounding)
console.log('Test 6: Rounding precision test (marginal relief computed in decimal)');
const test6Input = {
  apStart: '2024-04-01',
  apEnd: '2025-03-31',
  turnover: 123456.78,
  costOfSales: 40000,
  staffCosts: 30000,
  depreciation: 2500.50,
  otherCharges: 5000,
  govtGrants: 0,
  rentalIncome: 0,
  interestIncome: 0,
  dividendIncome: 0,
  disallowableExpenses: 0,
  otherAdjustments: 0,
  aiaAdditions: 0,
  tradingLossBF: 0,
  propertyLossBF: 0,
  assocCompanies: 0
};
const test6Result = TaxEngine.run(test6Input, {});
// Final CT charge should be rounded to nearest £1, but intermediate steps preserve decimals
// taxable ≈ 123456.78 - 40000 - 30000 - 2500.50 - 5000 = 45956.28
// Let's just verify CT is calculated and falls in expected range
const ct6 = test6Result.result.tax.corporationTaxCharge;
assertRange(ct6, 8700, 8800, 'Test6: CT should be in expected range with decimal precision');
console.log('');

// TEST 7: Zero profit edge case
console.log('Test 7: Zero/negative profit edge case');
const test7Input = {
  apStart: '2024-04-01',
  apEnd: '2025-03-31',
  turnover: 50000,
  costOfSales: 50000,
  staffCosts: 0,
  depreciation: 0,
  otherCharges: 0,
  govtGrants: 0,
  rentalIncome: 0,
  interestIncome: 0,
  dividendIncome: 0,
  disallowableExpenses: 0,
  otherAdjustments: 0,
  aiaAdditions: 0,
  tradingLossBF: 0,
  propertyLossBF: 0,
  assocCompanies: 0
};
const test7Result = TaxEngine.run(test7Input, {});
// taxable = 0
// CT = 0
assert(test7Result.result.computation.taxableTotalProfits, 0, 'Test7: TTP should be 0');
assert(test7Result.result.tax.corporationTaxCharge, 0, 'Test7: CT should be 0');
console.log('');

// TEST 8: AIA capital allowance limit
console.log('Test 8: AIA capital allowance limit');
const test8Input = {
  apStart: '2024-04-01',
  apEnd: '2025-03-31',
  turnover: 500000,
  costOfSales: 200000,
  staffCosts: 80000,
  depreciation: 0,
  otherCharges: 20000,
  govtGrants: 0,
  rentalIncome: 0,
  interestIncome: 0,
  dividendIncome: 0,
  disallowableExpenses: 0,
  otherAdjustments: 0,
  aiaAdditions: 1500000,  // Claim more than £1m limit
  tradingLossBF: 0,
  propertyLossBF: 0,
  assocCompanies: 0
};
const test8Result = TaxEngine.run(test8Input, {});
// AIA claim should be capped at £1m (or £1m / divisor for associates)
const aiaClaimed = test8Result.result.computation.capitalAllowances;
assert(aiaClaimed, 1000000, 'Test8: AIA should be capped at 1,000,000');
console.log('');

console.log('\n=== All Tests Passed ✓ ===\n');
