import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areaPath,
  bandWidth,
  bandX,
  clampZoom,
  dateTickIndices,
  downsampleIndices,
  linearScale,
  linePath,
  mergeDomains,
  nearestIndex,
  niceTicks,
  valueDomain,
} from "../components/charts/chart-math.ts";
import { closeTo } from "./helpers.ts";

describe("linearScale", () => {
  it("maps the domain onto the range", () => {
    const scale = linearScale([0, 100], [0, 200]);
    assert.equal(scale(0), 0);
    assert.equal(scale(50), 100);
    assert.equal(scale(100), 200);
  });

  it("supports an inverted range, as a price axis needs", () => {
    const scale = linearScale([0, 100], [300, 0]);
    assert.equal(scale(0), 300);
    assert.equal(scale(100), 0);
  });

  it("widens a zero-width domain instead of dividing by zero", () => {
    const scale = linearScale([50, 50], [0, 100]);
    assert.ok(Number.isFinite(scale(50)));
    assert.equal(scale(50), 50);
  });

  it("falls back to a unit domain for non-finite bounds", () => {
    const scale = linearScale([Number.NaN, Infinity], [0, 100]);
    assert.ok(Number.isFinite(scale(0.5)));
  });

  it("round-trips through invert", () => {
    const scale = linearScale([10, 20], [0, 500]);
    assert.ok(closeTo(scale.invert(scale(14.5)), 14.5, 8));
  });

  it("returns NaN only for non-finite input, which callers filter", () => {
    const scale = linearScale([0, 1], [0, 1]);
    assert.ok(Number.isNaN(scale(Number.NaN)));
  });
});

describe("band layout", () => {
  it("centres bars in their band and insets the ends", () => {
    const first = bandX(0, 10, 100);
    const last = bandX(9, 10, 100);
    assert.ok(first > 0 && first < 10);
    assert.ok(last > 90 && last < 100);
  });

  it("centres a lone bar", () => {
    assert.equal(bandX(0, 1, 100), 50);
  });

  it("is monotonic", () => {
    let previous = -Infinity;
    for (let i = 0; i < 20; i += 1) {
      const x = bandX(i, 20, 400);
      assert.ok(x > previous);
      previous = x;
    }
  });

  it("gives every band a drawable width", () => {
    assert.ok(bandWidth(10, 100) > 0);
    assert.ok(bandWidth(2000, 300) >= 0.5);
    assert.equal(bandWidth(0, 100), 0);
  });

  it("makes weekends invisible by counting sessions, not days", () => {
    // Friday then Monday are adjacent bars, the same distance apart as any pair.
    const fridayToMonday = bandX(1, 4, 400) - bandX(0, 4, 400);
    const mondayToTuesday = bandX(2, 4, 400) - bandX(1, 4, 400);
    assert.ok(closeTo(fridayToMonday, mondayToTuesday, 8));
  });
});

describe("nearestIndex", () => {
  it("finds the bar under the cursor", () => {
    assert.equal(nearestIndex(5, 10, 100), 0);
    assert.equal(nearestIndex(55, 10, 100), 5);
    assert.equal(nearestIndex(95, 10, 100), 9);
  });

  it("clamps outside the plot rather than blanking the readout", () => {
    assert.equal(nearestIndex(-50, 10, 100), 0);
    assert.equal(nearestIndex(500, 10, 100), 9);
  });

  it("returns -1 for an empty series", () => {
    assert.equal(nearestIndex(50, 0, 100), -1);
  });

  it("always lands on the only bar of a one-point series", () => {
    assert.equal(nearestIndex(0, 1, 100), 0);
    assert.equal(nearestIndex(100, 1, 100), 0);
  });
});

describe("valueDomain", () => {
  it("pads the extremes", () => {
    const [min, max] = valueDomain([10, 20]);
    assert.ok(min < 10 && max > 20);
  });

  it("ignores nulls", () => {
    const [min, max] = valueDomain([null, 10, null, 20, null]);
    assert.ok(min < 10 && max > 20);
  });

  it("returns a unit domain when everything is null", () => {
    assert.deepEqual(valueDomain([null, null]), [0, 1]);
    assert.deepEqual(valueDomain([]), [0, 1]);
  });

  it("widens a constant series", () => {
    const [min, max] = valueDomain([50, 50, 50]);
    assert.ok(max > min);
  });

  it("anchors volume at zero", () => {
    const [min] = valueDomain([100, 200], { includeZero: true });
    assert.ok(min <= 0);
  });

  it("merges overlay domains", () => {
    assert.deepEqual(mergeDomains([[10, 20], [5, 15]]), [5, 20]);
    assert.deepEqual(mergeDomains([]), [0, 1]);
  });
});

describe("niceTicks", () => {
  it("produces round values covering the domain", () => {
    const ticks = niceTicks([0, 100], 5);
    assert.ok(ticks.length >= 4 && ticks.length <= 8);
    for (const tick of ticks) assert.equal(tick % 10, 0);
  });

  it("avoids floating point drift", () => {
    for (const tick of niceTicks([0, 1], 5)) {
      assert.equal(String(tick).length <= 4, true, `ugly tick: ${tick}`);
    }
  });

  it("handles a negative domain, as a drawdown axis needs", () => {
    const ticks = niceTicks([-0.4, 0], 4);
    assert.ok(ticks.length > 1);
    assert.ok(Math.min(...ticks) >= -0.4);
    assert.ok(Math.max(...ticks) <= 0);
  });

  it("degrades gracefully on a zero-width domain", () => {
    assert.deepEqual(niceTicks([5, 5]), [5]);
  });
});

describe("dateTickIndices", () => {
  const days = (count: number, startMonth = 0) =>
    Array.from({ length: count }, (_, i) => {
      const date = new Date(Date.UTC(2026, startMonth, 1));
      date.setUTCDate(date.getUTCDate() + i);
      return date.toISOString();
    });

  it("labels every point when the series is short", () => {
    assert.deepEqual(dateTickIndices(days(4), 6), [0, 1, 2, 3]);
  });

  it("labels month boundaries on a medium range", () => {
    const indices = dateTickIndices(days(150), 6);
    assert.ok(indices.length >= 2 && indices.length <= 8);
    assert.equal(indices[0], 0);
    for (const index of indices) assert.ok(index >= 0 && index < 150);
  });

  it("thins to year boundaries on a long range", () => {
    const indices = dateTickIndices(days(1500), 6);
    assert.ok(indices.length <= 8, `got ${indices.length} ticks`);
  });

  it("returns indices in ascending order with no duplicates", () => {
    const indices = dateTickIndices(days(400), 5);
    for (let i = 1; i < indices.length; i += 1) assert.ok(indices[i] > indices[i - 1]);
  });

  it("is empty for no data", () => {
    assert.deepEqual(dateTickIndices([], 6), []);
  });
});

describe("linePath", () => {
  const x = (index: number) => index * 10;
  const y = (value: number) => 100 - value;

  it("draws a single subpath for continuous data", () => {
    const path = linePath([10, 20, 30], x, y);
    assert.equal((path.match(/M/g) ?? []).length, 1);
    assert.equal((path.match(/L/g) ?? []).length, 2);
  });

  it("breaks the path at a gap rather than interpolating across it", () => {
    const path = linePath([10, null, 30], x, y);
    assert.equal((path.match(/M/g) ?? []).length, 2);
    assert.equal((path.match(/L/g) ?? []).length, 0);
  });

  it("skips a warm-up prefix of nulls", () => {
    const path = linePath([null, null, 30, 40], x, y);
    assert.ok(path.startsWith("M20.00"));
  });

  it("is empty when every value is null", () => {
    assert.equal(linePath([null, null], x, y), "");
    assert.equal(linePath([], x, y), "");
  });

  it("skips values that scale to a non-finite pixel", () => {
    const path = linePath([10, 20], () => Number.NaN, y);
    assert.equal(path, "");
  });
});

describe("areaPath", () => {
  const x = (index: number) => index * 10;
  const y = (value: number) => 100 - value;

  it("closes the shape down to the baseline", () => {
    const path = areaPath([10, 20, 30], x, y, 100);
    assert.ok(path.startsWith("M0.00 100.00"));
    assert.ok(path.endsWith("Z"));
  });

  it("fills only the longest unbroken run", () => {
    const path = areaPath([10, null, 30, 40, 50], x, y, 100);
    // The three-point run wins, so the fill starts at index 2.
    assert.ok(path.startsWith("M20.00 100.00"));
  });

  it("draws nothing for a single point or no data", () => {
    assert.equal(areaPath([10], x, y, 100), "");
    assert.equal(areaPath([null, null], x, y, 100), "");
    assert.equal(areaPath([], x, y, 100), "");
  });
});

describe("downsampleIndices", () => {
  it("returns every position when the series is already short", () => {
    assert.deepEqual(downsampleIndices(3, 100, (i) => i), [0, 1, 2]);
    assert.deepEqual(downsampleIndices(0, 100, () => 0), []);
  });

  it("thins a long series towards the limit", () => {
    const values = Array.from({ length: 5000 }, (_, i) => Math.sin(i / 40));
    const out = downsampleIndices(5000, 400, (i) => values[i]);
    assert.ok(out.length <= 420, `got ${out.length}`);
    assert.ok(out.length >= 200);
  });

  it("keeps the first and last positions", () => {
    const out = downsampleIndices(2000, 100, (i) => i);
    assert.equal(out[0], 0);
    assert.equal(out[out.length - 1], 1999);
  });

  it("returns strictly increasing positions so series stay aligned", () => {
    const values = Array.from({ length: 3000 }, (_, i) => Math.cos(i / 17) * i);
    const out = downsampleIndices(3000, 300, (i) => values[i]);
    for (let i = 1; i < out.length; i += 1) {
      assert.ok(out[i] > out[i - 1], `position ${i} is not after its predecessor`);
    }
    for (const index of out) assert.ok(index >= 0 && index < 3000);
  });

  it("preserves a lone spike that every-nth sampling would drop", () => {
    const values = Array.from({ length: 2000 }, (_, i) => (i === 977 ? 9999 : 1));
    const out = downsampleIndices(2000, 100, (i) => values[i]);
    assert.ok(out.includes(977), "the spike was lost");
  });

  it("keeps a bucket's minimum and maximum in the order they occurred", () => {
    // A single ramp down then up inside one bucket: both extremes survive.
    const values = Array.from({ length: 200 }, (_, i) => (i === 40 ? -50 : i === 120 ? 50 : 0));
    const out = downsampleIndices(200, 20, (i) => values[i]);
    assert.ok(out.includes(40));
    assert.ok(out.includes(120));
    assert.ok(out.indexOf(40) < out.indexOf(120));
  });

  it("survives a series with no finite values at all", () => {
    const out = downsampleIndices(1000, 100, () => null);
    assert.ok(out.length > 0);
    assert.equal(out[0], 0);
    assert.equal(out[out.length - 1], 999);
    for (let i = 1; i < out.length; i += 1) assert.ok(out[i] > out[i - 1]);
  });

  it("survives a limit below the usable minimum", () => {
    assert.equal(downsampleIndices(50, 2, (i) => i).length, 50);
  });
});

describe("clampZoom", () => {
  it("normalizes a backwards drag", () => {
    assert.deepEqual(clampZoom(80, 20, 100), { start: 20, end: 80 });
  });

  it("clamps to the series bounds", () => {
    assert.deepEqual(clampZoom(-50, 500, 100), { start: 0, end: 99 });
  });

  it("refuses a selection below the minimum bar count", () => {
    assert.equal(clampZoom(10, 11, 100), null);
  });

  it("refuses to zoom a series that is already short", () => {
    assert.equal(clampZoom(0, 3, 4), null);
  });
});
