"""Isolated offline audio-effects renderer for Nautilus.

Reads one JSON payload from stdin and writes one JSON result to stdout.  Keeping
this worker separate from Express means an audio dependency failure cannot take
down the main Nautilus service.
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from pedalboard import Bitcrush, Chorus, Compressor, Delay, Distortion, Gain, HighpassFilter, Limiter, LowpassFilter, Pedalboard, PitchShift, Reverb


PRESETS = {
    "original": {"label": "原声清晰", "description": "轻微母带处理，保持原声"},
    "robot": {"label": "清晰机器人", "description": "干声托底的电子机械感"},
    "heavy-mech": {"label": "重装机甲", "description": "低沉、厚重的金属角色感"},
    "playful-high": {"label": "童趣高音", "description": "明亮、活泼的高音角色感"},
    "telephone": {"label": "电话", "description": "窄频对讲机质感"},
}


def clamp(value, low, high, fallback):
    try:
        return min(max(float(value), low), high)
    except (TypeError, ValueError):
        return fallback


def parameters(raw):
    return {
        "pitchSemitones": clamp(raw.get("pitchSemitones"), -12, 12, 0),
        "effectStrength": clamp(raw.get("effectStrength"), 0, 1, 0.55),
        "clarity": clamp(raw.get("clarity"), 0, 1, 0.7),
        "space": clamp(raw.get("space"), 0, 1, 0.1),
    }


def preset_params(preset_id, raw):
    base = {
        "original": {"pitchSemitones": 0, "effectStrength": 0.0, "clarity": 0.9, "space": 0.0},
        "robot": {"pitchSemitones": -1, "effectStrength": 0.52, "clarity": 0.78, "space": 0.08},
        "heavy-mech": {"pitchSemitones": -5, "effectStrength": 0.62, "clarity": 0.7, "space": 0.18},
        "playful-high": {"pitchSemitones": 5, "effectStrength": 0.32, "clarity": 0.86, "space": 0.08},
        "telephone": {"pitchSemitones": 0, "effectStrength": 0.72, "clarity": 0.65, "space": 0.0},
    }.get(preset_id, {})
    base.update(raw or {})
    return parameters(base)


def normalize(audio):
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 0.0001:
        audio = audio * min(0.92 / peak, 6.0)
    return audio


def read_pcm_wav(file_path):
    with wave.open(str(file_path), "rb") as source:
        if source.getsampwidth() != 2:
            raise ValueError("效果器只接受标准 PCM 16-bit 输入")
        sample_rate = source.getframerate()
        channels = source.getnchannels()
        frames = min(source.getnframes(), sample_rate * 300)
        raw = source.readframes(frames)
    audio = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    return audio.reshape(-1, channels).T, sample_rate


def write_pcm_wav(file_path, audio, sample_rate):
    clipped = np.clip(audio, -1, 1)
    pcm = (clipped.T.reshape(-1) * 32767).astype("<i2").tobytes()
    with wave.open(str(file_path), "wb") as destination:
        destination.setnchannels(audio.shape[0])
        destination.setsampwidth(2)
        destination.setframerate(sample_rate)
        destination.writeframes(pcm)


def render(payload):
    source_path = Path(payload["sourcePath"])
    output_path = Path(payload["outputPath"])
    preset_id = payload.get("presetId", "original")
    if preset_id not in PRESETS:
        raise ValueError("不支持的效果预设")
    params = preset_params(preset_id, payload.get("params", {}))

    audio, sample_rate = read_pcm_wav(source_path)
    dry = audio.copy()
    strength = params["effectStrength"]
    clarity = params["clarity"]
    pitch = params["pitchSemitones"]

    # Character branch. The dry branch remains untouched and is blended back,
    # which preserves consonants and makes strong effects remain intelligible.
    character_plugins = [PitchShift(semitones=pitch)] if pitch else []
    if preset_id == "robot":
        character_plugins += [
            HighpassFilter(cutoff_frequency_hz=150),
            LowpassFilter(cutoff_frequency_hz=5200 + 2400 * clarity),
            Chorus(rate_hz=1.6, depth=0.22, centre_delay_ms=5.5, feedback=0.08, mix=0.36 + strength * 0.24),
            Distortion(drive_db=5 + strength * 11),
            Bitcrush(bit_depth=14 - int(strength * 5)),
        ]
    elif preset_id == "heavy-mech":
        character_plugins += [
            HighpassFilter(cutoff_frequency_hz=70),
            LowpassFilter(cutoff_frequency_hz=4800 + 1800 * clarity),
            Chorus(rate_hz=0.65, depth=0.38, centre_delay_ms=10, feedback=0.18, mix=0.32 + strength * 0.28),
            Distortion(drive_db=4 + strength * 8),
        ]
    elif preset_id == "playful-high":
        character_plugins += [HighpassFilter(cutoff_frequency_hz=120), Chorus(rate_hz=0.8, depth=0.16, centre_delay_ms=4, feedback=0.05, mix=0.12 + strength * 0.18)]
    elif preset_id == "telephone":
        character_plugins += [HighpassFilter(cutoff_frequency_hz=280), LowpassFilter(cutoff_frequency_hz=3400), Distortion(drive_db=2 + strength * 5), Bitcrush(bit_depth=13)]

    wet = Pedalboard(character_plugins)(audio, sample_rate) if character_plugins else audio
    # High clarity keeps a larger dry signal. Original preset remains 100% dry.
    wet_gain = strength * (0.88 - clarity * 0.35)
    dry_gain = 1.0 - wet_gain
    mixed = dry * dry_gain + wet * wet_gain
    if params["space"] > 0:
        mixed = Pedalboard([Delay(delay_seconds=0.045, feedback=0.12, mix=params["space"] * 0.2), Reverb(room_size=0.12 + params["space"] * 0.55, wet_level=params["space"] * 0.18, dry_level=1.0)])(mixed, sample_rate)
    mastered = Pedalboard([Compressor(threshold_db=-19, ratio=2.5, attack_ms=8, release_ms=90), Gain(gain_db=2.5), Limiter(threshold_db=-1.0, release_ms=80)])(normalize(mixed), sample_rate)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    write_pcm_wav(output_path, mastered, sample_rate)
    return {"preset": PRESETS[preset_id], "params": params, "sampleRate": sample_rate}


def main():
    try:
        payload = json.load(sys.stdin)
        result = render(payload)
        print(json.dumps({"ok": True, **result}, ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
