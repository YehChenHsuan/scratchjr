# ScratchJr AI UI Flow Audit

Audit date: 2026-07-11  
Viewport: 1280 x 720 landscape  
Build: local production bundle

## Page Relationship Map

```mermaid
flowchart TD
    A["01 Opening animation"] -->|automatic| B["02 Start options"]
    B -->|house| C["03 My Projects"]
    B -->|question mark| I["09 Getting Started"]
    B -->|gear| E["05 Settings"]
    C -->|home tab| C
    C -->|help tab| D["04 Help and samples"]
    C -->|gear tab| E
    C -->|reference tab| J["10 Reference guide"]
    C -->|new project| F["06 Character selection"]
    C -->|import project| K["System file picker"]
    F -->|confirm character| G["07 Program editor"]
    D -->|sample project| G
    I -->|back| B
    E -->|home or help tab| C
    J -->|home or help tab| C
    G -->|home| C
    G -->|gesture category gear| H["08 AI gesture trainer"]
    H -->|back| G
```

## Navigation Results

| From | Action | To | Result |
|---|---|---|---|
| Opening animation | Wait | Start options | PASS |
| Start options | House | My Projects | PASS |
| My Projects | Help tab | Help and samples | PASS |
| My Projects | Gear tab | Settings | PASS |
| My Projects | Reference tab | Reference guide | PASS |
| My Projects | New project | Character selection | PASS, fixed in this audit |
| Character selection | Confirm | Program editor | PASS |
| Program editor | Gesture settings | AI gesture trainer | Route and page load PASS |

## Screenshots

### 01 Opening Animation
![Opening animation](screenshots/01-intro-animation.png)

### 02 Start Options
![Start options](screenshots/02-start-options.png)

### 03 My Projects
![My Projects](screenshots/03-my-projects.png)

### 04 Help And Samples
![Help and samples](screenshots/04-help-library.png)

### 05 Settings
![Settings](screenshots/05-settings.png)

### 06 New Project Character Selection
![Character selection](screenshots/06-editor-new-project.png)

### 07 Program Editor
![Program editor](screenshots/07-editor-main.png)

### 08 AI Gesture Trainer
![AI gesture trainer](screenshots/08-ai-gesture-trainer.png)

### 09 Getting Started
![Getting started](screenshots/09-getting-started.png)

### 10 Reference Guide
![Reference guide](screenshots/10-reference-guide.png)

## Findings

- Fixed: New Project failed because the project-name scanner treated the Import Project tile as a saved project.
- The editor and AI trainer were not visually modified during this repair.
- No overlap or broken-image problem was observed at the audited landscape viewport.
- Camera content and landmark alignment still require a physical-device camera test.
- Android and iPad portrait/landscape acceptance remains a separate physical-device check.

