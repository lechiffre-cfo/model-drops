#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const modelPath = path.join(__dirname, 'model.json');
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
const { inputs, outputs } = model;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function almostEqual(a, b) {
  return Math.abs(a - b) < 0.000001;
}

function calculateScenario(multiplier) {
  let cash = inputs.starting_cash;
  const closingCash = [];
  let firstGuardrailBreachMonth = null;

  inputs.plan_revenue.forEach((planRevenue, index) => {
    const scenarioRevenue = planRevenue * multiplier;
    const grossProfit = scenarioRevenue * inputs.gross_margin;
    const netCashFlow = grossProfit - inputs.monthly_operating_expense;
    cash += netCashFlow;
    closingCash.push(cash);

    if (firstGuardrailBreachMonth === null && cash < inputs.cash_guardrail) {
      firstGuardrailBreachMonth = index + 1;
    }
  });

  return { closingCash, firstGuardrailBreachMonth };
}

const scenarioNames = Object.keys(inputs.scenario_multipliers);

assert(model.data_type === 'synthetic', 'model must be explicitly labeled synthetic');
assert(inputs.plan_revenue.length === 6, 'plan must contain six monthly revenue inputs');
assert(scenarioNames.length === 3, 'expected three scenarios');
assert(inputs.starting_cash > inputs.cash_guardrail, 'starting cash should begin above the guardrail');

for (const scenarioName of scenarioNames) {
  const calculated = calculateScenario(inputs.scenario_multipliers[scenarioName]);
  const expected = outputs[scenarioName];

  assert(expected, `missing output block for ${scenarioName}`);
  assert(
    expected.first_guardrail_breach_month === calculated.firstGuardrailBreachMonth,
    `${scenarioName} guardrail breach month mismatch`
  );

  expected.closing_cash.forEach((cash, index) => {
    assert(
      almostEqual(cash, calculated.closingCash[index]),
      `${scenarioName} month ${index + 1} closing cash mismatch`
    );
  });
}

const planMonth6 = outputs.plan.closing_cash[5];
const downsideMonth6 = outputs.downside_15_percent_miss.closing_cash[5];
const downsideGap = planMonth6 - downsideMonth6;

assert(almostEqual(planMonth6, 102700), 'plan month 6 cash should equal EUR 102,700');
assert(almostEqual(downsideMonth6, 53995), 'downside month 6 cash should equal EUR 53,995');
assert(almostEqual(downsideGap, 48705), 'downside month 6 cash gap should equal EUR 48,705');
assert(outputs.plan.first_guardrail_breach_month === null, 'plan should not breach guardrail');
assert(outputs.downside_15_percent_miss.first_guardrail_breach_month === 4, 'downside breach should occur in month 4');

console.log('Validation passed: synthetic model outputs reconcile to formulas.');
console.log(`Plan month 6 cash: EUR ${planMonth6.toLocaleString('en-US')}`);
console.log(`Downside month 6 cash: EUR ${downsideMonth6.toLocaleString('en-US')}`);
console.log(`Downside gap: EUR ${downsideGap.toLocaleString('en-US')}`);
console.log('First downside guardrail breach: month 4');
