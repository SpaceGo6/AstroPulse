# AstroPulse: Autonomous Spaceflight Health & Edge AI Triage Companion

**NASA Space Apps Challenge 2026** | *Challenge: Create Health Monitoring Software for Astronauts on Space Missions*

AstroPulse is an offline-first health monitoring and preventive care application built for long-duration deep-space missions (Moon, Mars, and transit). Because deep-space crews face up to 20-minute communication delays with Earth and often lack an onboard physician, AstroPulse combines a **Daily Countermeasure & Habit Tracker (Track A)** with an **Offline Edge AI Emergency Triage Assistant (Track B)**.

---

## Table of Contents
1. [Core Concept & Mission Value](#1-core-concept--mission-value)
2. [System Architecture & Flow Diagram](#2-system-architecture--flow-diagram)
3. [Key Features](#3-key-features)
4. [Datasets & Validation Strategy](#4-datasets--validation-strategy)
5. [Edge AI Model Training & Inference Pipeline](#5-edge-ai-model-training--inference-pipeline)
6. [Suggested Tech Stack](#6-suggested-tech-stack)
7. [Hackathon Demo Scenario](#7-hackathon-demo-scenario)

---

## 1. Core Concept & Mission Value

During multi-month spaceflight, astronauts experience five primary hazards: **microgravity, space radiation, isolation/confinement, distance from Earth, and closed environments**. 

AstroPulse solves two critical operational gaps:
* **Preventive Adherence (Daily Mode):** Combats silent physiological deconditioning (bone mineral loss, muscle atrophy, fluid shifts, and psychological isolation) through scheduled daily countermeasures, dynamic trend forecasting, and crew mission streaks.
* **Autonomous Emergency Response (Edge AI Triage Mode):** Continuously monitors incoming vitals locally on the spacecraft tablet. When an anomaly is detected, the system transitions seamlessly into step-by-step medical triage for non-doctor crewmates—operating **100% offline** with zero Earth latency.

---

## 2. System Architecture & Flow Diagram

![Flow from crew and sensor inputs through the offline edge AI engine into daily routine mode or emergency triage mode](assets/system-architecture.png)

---

## 3. Key Features

### Track A: Daily Routine & Countermeasure Companion
* **Mission Briefing Checklist:** Time-blocked daily tasks (Morning Vitals, Resistive ARED Workout, Cardio, Hydration, Evening Mood Log) with simulated spacecraft reminders.
* **Dynamic Trend & Risk Forecasting:** Interactive time-series charts comparing astronaut adherence against NASA physiological baselines, including a **Time-Jump Slider** (`Day 1` to `Day 180`) to visualize the impact of skipped countermeasures.
* **Crew Readiness & Streaks:** Grounded gamification featuring *Countermeasure Streaks*, a *0–100% Mars Landing Readiness Score*, and shared *Crew Distance Milestones* to combat isolation.
* **"How & Why" Micro-Cards:** Plain-language explanations detailing how to take measurements and why microgravity alters each metric.

### Track B: Edge AI Emergency Triage Assistant
* **Background Anomaly Watchdog:** Runs continuously in the browser/device to flag acute cardiovascular spikes, hypoxia, or severe multi-day recovery drops.
* **Non-Doctor Step-by-Step Triage:** Translates medical alerts into clear visual instructions (e.g., *"1. Retrieve portable pulse oximeter from Bay 2 -> 2. Seat crewmate upright -> 3. Administer supplemental O2"*).
* **Offline Medical Q&A:** Local quantized Small Language Model (SLM) grounded in spaceflight medical protocols for hands-free emergency guidance.

---

## 4. Datasets & Validation Strategy

To ground AstroPulse in real spaceflight science while maintaining realistic continuous sensor streams, we combine **NASA spaceflight/analog datasets** with **open-access physiological time-series data**:

| Dataset Source | Direct Link | Data Type | How We Use It in AstroPulse |
| :--- | :--- | :--- | :--- |
| **NASA Open Science Data Repository (OSDR)** | [osdr.nasa.gov](https://nasa.gov) *(Search: `OSD-572` / Inspiration4)* | Pre-flight, in-flight, and post-flight physiological, cognitive, and biomarker data. | Calibrates realistic in-flight baseline shifts for heart rate, sleep disruption, and cognitive fatigue. |
| **NASA Life Sciences Portal (NLSP)** | [nasa.gov/hrp/nlsp](https://nasa.gov) *(Search: 70-Day Bedrest Studies)* | Earth-analog microgravity deconditioning rates (bone density, muscle volume, VO2 max). | Powers the mathematical decay curves in our Track B **Dynamic Risk Forecasting Chart** when exercise is missed. |
| **NASA Human Research Program (HRP)** | [nasa.gov/hrp](https://nasa.gov) | Published countermeasure thresholds and spaceflight hazard guidelines. | Defines the Green / Yellow / Red clinical thresholds and populates the **"Why This Matters"** educational tooltips. |
| **PhysioNet (Wearable & Sleep Datasets)** | [physionet.org](https://physionet.org) *(e.g., Sleep-EDF, Wearable Stress)* | High-frequency continuous CSV streams of Heart Rate, HRV, SpO2, and sleep stages. | Acts as the live "simulated smartwatch feed" to train and test our Edge AI anomaly detector. |

### Data Processing & Synthetic Mission Generator
1. **Baseline Extraction:** Extract monthly deconditioning rates from NASA bedrest literature (e.g., `1.0%–1.5%` bone mineral density loss/month without resistive loading).
2. **Stream Alignment:** Clean and resample PhysioNet CSV vital logs into daily and minute-by-minute JSON intervals.
3. **Synthetic Anomaly Injection:** Inject realistic deep-space emergency events (e.g., acute tachycardia `>130 bpm`, gradual hypoxia `SpO2 <90%`, or severe sleep deprivation) into test profiles to validate alert latency and false-positive rates.

---

## 5. Edge AI Model Training & Inference Pipeline

Because deep-space spacecraft cannot rely on cloud APIs during emergencies, all AI models are trained offline and exported to lightweight edge formats:

### Step 1: Time-Series Anomaly Detection Model (Watchdog)
* **Algorithm:** **Isolation Forest** or lightweight **1D-CNN / LSTM Autoencoder** trained on healthy resting baseline windows from PhysioNet and NASA OSDR subjects.
* **Features:** Rolling 7-day and 14-day averages of Resting Heart Rate (RHR), Heart Rate Variability (HRV), SpO2, Sleep Duration, and Daily Exercise Load.
* **Training & Export:**
  1. Train in Python (`scikit-learn` or `PyTorch`) on normal physiological windows so the model learns an individual's healthy baseline.
  2. Compute reconstruction error / anomaly score against injected emergency scenarios.
  3. Export the trained model to **ONNX** (`onnxmltools`) or **TensorFlow.js** (`tfjs`) so inference runs directly inside the client app in `<50ms` with zero network calls.

### Step 2: Offline Triage Assistant (Local SLM + RAG)
* **Model:** Quantized 4-bit Small Language Model (e.g., **Gemma 2B/4B** or **Phi-3 Mini** via `WebLLM` or `Ollama`).
* **Knowledge Grounding (RAG):** Embed structured NASA emergency checklists and countermeasure guides into a lightweight local vector store (`Voy` or `Transformers.js` embeddings) so the assistant retrieves verified flight-surgeon procedures without hallucinating.

---

## 6. Suggested Tech Stack

* **Frontend / UI:** React / Next.js + Tailwind CSS (High-contrast dark mode optimized for spacecraft displays)
* **Data Visualization:** Recharts or Chart.js (Interactive trend lines and threshold zones)
* **Edge ML Runtime:** ONNX Runtime Web / TensorFlow.js (Client-side anomaly detection)
* **Local LLM Engine:** WebLLM or local Ollama instance (Offline emergency triage chat)
* **Data Pipeline (Training):** Python, Pandas, NumPy, Scikit-Learn / PyTorch

---

## 7. Hackathon Demo Scenario

1. **Routine Check-In (Track B):** Show an astronaut on *Mission Day 84* logging morning vitals, completing their ARED resistive workout, and maintaining a *21-Day Bone Shield Streak*.
2. **Predictive Drift (Time-Jump Slider):** Fast-forward 14 days with missed workouts; show the trend chart shifting from **Green** to **Yellow** as the Edge AI adjusts tomorrow's workout recommendation.
3. **Offline Emergency Trigger (Track A):** Disconnect Wi-Fi (Airplane Mode) and inject a simulated **Acute Cardiovascular / Radiation Stress Event** from our PhysioNet test stream. Watch the Edge AI detect the anomaly locally and launch the step-by-step non-doctor triage protocol.
