import { describe, it, expect } from "vitest";
import { rms, downsampleTo16k, pcm16ToFloat32 } from "./mic";

describe("mic DSP helpers", () => {
  it("rms of a constant signal equals its magnitude", () => {
    const buf = new Float32Array(100).fill(0.5);
    expect(rms(buf)).toBeCloseTo(0.5, 5);
  });
  it("rms of silence is 0", () => {
    expect(rms(new Float32Array(64))).toBe(0);
  });
  it("downsampleTo16k halves a 32kHz buffer and clamps to int16", () => {
    const input = new Float32Array(320).fill(1);
    const out = downsampleTo16k(input, 32000);
    expect(out).toBeInstanceOf(Int16Array);
    expect(out.length).toBe(160);
    expect(out[0]).toBe(32767); // +1.0 -> 0x7FFF
  });
  it("downsampleTo16k maps -1.0 to -32768", () => {
    const out = downsampleTo16k(new Float32Array(64).fill(-1), 16000);
    expect(out[0]).toBe(-32768); // -1.0 -> -0x8000
    expect(out.length).toBe(64); // already 16k -> ratio 1
  });
});

describe("pcm16ToFloat32", () => {
  it("maps int16 samples to [-1, 1) floats", () => {
    const i16 = new Int16Array([0, 32767, -32768]);
    const f = pcm16ToFloat32(i16.buffer);
    expect(f[0]).toBeCloseTo(0, 5);
    expect(f[1]).toBeCloseTo(0.99997, 4);
    expect(f[2]).toBe(-1);
  });
});
