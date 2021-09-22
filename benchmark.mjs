import {linearRegression} from 'simple-statistics';

export function Suite(suiteName) {
  const tests = new Map();

  function add(testName, test) {
    tests.set(testName, test);
  }

  async function run({
    minRuns = 5,
    maxRuns = 150,
  } = {}) {
    console.group(`Suite:${suiteName}`);
    for (let [testName, test] of tests) {
      console.group(`Test:${testName}`);
      const samples = [];
      for (let i = 0; i < maxRuns; i++) {
        const startTime = Date.now();
        await test();
        const stopTime = Date.now();
        const duration = stopTime - startTime;

        samples.push([i, duration])

        if (i >= minRuns) {
          const confidence = linearRegression(samples).m >= 0;
          if (confidence) {
            break;
          }
        }
      }

      const average = samples.reduce((reduced, current) => current[1] + reduced, 0) / samples.length;

      console.log(`samples: ${samples.length}`);
      console.log(`average: ${format(average)}ms`);
      console.groupEnd();
    }
    console.groupEnd();
  }

  return {
    add,
    run,
  };
}

function format(number) {
  return Math.round((number + Number.EPSILON) * 100) / 100;
}