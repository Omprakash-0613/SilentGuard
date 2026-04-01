# SilentGuard 🛡️

Passive audio crisis detection for hotels. No cameras. No recordings. Just AI listening for when someone needs help.

**[▶ Watch Demo](https://drive.google.com/file/d/1fv-JDanrARnNk5s5C_TqKFOgRGnSvFI8/view?usp=sharing)** · 
**[Live App](https://www.silentguard.tech/)**
**[Live Dashboard](https://silentguard-dashboard.onrender.com/)**
---
Dashboard password - silentguard2026

## Why I built this

Hotels have emergencies — screams, glass breaking, someone in danger — and by the time staff find out, it's already been 4-5 minutes. CCTV exists but it's expensive, requires consent, and doesn't cover every stairwell and corridor.

I wanted to build something that could work on hardware hotels already have (phones), without storing any sensitive data, and without needing any new infrastructure.

That's SilentGuard.

---

## How it works

Any phone running the PWA becomes a passive listener. Google's YAMNet model runs directly on the device — it classifies sounds in real-time without sending audio anywhere. When it detects a scream, glass break, or gunshot above a confidence threshold, it writes a small metadata event to Firebase and instantly pushes a notification to all registered staff devices.

The hotel manager sees everything in a live Streamlit dashboard.

The most important part: **audio never leaves the device.** Ever. We store 5 fields — room ID, crisis type, confidence score, timestamp, and resolved status. That's it. GDPR-compliant by design, not by policy.
```
┌─────────────────────────────────────────────────────────┐
│              ON DEVICE — audio never leaves             │
│                                                         │
│  ┌─────────────┐     ┌─────────────┐    ┌─────────────┐ │
│  │ Mic capture │───▶│  Resample   │───▶│   YAMNet    │ │
│  │ Web Audio   │     │ 48kHz→16kHz │    │  TF.js AI   │ │
│  └─────────────┘     └─────────────┘    └──────┬──────┘ │
│                                               │         │
└───────────────────────────────────────────────┼─────────┘
                                                │
                                        ┌───────▼───────┐
                    ┌───── No ──────────│  Crisis found?│
                    │                   │  conf ≥ 0.35  │
                    │                   └───────┬───────┘
                    │                           │ Yes
                    ▼                           ▼
         ┌─────────────────┐        ┌─────────────────────┐
         │  Keep listening │        │  Firestore write    │
         └─────────────────┘        │  (metadata only)    │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │   Cloud Function    │
                                    │   auto-triggered    │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │     FCM push        │
                                    │   all staff phones  │
                                    └─────────┬───────────┘
                           ┌──────────────────┘
                           │                  │
                ┌──────────▼──────┐  ┌────────▼────────┐
                │  Staff alert    │  │   Dashboard     │
                │  notification   │  │  live updates   │
                └─────────────────┘  └─────────────────┘
```

---

## What it detects

Screaming, shouting, yelling, crying, glass shattering, breaking sounds, gunshots, explosions. YAMNet knows 521 sound categories — we only act on the ones that matter for safety.

---

## Tech stack

- **TensorFlow.js + YAMNet** — on-device inference, ~50ms per classification
- **Web Audio API** — mic capture, resampled to 16kHz for the model
- **React + Vite** — PWA, installable on any Android phone from the browser
- **Firebase Firestore** — stores crisis metadata (not audio)
- **Firebase Cloud Messaging** — push notifications to staff phones
- **Streamlit** — admin dashboard for hotel managers

---

## Real-world use cases

Hotels are just the start. The same system works for women's safety apps, elderly care monitoring, and smart home security — anywhere you need passive audio awareness without surveillance.

---

## About

Built by **Omprakash** — 2nd year CSE at SOA University ITER, Bhubaneswar.

[![LinkedIn]](https://www.linkedin.com/in/om-prakash-panda-224352276/)
[![GitHub]](https://github.com/Omprakash-0613)

---

*"We detect. We don't record."*
