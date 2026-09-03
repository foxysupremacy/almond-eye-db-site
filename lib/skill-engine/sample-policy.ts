// Sample-policy markers. The reference engine uses these to decide *where* a
// random trigger actually lands during simulation. We only draw candidate
// regions, so `sample()` is never called — the policies exist solely so the
// reconcile chain can compute the effective policy of a compound condition, and
// so we can label a zone "random" vs "immediate" for display.

import { Region, RegionList } from "./region";
import type { SamplePolicy } from "./types";

export const ImmediatePolicy: SamplePolicy = Object.freeze({
  sample(regions: RegionList) {
    return regions.slice(0, 1);
  },
  reconcile(other: SamplePolicy) {
    return other.reconcileImmediate(this);
  },
  reconcileImmediate(other: SamplePolicy) {
    return other;
  },
  reconcileDistributionRandom(other: SamplePolicy) {
    return other;
  },
  reconcileRandom(other: SamplePolicy) {
    return other;
  },
  reconcileStraightRandom(other: SamplePolicy) {
    return other;
  },
  reconcileAllCornerRandom(other: SamplePolicy) {
    return other;
  },
});

export const RandomPolicy: SamplePolicy = Object.freeze({
  sample(regions: RegionList) {
    if (regions.length === 0) return [];
    return [regions[0]];
  },
  reconcile(other: SamplePolicy) {
    return other.reconcileRandom(this);
  },
  reconcileImmediate() {
    return this;
  },
  reconcileDistributionRandom() {
    return this;
  },
  reconcileRandom(other: SamplePolicy) {
    return other;
  },
  reconcileStraightRandom(other: SamplePolicy) {
    return other;
  },
  reconcileAllCornerRandom(other: SamplePolicy) {
    return other;
  },
});

function distributionPolicy(): SamplePolicy {
  return {
    sample(regions: RegionList) {
      return regions.length === 0 ? [] : [regions[0]];
    },
    reconcile(other: SamplePolicy) {
      return other.reconcileDistributionRandom(this);
    },
    reconcileImmediate() {
      return this;
    },
    reconcileDistributionRandom() {
      return this;
    },
    reconcileRandom(other: SamplePolicy) {
      return other;
    },
    reconcileStraightRandom(other: SamplePolicy) {
      return other;
    },
    reconcileAllCornerRandom(other: SamplePolicy) {
      return other;
    },
  };
}

export const ErlangRandomPolicy = distributionPolicy;

export const StraightRandomPolicy: SamplePolicy = Object.freeze({
  sample(regions: RegionList) {
    return regions.length === 0 ? [] : [regions[0]];
  },
  reconcile(other: SamplePolicy) {
    return other.reconcileStraightRandom(this);
  },
  reconcileImmediate() {
    return this;
  },
  reconcileDistributionRandom() {
    return this;
  },
  reconcileRandom() {
    return this;
  },
  reconcileStraightRandom(other: SamplePolicy) {
    return other;
  },
  reconcileAllCornerRandom() {
    throw new Error("cannot reconcile StraightRandomPolicy with AllCornerRandomPolicy");
  },
});

export const AllCornerRandomPolicy: SamplePolicy = Object.freeze({
  sample(regions: RegionList) {
    return regions.length === 0 ? [] : [regions[0]];
  },
  reconcile(other: SamplePolicy) {
    return other.reconcileAllCornerRandom(this);
  },
  reconcileImmediate() {
    return this;
  },
  reconcileDistributionRandom() {
    return this;
  },
  reconcileRandom() {
    return this;
  },
  reconcileStraightRandom() {
    throw new Error("cannot reconcile StraightRandomPolicy with AllCornerRandomPolicy");
  },
  reconcileAllCornerRandom() {
    return this;
  },
});

/** True when a policy is not the deterministic "immediate" marker. */
export function isRandom(policy: SamplePolicy): boolean {
  return policy !== ImmediatePolicy;
}
