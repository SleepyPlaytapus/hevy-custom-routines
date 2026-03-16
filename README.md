# Hevy Custom Routines

A Violentmonkey/Tampermonkey userscript that lets you manage workout routines in [Hevy](https://hevy.com) **without a Pro subscription**.

Import your existing routines, create new ones manually or from text, edit them, and sync changes back to Hevy — all from a floating panel on the Hevy website.

---

## Features

- 🔄 **Import** your existing Hevy routines with one click
- 📝 **Create routines from text** — paste output from ChatGPT/Claude directly
- ✏️ **GUI editor** — add/remove exercises, edit sets, weights, reps
- 🔄 **Sync back to Hevy** — push edits to your Hevy account
- 💾 **Backup** — export all routines as a text file
- 🏃 **Cardio support** — Spinning, Running etc. use time/distance instead of kg×reps
- 📱 **Mobile-friendly** — works on Firefox for Android with Violentmonkey
- 425+ exercises built-in, no manual setup required

---

## Installation

### Requirements
- [Firefox](https://www.mozilla.org/firefox/) or Chrome/Edge
- [Violentmonkey](https://violentmonkey.github.io/) extension (recommended) or Tampermonkey

### Steps

1. Install Violentmonkey from your browser's extension store
2. Click this link to install the script:
   **[Install Hevy Custom Routines](https://raw.githubusercontent.com/YOUR_NICK/hevy-custom-routines/main/hevy_custom_routines.user.js)**
3. Violentmonkey will show an installation dialog — click **Confirm Installation**
4. Go to [hevy.com](https://hevy.com) — you'll see a 📋 button in the bottom-right corner

> **Mobile (Android):** Install [Firefox for Android](https://www.mozilla.org/firefox/android/) → install [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/) → follow steps 2–4 above.

---

## Quick Start

### Import your existing routines
1. Go to **hevy.com/routines**
2. Open the 📋 panel
3. Click **🔄 Import Routines from Hevy**
4. Your routines appear in the panel, tagged `hevy`

### Create a routine from text (manual)
1. Click **📝 Text** in the panel
2. Paste your routine in this format:
```
Monday Push
Bench Press (Barbell): 4x8 @80kg
Overhead Press (Barbell): 3x10 @50kg
Triceps Pushdown: 3x12 @25kg
```
3. Click **⚡ Parse & Save**
4. Click **➡️ Hevy** next to the routine to push it to your account

### Sync edits back to Hevy
After editing a routine locally, click **🔄 Sync** next to it to update it in Hevy.

---

## Text Format

Each routine starts with a **name on the first line**, followed by exercises:

```
Routine Name
Exercise Name: SETSxREPS @WEIGHTkg
Exercise Name: SETSxREPS
```

**Examples:**
```
Wednesday Pull
Bent Over Row (Barbell): 4x8 @60kg
Lat Pulldown (Cable): 4x10 @45kg
Seated Cable Row - V Grip (Cable): 3x12 @40kg
Preacher Curl (Barbell): 4x10 @23kg
```

```
Friday Legs
Deadlift (Barbell): 5x5 @100kg
Leg Press (Machine): 4x10 @120kg
Leg Extension (Machine): 3x15
Standing Calf Raise: 4x15 @60kg
Spinning: 1x 10min
```

**Rules:**
- Exercise names must match the Hevy exercise library (see `hevy_exercises.js` for the full list)
- Weight is optional — omit `@...` for bodyweight or machine exercises where you don't track weight
- Separate multiple routines with a **blank line** — you can paste a full week at once
- Cardio format: `Exercise: 1x 20min` or `Exercise: 1x 20min 5000m`

---

## Using AI to Generate Routines

This is where the tool gets powerful. You can ask ChatGPT, Claude, or any AI to write your training plan — then paste it directly into the **📝 Text** input.

### Prompt template

Copy and paste this into your AI of choice, fill in your details:

```
Create a [3/4/5]-day workout plan for [your goal: strength/hypertrophy/fat loss].
My experience level: [beginner/intermediate/advanced]
Equipment: [gym with barbell/dumbbells/cables/machines]
Days: [Monday, Wednesday, Friday / any split you want]

Output the plan ONLY in this exact format (no other text, no headers, no markdown):

Day Name
Exercise Name: SETSxREPS @WEIGHTkg
Exercise Name: SETSxREPS @WEIGHTkg

Day Name
Exercise Name: SETSxREPS @WEIGHTkg

Rules you must follow:
- Use ONLY exercise names from this list (copy the ones you need):
  Bench Press (Barbell), Bench Press (Dumbbell), Incline Bench Press (Barbell),
  Incline Bench Press (Dumbbell), Decline Bench Press (Barbell),
  Overhead Press (Barbell), Overhead Press (Dumbbell),
  Chest Fly (Dumbbell), Chest Fly (Machine), Cable Fly Crossovers,
  Triceps Pushdown, Triceps Rope Pushdown, Triceps Extension (Cable),
  Triceps Extension (Dumbbell), Skullcrusher (Barbell), Chest Dip,
  Bent Over Row (Barbell), Bent Over Row (Dumbbell),
  Lat Pulldown (Cable), Seated Cable Row - V Grip (Cable),
  Seated Cable Row - Bar Grip, Pull Up, Chin Up, Dumbbell Row,
  Face Pull, Rear Delt Reverse Fly (Dumbbell), Rear Delt Reverse Fly (Cable),
  Bicep Curl (Barbell), Bicep Curl (Dumbbell), Bicep Curl (Cable),
  Hammer Curl (Dumbbell), Hammer Curl (Cable), Preacher Curl (Barbell),
  EZ Bar Biceps Curl,
  Squat (Barbell), Front Squat, Romanian Deadlift (Barbell),
  Deadlift (Barbell), Leg Press (Machine), Leg Extension (Machine),
  Lying Leg Curl (Machine), Seated Leg Curl (Machine), Bulgarian Split Squat,
  Lunge (Barbell), Lunge (Dumbbell), Hip Thrust (Barbell),
  Standing Calf Raise (Barbell), Seated Calf Raise,
  Overhead Press (Barbell), Lateral Raise (Dumbbell), Lateral Raise (Cable),
  Shrug (Barbell), Upright Row (Barbell),
  Cable Crunch, Hanging Leg Raise, Plank, Russian Twist (Weighted),
  Spinning, Running, Treadmill, Elliptical Trainer, Rowing Machine
- Separate days with a blank line
- No extra text, no markdown, no explanations — just the routine
- Use realistic weights for the experience level
```

### Example AI output (ready to paste)

```
Monday Push
Bench Press (Barbell): 4x8 @80kg
Incline Bench Press (Dumbbell): 3x10 @28kg
Cable Fly Crossovers: 3x12 @15kg
Overhead Press (Barbell): 3x8 @55kg
Lateral Raise (Dumbbell): 4x15 @10kg
Triceps Pushdown: 3x12 @25kg

Wednesday Pull
Bent Over Row (Barbell): 4x8 @70kg
Lat Pulldown (Cable): 4x10 @55kg
Seated Cable Row - V Grip (Cable): 3x12 @50kg
Face Pull: 4x15 @20kg
Bicep Curl (Barbell): 3x10 @35kg
Hammer Curl (Dumbbell): 3x12 @16kg

Friday Legs
Squat (Barbell): 4x6 @100kg
Romanian Deadlift (Barbell): 3x10 @80kg
Leg Press (Machine): 3x12 @120kg
Leg Extension (Machine): 3x15 @50kg
Standing Calf Raise (Barbell): 4x15 @60kg
Hanging Leg Raise: 3x15
```

Paste all of this into the **📝 Text** field and click **⚡ Parse & Save** — all three routines are imported at once.

### Tips for better AI output

- Tell the AI your current working weights if you know them
- Ask for a **periodized program** (e.g. week 1-4 technique, week 5-8 strength, week 9-12 hypertrophy)
- Ask it to output multiple mesocycles separated by `---` — the tool handles that too
- If an exercise isn't recognized, check the name in `hevy_exercises.js` and correct it

---

## File Structure

```
hevy-custom-routines/
├── hevy_custom_routines.user.js   ← Main script (install this)
├── hevy_exercises.js              ← Exercise database (425 exercises)
└── README.md
```

The exercise database is a separate file loaded via `@require`. This keeps the main script clean and allows the exercise list to be updated independently.

---

## Updating

Violentmonkey checks for updates automatically. To update manually:
1. Open Violentmonkey dashboard
2. Find "Hevy Custom Routines"
3. Click **Check for updates**

---

## Notes & Limitations

- Requires an active Hevy account (free tier works)
- The script captures your session token automatically when you browse hevy.com — no manual setup
- Token expires when you log out; click **🔑 Refresh Token** and browse the site to re-capture it
- Exercise IDs are global (same for all Hevy users) — the built-in database works for everyone
- Tested on Firefox + Violentmonkey; Chrome + Tampermonkey should also work

---

## Contributing

Pull requests welcome. If Hevy updates their CSS class names and the exercise auto-fetch breaks, open an issue with the new class names from DevTools.

---

## Disclaimer

This script uses Hevy's internal (non-public) API endpoints. It accesses only your own account data using your own session token. Use at your own risk. The author is not affiliated with Hevy.
